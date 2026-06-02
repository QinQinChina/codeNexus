import { codexDesktop } from "../../api/codexDesktopClient";
import type { ThreadMemoryMode } from "@codenexus/generated/codex-app-server/ThreadMemoryMode";
import type { useRuntimeStore } from "../../stores/runtime.store";

type RuntimeStore = ReturnType<typeof useRuntimeStore>;
type RuntimeEventLevel = "info" | "warn" | "error";
type ToastKind = "info" | "success" | "warn" | "error";

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;
type PushEvent = (method: string, paramsText: string, opts?: { threadId?: string; level?: RuntimeEventLevel }) => void;
type ShowToast = (options: { kind?: ToastKind; title?: string; message: string }) => void;

export type ThreadMemoryRuntimeDeps = {
  appTimelineId: string;
  runtimeStore: RuntimeStore;
  getServerIdForWorkspace: (workspacePath: string) => string;
  getServerIdForThread: (threadId: string) => string;
  pushEvent: PushEvent;
  translate: TranslateFn;
  showToast: ShowToast;
};

export type ThreadMemoryRuntime = {
  resetCodexMemory: () => Promise<void>;
  setCurrentThreadMemoryMode: (mode: ThreadMemoryMode) => Promise<void>;
};

export function createThreadMemoryRuntime(deps: ThreadMemoryRuntimeDeps): ThreadMemoryRuntime {
  const { appTimelineId, runtimeStore, getServerIdForWorkspace, getServerIdForThread, pushEvent, translate, showToast } = deps;

  const resetCodexMemory = async () => {
    const serverId = getServerIdForWorkspace(runtimeStore.workspacePath);
    if (!serverId) {
      showToast({
        kind: "warn",
        title: translate("runtime.cannotResetMemoryTitle"),
        message: translate("runtime.currentlyNoCodexService"),
      });
      return;
    }
    try {
      await codexDesktop.codexServer.rpc({ serverId, method: "memory/reset" });
      showToast({
        kind: "success",
        title: translate("runtime.memoryResetTitle"),
        message: translate("runtime.memoryResetMessage"),
      });
      pushEvent("memory/reset", "Codex memory reset", { threadId: runtimeStore.currentThreadId || appTimelineId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message || e.name : String(e ?? "");
      showToast({
        kind: "error",
        title: translate("runtime.memoryResetFailedTitle"),
        message: msg || "memory/reset failed",
      });
      pushEvent("memory/reset:error", msg || "memory/reset failed", {
        threadId: runtimeStore.currentThreadId || appTimelineId,
        level: "error",
      });
    }
  };

  const setCurrentThreadMemoryMode = async (mode: ThreadMemoryMode) => {
    const threadId = String(runtimeStore.currentThreadId ?? "").trim();
    if (!threadId) {
      showToast({
        kind: "warn",
        title: translate("runtime.cannotSetMemoryTitle"),
        message: translate("runtime.selectThreadFirst"),
      });
      return;
    }
    const serverId = getServerIdForThread(threadId);
    if (!serverId) {
      showToast({
        kind: "warn",
        title: translate("runtime.cannotSetMemoryTitle"),
        message: translate("runtime.currentThreadNoService"),
      });
      return;
    }
    try {
      await codexDesktop.codexServer.rpc({ serverId, method: "thread/memoryMode/set", params: { threadId, mode } });
      const enabled = mode === "enabled";
      showToast({
        kind: "success",
        title: enabled ? translate("runtime.threadMemoryEnabledTitle") : translate("runtime.threadMemoryDisabledTitle"),
        message: enabled
          ? translate("runtime.threadMemoryEnabledMessage")
          : translate("runtime.threadMemoryDisabledMessage"),
      });
      pushEvent("memory/mode", `thread memory mode: ${mode}`, { threadId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message || e.name : String(e ?? "");
      showToast({
        kind: "error",
        title: translate("runtime.memoryModeSetFailedTitle"),
        message: msg || "thread/memoryMode/set failed",
      });
      pushEvent("memory/mode:error", msg || "thread/memoryMode/set failed", { threadId, level: "error" });
    }
  };

  return { resetCodexMemory, setCurrentThreadMemoryMode };
}