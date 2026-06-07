import { codexDesktop } from "../../api/codexDesktopClient";
import type { ThreadGoalSetParams } from "@codenexus/generated/codex-app-server/v2/ThreadGoalSetParams";
import type { useGoalShutdownStore } from "../../stores/goalShutdown.store";
import type { useRuntimeStore } from "../../stores/runtime.store";
import type { useThreadStore } from "../../stores/thread.store";
import type { ThreadGoalState } from "../types";

type RuntimeStore = ReturnType<typeof useRuntimeStore>;
type ThreadStore = ReturnType<typeof useThreadStore>;
type GoalShutdownStore = ReturnType<typeof useGoalShutdownStore>;
type ToastKind = "info" | "success" | "warn" | "error";

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;
type ShowToast = (options: { kind?: ToastKind; title?: string; message: string }) => void;

export type ThreadGoalRuntimeDeps = {
  appTimelineId: string;
  runtimeStore: RuntimeStore;
  threadStore: ThreadStore;
  goalShutdownStore: GoalShutdownStore;
  ensureServerForThread: (threadId: string) => Promise<string>;
  translate: TranslateFn;
  showToast: ShowToast;
};

export type ThreadGoalRuntime = {
  refreshThreadGoal: (threadId?: string) => Promise<ThreadGoalState | null>;
  promptAndSetCurrentThreadGoal: () => Promise<ThreadGoalState | null>;
  setCurrentThreadGoal: (args: {
    objective: string;
    tokenBudget?: number | null;
    shutdownOnComplete?: boolean;
  }) => Promise<ThreadGoalState | null>;
  completeCurrentThreadGoal: () => Promise<ThreadGoalState | null>;
  clearCurrentThreadGoal: () => Promise<boolean>;
};

async function promptGoalModalLazy(options: Parameters<(typeof import("../../ui/modal"))["promptGoalModal"]>[0]) {
  const { promptGoalModal } = await import("../../ui/modal");
  return promptGoalModal(options);
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error ?? "");
}

function normalizeGoalBudget(value: unknown): number | null {
  if (value == null || value === "") return null;
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw);
}

