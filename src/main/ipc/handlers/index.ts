import { BrowserWindow } from "electron";
import type { CodexIncomingMessage } from "../../../shared/codex-protocol";
import { CodexServerManager } from "../../services/CodexServerManager";
import { type HistoryThread } from "../../historyStore";
import { HistoryService } from "../../services/HistoryService";
import type { LocalSettingsService } from "../../services/LocalSettingsService";
import type { ThreadArtifactService } from "../../services/ThreadArtifactService";
import type { ThreadTaskService } from "../../services/ThreadTaskService";
import type { ThreadTitleOverrideService } from "../../services/ThreadTitleOverrideService";
import { WorkspacePatchService } from "../../services/WorkspacePatchService";
import { registerAppHandlers } from "./app.handlers";
import { registerCacheHandlers } from "./cache.handlers";
import { registerCodexHandlers } from "./codex.handlers";
import { registerHistoryHandlers } from "./history.handlers";
import { registerWorkspaceHandlers } from "./workspace.handlers";
import type { RemoteStateSyncService } from "../../services/RemoteStateSyncService";
import { UpdateService } from "../../services/UpdateService";
import { CacheRegistryService } from "../../services/CacheRegistryService";
import type { HistoryThreadRunningStateResult } from "../../../shared/ipc/contracts";

export type IpcHandlersDeps = {
  getMainWindow: () => BrowserWindow | null;
  serverManager: CodexServerManager;
  sendCodexEvent: (payload: { serverId: string; msg: CodexIncomingMessage }) => void;
  historyService: HistoryService;
  threadTaskService: ThreadTaskService;
  threadArtifactService: ThreadArtifactService;
  threadTitleOverrideService: ThreadTitleOverrideService;
  onHistoryUpdated: (items: HistoryThread[]) => void;
  decorateHistoryItems: (items: HistoryThread[]) => HistoryThread[];
  onHistoryThreadDeleted: (threadId: string) => void;
  getThreadRunningState: (threadId: string) => HistoryThreadRunningStateResult;
  workspacePatchService: WorkspacePatchService;
  localSettingsService: LocalSettingsService;
  remoteSyncService: RemoteStateSyncService;
  cacheRegistryService: CacheRegistryService;
  updateService: UpdateService;
};

export function registerAllHandlers(deps: IpcHandlersDeps) {
  registerAppHandlers({
    getMainWindow: deps.getMainWindow,
    localSettingsService: deps.localSettingsService,
    remoteSyncService: deps.remoteSyncService,
    updateService: deps.updateService,
  });
  registerCodexHandlers({ serverManager: deps.serverManager, sendEvent: deps.sendCodexEvent });
  registerCacheHandlers({ cacheRegistryService: deps.cacheRegistryService });
  registerHistoryHandlers({
    historyService: deps.historyService,
    threadTaskService: deps.threadTaskService,
    threadArtifactService: deps.threadArtifactService,
    threadTitleOverrideService: deps.threadTitleOverrideService,
    onUpdated: deps.onHistoryUpdated,
    decorateItems: deps.decorateHistoryItems,
    onThreadDeleted: deps.onHistoryThreadDeleted,
  });
  registerWorkspaceHandlers({ workspacePatchService: deps.workspacePatchService });
}
