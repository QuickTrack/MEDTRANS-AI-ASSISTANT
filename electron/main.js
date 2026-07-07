const fs = require("node:fs");
const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const net = require("node:net");
const { execSync } = require("node:child_process");

const DEFAULT_PORT = 3000;
const isDev = !app.isPackaged;

// Stability: avoid GPU-process crashes on VMs / RDP / some drivers that can
// terminate the renderer (and thus the app) after a while.
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.disableHardwareAcceleration();

let serverProcess = null;
let mainWindow = null;
let shuttingDown = false;

function logError(...args) {
  try {
    const file = path.join(process.env.APPDATA ?? __dirname, "medtrans-main.log");
    fs.appendFileSync(
      file,
      args.map((a) => (a instanceof Error ? a.stack : String(a))).join(" ") + "\n"
    );
  } catch {
    /* ignore */
  }
}

process.on("uncaughtException", (e) => logError("uncaught", e));
process.on("unhandledRejection", (e) => logError("unhandled", e));
process.on("exit", (code) => logError("[process exit] code=", code));

app.on("will-quit", () => logError("[will-quit]"));
app.on("quit", (e, code) => logError("[quit] code=", code));

logError("[load] main.js evaluated; isPackaged=", app.isPackaged, "resourcesPath=", process.resourcesPath);

// --- Single instance: must be requested before anything else ---
const gotLock = app.requestSingleInstanceLock();
logError("[single-instance] gotLock=", gotLock);
if (!gotLock) {
  logError("[single-instance] another instance holds the lock — quitting");
  app.quit();
}

const LOADING_HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>body{font-family:system-ui,Segoe UI,Arial;background:#0b1220;color:#cbd5e1;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.spinner{width:38px;height:38px;border:4px solid #1e293b;border-top-color:#38bdf8;border-radius:50%;animation:spin 1s linear infinite;margin-right:14px}
@keyframes spin{to{transform:rotate(360deg)}}.wrap{display:flex;align-items:center}</style></head>
<body><div class="wrap"><div class="spinner"></div><div>Starting MedTrans AI Assistant…</div></div></body></html>`;

function errorHtml(title, detail) {
  const safe = String(detail || "").replace(/</g, "&lt;");
  return `<!doctype html><html><head><meta charset="utf-8">
<style>body{font-family:system-ui,Segoe UI,Arial;background:#0b1220;color:#e2e8f0;margin:0;padding:40px}
h1{color:#f87171;font-size:20px}pre{background:#111827;padding:16px;border-radius:8px;white-space:pre-wrap;word-break:break-word;color:#94a3b8}</style></head>
<body><h1>${title}</h1><pre>${safe}</pre>
<p>If this persists, check the log at:<br>%APPDATA%\\medtrans-main.log</p></body></html>`;
}

function portFree(port) {
  return new Promise((resolve) => {
    const sock = net.connect(port, "127.0.0.1");
    sock.once("connect", () => {
      sock.destroy();
      resolve(false);
    });
    sock.once("error", () => {
      sock.destroy();
      resolve(true);
    });
  });
}

async function findFreePort(start) {
  let port = start;
  for (let i = 0; i < 50; i++) {
    if (await portFree(port)) return port;
    port++;
  }
  return start;
}

function findNode() {
  const bundled = path.join(process.resourcesPath, "node", "node.exe");
  if (fs.existsSync(bundled)) return bundled;
  try {
    const found = execSync("where node").toString().trim().split("\n")[0];
    if (found) return found;
  } catch {}
  return "node";
}

function startNextServer(port) {
  const candidateDirs = app.isPackaged
    ? [
        path.join(process.resourcesPath, "server"),
        path.join(process.resourcesPath, "app", ".next", "standalone"),
        path.join(app.getAppPath(), ".next", "standalone"),
      ]
    : [path.join(app.getAppPath(), ".next", "standalone")];

  let standaloneDir = candidateDirs.find((d) => fs.existsSync(path.join(d, "server.js")));
  if (!standaloneDir) standaloneDir = candidateDirs[0];
  const serverEntry = path.join(standaloneDir, "server.js");

  const nodeBin = findNode();
  logError("[boot] standaloneDir=", standaloneDir, "exists=", fs.existsSync(standaloneDir));
  logError("[boot] serverEntry exists=", fs.existsSync(serverEntry));
  logError("[boot] nodeBin=", nodeBin);

  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
  };

  const proc = spawn(nodeBin, [serverEntry], {
    cwd: standaloneDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverLog = "";
  proc.stdout.on("data", (d) => {
    serverLog += d.toString();
    logError("[server stdout]", d.toString());
  });
  proc.stderr.on("data", (d) => {
    serverLog += d.toString();
    logError("[server stderr]", d.toString());
  });

  proc.on("error", (err) => logError("Failed to start server:", err));
  proc.on("exit", (code, signal) => {
    logError("Server exited code", code, "signal", signal, "log:", serverLog.slice(-2000));
    if (!shuttingDown) {
      logError("[server] unexpected exit — will restart");
      serverProcess = startNextServer(port);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL("data:text/html," + encodeURIComponent(LOADING_HTML));
        reloadWhenReady(port);
      }
    }
  });

  proc._serverLog = () => serverLog;
  return proc;
}

function reloadWhenReady(port) {
  const tryLoad = (attempt = 0) => {
    const sock = net.connect(port, "127.0.0.1");
    sock.once("connect", () => {
      sock.end();
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.loadURL(`http://127.0.0.1:${port}`).catch((e) => logError("[loadURL error]", e));
    });
    sock.once("error", () => {
      sock.destroy();
      if (attempt < 100) setTimeout(() => tryLoad(attempt + 1), 300);
    });
  };
  tryLoad();
}

