import { spawn, spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const nodeExec = process.execPath;
const npmExecPath = process.env.npm_execpath ? String(process.env.npm_execpath).trim() : "";

const viteHost = "127.0.0.1";
const vitePort = "5173";
const viteUrl = `http://${viteHost}:${vitePort}`;
const smokeMode = process.argv.includes("--smoke");

const children = [];
let shuttingDown = false;

function spawnPnpm(args, options = {}) {
  const name = options.name ?? args.join(" ");
  const child = spawnByPlatform(args, options);

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const suffix = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[dev] ${name} exited with ${suffix}`);
    void shutdown(1, `${name} exited`);
  });

  child.on("error", (error) => {
    if (shuttingDown) return;
    console.error(`[dev] ${name} failed to start: ${error.message}`);
    void shutdown(1, `${name} failed to start`);
  });

  children.push(child);
  return child;
}

function spawnByPlatform(args, options = {}) {
  const env = { ...process.env, ...(options.env ?? {}) };

  if (npmExecPath) {
    return spawn(nodeExec, [npmExecPath, ...args], {
      cwd: projectRoot,
      stdio: "inherit",
      env,
      shell: false,
    });
  }

  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", buildPnpmCommand(args)], {
      cwd: projectRoot,
      stdio: "inherit",
      env,
      shell: false,
      windowsHide: true,
    });
  }

  return spawn("pnpm", args, {
    cwd: projectRoot,
    stdio: "inherit",
    env,
    shell: false,
  });
}

function buildPnpmCommand(args) {
  return `pnpm ${args.map((arg) => quoteCmdArg(arg)).join(" ")}`;
}

function quoteCmdArg(arg) {
  const text = String(arg ?? "");
  if (!text) return '""';
  if (!/[\s"]/u.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function killChildTree(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    const pid = Number(child.pid);
    if (!Number.isFinite(pid) || pid <= 0) return;
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

async function waitForFile(path, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await access(path);
      return;
    } catch {
      /* ignore */
    }
    await delay(200);
  }
  throw new Error(`timed out waiting for ${path}`);
}

async function waitForHttpReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok || response.status >= 400) return;
    } catch {
      /* ignore */
    }
    await delay(300);
  }
  throw new Error(`timed out waiting for dev server: ${url}`);
}

async function waitForBootstrap() {
  await Promise.all([
    waitForFile(resolve(projectRoot, "dist/main.cjs"), 30_000),
    waitForFile(resolve(projectRoot, "dist/preload.cjs"), 30_000),
    waitForHttpReady(viteUrl, 45_000),
  ]);
}

async function shutdown(exitCode = 0, reason = "unknown") {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`[dev] shutting down (exitCode=${exitCode}, reason=${reason})`);

  for (const child of children) {
    killChildTree(child);
  }

  await delay(250);

  for (const child of children) {
    killChildTree(child);
  }

  process.exit(exitCode);
}

function bindShutdownSignals() {
  const handler = (signal) => {
    void shutdown(0, `signal:${signal}`);
  };
  process.on("SIGINT", () => handler("SIGINT"));
  process.on("SIGTERM", () => handler("SIGTERM"));
  process.on("SIGHUP", () => handler("SIGHUP"));

  process.on("uncaughtException", (error) => {
    console.error("[dev] uncaught exception", error);
    void shutdown(1, "uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[dev] unhandled rejection", reason);
    void shutdown(1, "unhandledRejection");
  });
}

async function start() {
  bindShutdownSignals();
  console.info(`[dev] starting vite + esbuild watchers${smokeMode ? " (smoke)" : ""}...`);

  spawnPnpm(["exec", "vite", "--host", viteHost, "--port", vitePort, "--strictPort"], { name: "vite" });

  spawnPnpm(
    [
      "exec",
      "esbuild",
      "src/main/main.ts",
      "--bundle",
      "--platform=node",
      "--format=cjs",
      "--target=node20",
      "--external:electron",
      "--outfile=dist/main.cjs",
      "--sourcemap",
      "--watch=forever",
    ],
    { name: "main-esbuild" }
  );

  spawnPnpm(
    [
      "exec",
      "esbuild",
      "src/preload/preload.ts",
      "--bundle",
      "--platform=node",
      "--format=cjs",
      "--target=node20",
      "--external:electron",
      "--outfile=dist/preload.cjs",
      "--sourcemap",
      "--watch=forever",
    ],
    { name: "preload-esbuild" }
  );

  await waitForBootstrap();
  console.info(`[dev] bootstrap ready: ${viteUrl}`);

  if (smokeMode) {
    console.info("[dev] smoke check passed");
    await shutdown(0, "smokeMode");
    return;
  }

  spawnPnpm(["exec", "electron", "."], {
    name: "electron",
    env: { VITE_DEV_SERVER_URL: viteUrl },
  });
  console.info("[dev] electron launched");
}

void start().catch((error) => {
  console.error(`[dev] startup failed: ${error.message}`);
  void shutdown(1, "startup failed");
});
