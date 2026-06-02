import { ipcMain } from "electron";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { IPC_WORKSPACE_CHANNELS } from "@codenexus/shared/ipc/channels";
import type {
  WorkspaceGitStatusCode,
  WorkspaceGitStatusEntry,
  WorkspaceGitStatusResult,
} from "@codenexus/shared/ipc/contracts";
import { WorkspacePatchService } from "../../services/WorkspacePatchService";

const execFileAsync = promisify(execFile);

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error ?? "unknown error");
}

function normalizeGitPath(root: string, relativePath: string): string {
  const parts = String(relativePath ?? "")
    .split("/")
    .filter(Boolean);
  return resolve(root, ...parts);
}

function statusCodeFromPorcelain(raw: string): WorkspaceGitStatusCode {
  const status = String(raw ?? "");
  if (status === "??") return "?";
  if (status.includes("U")) return "U";
  if (status.includes("A")) return "A";
  if (status.includes("D")) return "D";
  if (status.includes("R")) return "R";
  if (status.includes("C")) return "C";
  return "M";
}

function parsePorcelainStatus(root: string, output: string): WorkspaceGitStatusEntry[] {
  const tokens = String(output ?? "")
    .split("\0")
    .filter(Boolean);
  const entries: WorkspaceGitStatusEntry[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    if (token.length < 4) continue;
    const raw = token.slice(0, 2);
    const relativePath = token.slice(3);
    if (!relativePath) continue;
    if (raw.includes("R") || raw.includes("C")) index += 1;
    entries.push({
      path: normalizeGitPath(root, relativePath),
      relativePath,
      code: statusCodeFromPorcelain(raw),
      raw,
    });
  }
  return entries;
}

async function readWorkspaceGitStatus(cwd: string): Promise<WorkspaceGitStatusResult> {
  const workspace = resolve(String(cwd ?? "").trim() || ".");
  let root = workspace;
  try {
    const rootResult = await execFileAsync("git", ["-C", workspace, "rev-parse", "--show-toplevel"], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    root = resolve(String(rootResult.stdout ?? "").trim());
  } catch (error) {
    return {
      ok: false,
      root,
      entries: [],
      reason: "not_git",
      message: readErrorMessage(error),
    };
  }

  try {
    const statusResult = await execFileAsync(
      "git",
      ["-C", root, "status", "--porcelain=v1", "-z", "--untracked-files=all"],
      {
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      }
    );
    return {
      ok: true,
      root,
      entries: parsePorcelainStatus(root, String(statusResult.stdout ?? "")),
    };
  } catch (error) {
    return {
      ok: false,
      root,
      entries: [],
      reason: "failed",
      message: readErrorMessage(error),
    };
  }
}

export function registerWorkspaceHandlers(deps: { workspacePatchService: WorkspacePatchService }) {
  const { workspacePatchService } = deps;

  ipcMain.handle(
    IPC_WORKSPACE_CHANNELS.workspaceReverseDiffDryRun,
    async (_evt, args: { cwd: string; diffText: string }) => {
      // 仅校验补丁是否可逆应用，不修改文件。
      return await workspacePatchService.dryRunApplyReverseDiff(args);
    }
  );

  ipcMain.handle(
    IPC_WORKSPACE_CHANNELS.workspaceReverseDiffApply,
    async (_evt, args: { cwd: string; diffText: string }) => {
      // 正式执行反向补丁，回退工作区文件内容。
      return await workspacePatchService.applyReverseDiff(args);
    }
  );

  ipcMain.handle(IPC_WORKSPACE_CHANNELS.workspaceGitStatusRead, async (_evt, args: { cwd: string }) => {
    return await readWorkspaceGitStatus(args?.cwd ?? "");
  });
}