function createWindow(port) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#0b1220",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    logError("[did-fail-load]", errorCode, errorDescription, validatedURL);
    const detail = `Failed to load ${validatedURL}\nError ${errorCode}: ${errorDescription}` +
      (serverProcess && serverProcess._serverLog ? "\n\nServer output:\n" + serverProcess._serverLog() : "");
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.loadURL("data:text/html," + encodeURIComponent(errorHtml("Could not load the app", detail)));
  });
  mainWindow.webContents.on("console-message", (event, level, message) => {
    logError("[page console]", level, message);
  });
  mainWindow.webContents.on("render-process-gone", (event, details) => {
    logError("[render-process-gone]", details.reason);
    if (!shuttingDown && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });
  mainWindow.webContents.on("crashed", (event, killed) => {
    logError("[renderer crashed] killed=", killed);
  });

  mainWindow.on("closed", () => {
    logError("[window closed]");
    mainWindow = null;
  });

  mainWindow.loadURL("data:text/html," + encodeURIComponent(LOADING_HTML));
  reloadWhenReady(port);

  if (isDev) mainWindow.webContents.openDevTools();
}

app.on("second-instance", () => {
  logError("[second-instance] focusing existing window");
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  if (!gotLock) return;

  const port = await findFreePort(DEFAULT_PORT);
  logError("[boot] using port", port);

  serverProcess = startNextServer(port);
  createWindow(port);

  // Heartbeat for diagnostics — tells us whether the process is alive and
  // whether the server/window are still up right before any crash.
  setInterval(() => {
    logError(
      "[heartbeat] window=",
      mainWindow && !mainWindow.isDestroyed() ? "open" : "null",
      "server=",
      serverProcess && serverProcess.exitCode === null && !serverProcess.killed ? "alive" : "down"
    );
  }, 15000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
  });
});

app.on("window-all-closed", () => {
  logError("[window-all-closed]");
  if (serverProcess) serverProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  logError("[before-quit] marking shutdown");
  shuttingDown = true;
  if (serverProcess) serverProcess.kill();
});
