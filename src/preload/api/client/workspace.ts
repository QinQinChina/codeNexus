import { type IpcRenderer } from "electron";
import { IPC_APP_CHANNELS, IPC_WORKSPACE_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createWorkspaceApi(ipcRenderer: IpcRenderer): CodexDesktopApi["workspace"] {
  return {
    select: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appSelectWorkspace),
    dryRunApplyReverseDiff: (args) => ipcRenderer.invoke(IPC_WORKSPACE_CHANNELS.workspaceReverseDiffDryRun, args),
    applyReverseDiff: (args) => ipcRenderer.invoke(IPC_WORKSPACE_CHANNELS.workspaceReverseDiffApply, args),
  } satisfies CodexDesktopApi["workspace"];
}
