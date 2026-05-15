import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneSource = path.join(root, ".next", "standalone");
const staticSource = path.join(root, ".next", "static");
const appResources = path.join(
  root,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "macos",
  "Browhere.app",
  "Contents",
  "Resources",
);
const standaloneTarget = path.join(appResources, ".next", "standalone");
const staticTarget = path.join(standaloneTarget, ".next", "static");

if (!fs.existsSync(standaloneSource)) {
  throw new Error("Missing .next/standalone. Run `npm run build` before packaging the Tauri app.");
}

if (!fs.existsSync(appResources)) {
  throw new Error("Missing Browhere.app resources directory. Run `tauri build` before packaging the Next runtime.");
}

fs.rmSync(path.join(appResources, ".next"), { recursive: true, force: true });
fs.mkdirSync(path.dirname(standaloneTarget), { recursive: true });
fs.cpSync(standaloneSource, standaloneTarget, { recursive: true });

if (fs.existsSync(staticSource)) {
  fs.mkdirSync(path.dirname(staticTarget), { recursive: true });
  fs.cpSync(staticSource, staticTarget, { recursive: true });
}

const serverPath = path.join(standaloneTarget, "server.js");
if (!fs.existsSync(serverPath)) {
  throw new Error(`Packaged runtime is missing ${serverPath}`);
}

console.log(`Packaged Next runtime into ${standaloneTarget}`);
