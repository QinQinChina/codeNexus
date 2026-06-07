import { codexDesktop } from "../../api/codexDesktopClient";
import type { Thread as ServerThread } from "@codenexus/generated/codex-app-server/v2/Thread";
import type { ThreadReadParams } from "@codenexus/generated/codex-app-server/v2/ThreadReadParams";

export type ThreadReadRuntimeDeps = {
  getWorkspaceForThread: (threadId: string) => string;
  ensureServerForWorkspace: (workspacePath: string) => Promise<string>;
};

export type ThreadReadRuntime = {
  requestThreadRead: (threadId: string) => Promise<ServerThread>;
  ensureServerForThread: (threadId: string) => Promise<string>;
};

export function createThreadReadRuntime(deps: ThreadReadRuntimeDeps): ThreadReadRuntime {
  const { getWorkspaceForThread, ensureServerForWorkspace } = deps;

  const requestThreadRead = async (threadIdValue: string): Promise<ServerThread> => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) throw new Error("missing thread id");
    const workspace = getWorkspaceForThread(threadId);
    const serverId = await ensureServerForWorkspace(workspace);
    if (!serverId) throw new Error("server not running");
    const params: ThreadReadParams = { threadId, includeTurns: true };
    const res = await codexDesktop.codexServer.rpc({
      serverId,
      method: "thread/read",
      params,
    });
    return res.result.thread;
  };

  const ensureServerForThread = async (threadIdValue: string) => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return "";
    const workspace = getWorkspaceForThread(threadId);
    const serverId = await ensureServerForWorkspace(workspace);
    return serverId || "";
  };

  return { requestThreadRead, ensureServerForThread };
}
