import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function detectCodexNative(): { ok: boolean; details?: string } {
  // 在 Windows 环境通过 where.exe 检查 codex 是否已加入 PATH。
  const res = spawnSync("where.exe", ["codex"], { encoding: "utf8" });
  if (res.status === 0) return { ok: true, details: res.stdout.trim() };

  // 兜底：如果 codex 是通过 npm -g 安装但 PATH 尚未生效，尝试从默认前缀推断位置。
  // 注意：这不是严格保证，只是尽量减少误报。
  const appData = String(process.env.APPDATA || "").trim();
  if (appData) {
    const candidate = join(appData, "npm", "codex.cmd");
    if (existsSync(candidate)) return { ok: true, details: candidate };
  }

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
