import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { discoverExistingCodexPaths } from "./codexNativeDiscovery";

export function detectCodexNative(): { ok: boolean; details?: string } {
  // 在 Windows 环境通过 where.exe 检查 codex 是否已加入 PATH。
  const res = spawnSync("where.exe", ["codex"], { encoding: "utf8" });
  const paths = discoverExistingCodexPaths({
    whereStdout: res.stdout,
    appData: process.env.APPDATA,
    exists: existsSync,
  });
  if (paths.length > 0) return { ok: true, details: paths.join("\n") };

  return { ok: false, details: (res.stderr || res.stdout || "").trim() };
}

export function detectNpmNative(): { ok: boolean; details?: string } {
  // npm 通常随 Node.js 安装提供。
  const res = spawnSync("where.exe", ["npm"], { encoding: "utf8" });
  if (res.status === 0) return { ok: true, details: res.stdout.trim() };
  return { ok: false, details: (res.stderr || res.stdout || "").trim() };
}

export function detectNodeNative(): { ok: boolean; details?: string } {
  const res = spawnSync("where.exe", ["node"], { encoding: "utf8" });
  if (res.status === 0) return { ok: true, details: res.stdout.trim() };
  return { ok: false, details: (res.stderr || res.stdout || "").trim() };
}
