import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronDist = path.join(root, "electron-dist");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(root, "release", `win-${stamp}`);
const appDest = path.join(outDir, "resources", "app");

function rm(p) {
  try {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  } catch (e) {
    console.warn(`Could not remove ${p}: ${e.message} (continuing)`);
  }
}
function cp(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

if (!fs.existsSync(electronDist)) {
  console.error("electron-dist not found. Run the electron download first.");
  process.exit(1);
}

rm(outDir);
fs.mkdirSync(path.dirname(appDest), { recursive: true });

console.log("Copying Electron runtime...");
cp(electronDist, outDir);

console.log("Removing default_app.asar (we provide our own app)...");
const defaultApp = path.join(outDir, "resources", "default_app.asar");
if (fs.existsSync(defaultApp)) fs.rmSync(defaultApp, { force: true });

console.log("Copying app files...");
fs.mkdirSync(appDest, { recursive: true });
cp(path.join(root, "electron"), path.join(appDest, "electron"));
cp(path.join(root, "package.json"), path.join(appDest, "package.json"));
const standaloneSrc = path.join(root, ".next", "standalone");
const standaloneDest = path.join(appDest, ".next", "standalone");
cp(standaloneSrc, standaloneDest);

console.log("Copying static assets into standalone...");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standaloneDest, ".next", "static");
if (fs.existsSync(staticSrc)) cp(staticSrc, staticDest);
const publicSrc = path.join(root, "public");
const publicDest = path.join(standaloneDest, "public");
if (fs.existsSync(publicSrc)) cp(publicSrc, publicDest);

console.log("Renaming electron.exe...");
const exeFrom = path.join(outDir, "electron.exe");
const exeTo = path.join(outDir, "MedTrans AI Assistant.exe");
try {
  fs.renameSync(exeFrom, exeTo);
} catch (e) {
  console.warn(`Rename failed (${e.message}); copying instead.`);
  fs.copyFileSync(exeFrom, exeTo);
}

console.log(`Done. Portable app at: ${exeTo}`);