export function createThreadGoalRuntime(deps: ThreadGoalRuntimeDeps): ThreadGoalRuntime {
  const { appTimelineId, runtimeStore, threadStore, goalShutdownStore, ensureServerForThread, translate, showToast } =
    deps;

  const getCurrentThreadIdOrToast = () => {
    const threadId = String(runtimeStore.currentThreadId ?? "").trim();
    if (threadId) return threadId;
    showToast({
      kind: "warn",
      title: translate("runtime.goalNoThreadTitle"),
      message: translate("runtime.goalNoThreadMessage"),
    });
    return "";
  };

  const refreshThreadGoal = async (threadIdValue?: string): Promise<ThreadGoalState | null> => {
    const threadId = String(threadIdValue ?? runtimeStore.currentThreadId ?? "").trim();
    if (!threadId || threadId === appTimelineId) return null;
    try {
      const serverId = await ensureServerForThread(threadId);
      if (!serverId) return null;
      const { result } = await codexDesktop.codexServer.rpc({
        serverId,
        method: "thread/goal/get",
        params: { threadId },
      });
      const goal = result.goal ?? null;
      if (goal) threadStore.setThreadGoal(threadId, goal);
      else threadStore.clearThreadGoal(threadId);
      return threadStore.goalByThread.get(threadId) ?? null;
    } catch (e: unknown) {
      const msg = readErrorMessage(e);
      console.warn("[runtimeOrchestrator] thread goal refresh failed", { threadId, msg });
      return threadStore.goalByThread.get(threadId) ?? null;
    }
  };

  const setCurrentThreadGoal = async (args: {
    objective: string;
    tokenBudget?: number | null;
    shutdownOnComplete?: boolean;
  }): Promise<ThreadGoalState | null> => {
    const threadId = getCurrentThreadIdOrToast();
    if (!threadId) return null;
    const objective = String(args.objective ?? "").trim();
    if (!objective) {
      showToast({
        kind: "warn",
        title: translate("runtime.goalObjectiveRequiredTitle"),
        message: translate("runtime.goalObjectiveRequiredMessage"),
      });
      return null;
    }
    try {
      const serverId = await ensureServerForThread(threadId);
      if (!serverId) throw new Error(translate("runtime.currentThreadNoService"));
      const params: ThreadGoalSetParams = {
        threadId,
        objective,
        status: "active",
        tokenBudget: normalizeGoalBudget(args.tokenBudget),
      };
      const { result } = await codexDesktop.codexServer.rpc({
        serverId,
        method: "thread/goal/set",
        params,
      });
      const previous = threadStore.goalByThread.get(threadId) ?? null;
      threadStore.setThreadGoal(threadId, result.goal);
      const savedGoal = threadStore.goalByThread.get(threadId) ?? null;
      if (savedGoal) {
        await goalShutdownStore.configureGoal(savedGoal, Boolean(args.shutdownOnComplete));
        goalShutdownStore.observeGoalTransition(previous, savedGoal);
      }
      showToast({
        kind: "success",
        title: translate("runtime.goalSavedTitle"),
        message: translate("runtime.goalSavedMessage"),
      });
      return threadStore.goalByThread.get(threadId) ?? null;
    } catch (e: unknown) {
      const msg = readErrorMessage(e);
      showToast({ kind: "error", title: translate("runtime.goalSaveFailedTitle"), message: msg });
      return null;
    }
  };

  const promptAndSetCurrentThreadGoal = async (): Promise<ThreadGoalState | null> => {
    const threadId = getCurrentThreadIdOrToast();
    if (!threadId) return null;
    const existing = threadStore.goalByThread.get(threadId) ?? (await refreshThreadGoal(threadId));
    let draft: { objective: string; tokenBudget: number | null } | null = null;
    try {
      draft = await promptGoalModalLazy({
        title: translate(existing ? "runtime.goalUpdateTitle" : "runtime.goalCreateTitle"),
        message: translate("runtime.goalModalMessage"),
        objectiveLabel: translate("runtime.goalObjectiveLabel"),
        budgetLabel: translate("runtime.goalBudgetLabel"),
        budgetHint: translate("runtime.goalBudgetHint"),
        confirmText: translate(existing ? "runtime.goalUpdateConfirm" : "runtime.goalCreateConfirm"),
        defaultObjective: existing?.objective ?? "",
        defaultTokenBudget: existing?.tokenBudget ?? null,
        shutdownOnCompleteLabel: translate("runtime.goalShutdownOnCompleteLabel"),
        shutdownOnCompleteHint: translate("runtime.goalShutdownOnCompleteHint"),
        defaultShutdownOnComplete: goalShutdownStore.isEnabledForGoal(existing),
      });
    } catch (e: unknown) {
      showToast({
        kind: "error",
        title: translate("runtime.goalModalOpenFailedTitle"),
        message: readErrorMessage(e),
      });
      return null;
    }
    if (!draft) return null;
    return await setCurrentThreadGoal(draft);
  };

  const completeCurrentThreadGoal = async (): Promise<ThreadGoalState | null> => {
    const threadId = getCurrentThreadIdOrToast();
    if (!threadId) return null;
    const existing = threadStore.goalByThread.get(threadId) ?? (await refreshThreadGoal(threadId));
    if (!existing) {
      showToast({
        kind: "warn",
        title: translate("runtime.goalMissingTitle"),
        message: translate("runtime.goalMissingMessage"),
      });
      return null;
    }
    try {
      const serverId = await ensureServerForThread(threadId);
      if (!serverId) throw new Error(translate("runtime.currentThreadNoService"));
      const { result } = await codexDesktop.codexServer.rpc({
        serverId,
        method: "thread/goal/set",
        params: { threadId, status: "complete" },
      });
      const previous = threadStore.goalByThread.get(threadId) ?? null;
      threadStore.setThreadGoal(threadId, result.goal);
      goalShutdownStore.observeGoalTransition(previous, threadStore.goalByThread.get(threadId) ?? null);
      showToast({
        kind: "success",
        title: translate("runtime.goalCompletedTitle"),
        message: translate("runtime.goalCompletedMessage"),
      });
      return threadStore.goalByThread.get(threadId) ?? null;
    } catch (e: unknown) {
      const msg = readErrorMessage(e);
      showToast({ kind: "error", title: translate("runtime.goalCompleteFailedTitle"), message: msg });
      return null;
    }
  };

  const clearCurrentThreadGoal = async (): Promise<boolean> => {
    const threadId = getCurrentThreadIdOrToast();
    if (!threadId) return false;
    try {
      const serverId = await ensureServerForThread(threadId);
      if (!serverId) throw new Error(translate("runtime.currentThreadNoService"));
      const { result } = await codexDesktop.codexServer.rpc({
        serverId,
        method: "thread/goal/clear",
        params: { threadId },
      });
      threadStore.clearThreadGoal(threadId);
      showToast({
        kind: "success",
        title: translate("runtime.goalClearedTitle"),
        message: result.cleared
          ? translate("runtime.goalClearedMessage")
          : translate("runtime.goalAlreadyClearMessage"),
      });
      return Boolean(result.cleared);
    } catch (e: unknown) {
      const msg = readErrorMessage(e);
      showToast({ kind: "error", title: translate("runtime.goalClearFailedTitle"), message: msg });
      return false;
    }
  };

  return {
    refreshThreadGoal,
    promptAndSetCurrentThreadGoal,
    setCurrentThreadGoal,
    completeCurrentThreadGoal,
    clearCurrentThreadGoal,
  };
}
