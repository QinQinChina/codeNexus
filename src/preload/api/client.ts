import { type IpcRenderer } from "electron";
import { type CodexDesktopApi } from "./types";
import { createAppApi } from "./client/app";
import { createCacheApi } from "./client/cache";
import { createCodexServerApi } from "./client/codexServer";
import { createHistoryApi } from "./client/history";
import { createLocalStateApi } from "./client/localState";
import { createRemoteSyncApi } from "./client/remoteSync";
import { createUpdateApi } from "./client/update";
import { createWindowApi } from "./client/window";
import { createWorkspaceApi } from "./client/workspace";

export function createCodexDesktopApi(
  ipcRenderer: IpcRenderer,
  initialLocalSettingsSnapshot: CodexDesktopApi["localState"]["initialSettingsSnapshot"]
): CodexDesktopApi {
  return {
    app: createAppApi(ipcRenderer),
    window: createWindowApi(ipcRenderer),
    localState: createLocalStateApi(ipcRenderer, initialLocalSettingsSnapshot),
    update: createUpdateApi(ipcRenderer),
    remoteSync: createRemoteSyncApi(ipcRenderer),
    cache: createCacheApi(ipcRenderer),
    codexServer: createCodexServerApi(ipcRenderer),
    workspace: createWorkspaceApi(ipcRenderer),
    history: createHistoryApi(ipcRenderer),
  };
}
