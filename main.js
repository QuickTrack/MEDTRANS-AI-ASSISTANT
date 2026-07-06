const fs = require("node:fs");
try {
  fs.writeFileSync("C:\\medtrans-boot.log", "main.js started at " + new Date().toISOString() + "\n");
} catch (e) {
  try { fs.writeFileSync("C:\\medtrans-boot.log", "write fail " + e.message + "\n"); } catch {}
}
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

function waitForServer(port, timeoutMs = 30000) {
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

function startNextServer() {
  const appPath = app.isPackaged ? path.join(process.resourcesPath, "app") : app.getAppPath();

  const standaloneDir = path.join(appPath, ".next", "standalone");
  const serverEntry = path.join(standaloneDir, "server.js");

  logError("[boot] appPath=", appPath);
  logError("[boot] standaloneDir exists=", fs.existsSync(standaloneDir));
  logError("[boot] serverEntry exists=", fs.existsSync(serverEntry));

  let nodeBin = "node";
  try {
    nodeBin = execSync("where node").toString().trim().split("\n")[0];
  } catch {
    nodeBin = "node";
  }
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

  proc.stdout.on("data", (d) => logError("[server stdout]", d.toString()));
  proc.stderr.on("data", (d) => logError("[server stderr]", d.toString()));

  proc.on("error", (err) => logError("Failed to start server:", err));
  proc.on("exit", (code, signal) => logError("Server exited with code", code, "signal", signal));

  return proc;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    logError("[did-fail-load]", errorCode, errorDescription, validatedURL);
  });
  mainWindow.webContents.on("did-finish-load", () => {
    logError("[did-finish-load]");
  });
  mainWindow.webContents.on("console-message", (event, level, message) => {
    logError("[page console]", level, message);
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`).catch((e) => logError("[loadURL error]", e));

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  serverProcess = startNextServer();
  try {
    await waitForServer(PORT);
  } catch (err) {
    logError(err);
  }
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
