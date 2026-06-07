import { codexDesktop } from "../../api/codexDesktopClient";
import type { useThreadStore } from "../../stores/thread.store";

type ThreadStore = ReturnType<typeof useThreadStore>;

export type HistoryTitleOverridesRuntimeDeps = {
  threadStore: ThreadStore;
};

export type HistoryTitleOverridesRuntime = {
  refreshThreadTitleOverrides: () => Promise<void>;
};

export function createHistoryTitleOverridesRuntime(
  deps: HistoryTitleOverridesRuntimeDeps
): HistoryTitleOverridesRuntime {
  const { threadStore } = deps;

  const refreshThreadTitleOverrides = async () => {
    try {
      const res = await codexDesktop.history.getThreadTitleOverrides();
      threadStore.applyThreadTitleOverrides(res?.overrides ?? {});
    } catch {
      threadStore.applyThreadTitleOverrides({});
    }
  };

  return { refreshThreadTitleOverrides };
}
