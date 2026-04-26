import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const nodeExec = process.execPath;
const npmExecPath = process.env.npm_execpath;
const pnpmFallback = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function runPnpm(args) {
  const options = {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  };

  if (npmExecPath) {
    execFileSync(nodeExec, [npmExecPath, ...args], options);
    return;
  }

  execFileSync(pnpmFallback, args, options);
}

runPnpm(["exec", "vite", "build"]);

runPnpm([
  "exec",
  "esbuild",
  "src/main/main.ts",
  "--bundle",
  "--platform=node",
  "--format=cjs",
  "--target=node20",
  "--external:electron",
  "--outfile=dist/main.cjs",
]);

runPnpm([
  "exec",
  "esbuild",
  "src/preload/preload.ts",
  "--bundle",
  "--platform=node",
  "--format=cjs",
  "--target=node20",
  "--external:electron",
  "--outfile=dist/preload.cjs",
]);
