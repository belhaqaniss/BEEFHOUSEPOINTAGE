import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const node = process.execPath;
const vite = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const backend = fileURLToPath(new URL("./index.js", import.meta.url));
const api = spawn(node, [backend], { stdio: "inherit" });
const web = spawn(node, [vite], { stdio: "inherit" });

let stopping = false;
const stopChild = child => {
  if (!child.pid || child.killed) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // Le processus était déjà arrêté.
    }
  } else {
    child.kill("SIGTERM");
  }
};

const stop = () => {
  if (stopping) return;
  stopping = true;
  stopChild(api);
  stopChild(web);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
api.on("exit", code => { if (code && !stopping) { process.exitCode = code; stop(); } });
web.on("exit", code => { if (code && !stopping) { process.exitCode = code; stop(); } });
