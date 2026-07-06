const fs = require("node:fs");
const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const net = require("node:net");
const { execSync } = require("node:child_process");

const PORT = 3000;
const isDev = !app.isPackaged;

let serverProcess = null;
let mainWindow = null;

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

logError("[load] main.js evaluated; isPackaged=", app.isPackaged, "resourcesPath=", process.resourcesPath);

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

function waitForServer(port, timeoutMs = 45000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const sock = net.connect(port, "127.0.0.1");
      sock.once("connect", () => {
        sock.end();
        resolve();
      });
      sock.once("error", () => {
        sock.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Server did not start in time"));
          return;
        }
        setTimeout(tryConnect, 300);
      });
    };
    tryConnect();
  });
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

function startNextServer() {
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
    PORT: String(PORT),
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
  proc.on("exit", (code, signal) =>
    logError("Server exited code", code, "signal", signal, "log:", serverLog.slice(-2000))
  );

  proc._serverLog = () => serverLog;
  return proc;
}

function createWindow() {
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
    mainWindow.loadURL("data:text/html," + encodeURIComponent(errorHtml("Could not load the app", detail)));
  });
  mainWindow.webContents.on("console-message", (event, level, message) => {
    logError("[page console]", level, message);
  });

  mainWindow.loadURL(`data:text/html,${encodeURIComponent(LOADING_HTML)}`);

  const target = `http://127.0.0.1:${PORT}`;
  const tryLoad = (attempt = 0) => {
    const sock = net.connect(PORT, "127.0.0.1");
    sock.once("connect", () => {
      sock.end();
      mainWindow.loadURL(target).catch((e) => logError("[loadURL error]", e));
    });
    sock.once("error", () => {
      sock.destroy();
      if (attempt < 100) setTimeout(() => tryLoad(attempt + 1), 300);
      else {
        const detail = (serverProcess && serverProcess._serverLog ? serverProcess._serverLog() : "") ||
          "The built-in server did not become reachable on port " + PORT + ".";
        mainWindow.loadURL("data:text/html," + encodeURIComponent(errorHtml("Server failed to start", detail)));
      }
    });
  };
  tryLoad();

  if (isDev) mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  serverProcess = startNextServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) serverProcess.kill();
});
