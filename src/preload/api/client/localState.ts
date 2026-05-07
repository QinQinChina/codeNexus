import { type IpcRenderer } from "electron";
import { IPC_APP_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createLocalStateApi(
  ipcRenderer: IpcRenderer,
  initialLocalSettingsSnapshot: CodexDesktopApi["localState"]["initialSettingsSnapshot"]
): CodexDesktopApi["localState"] {
  return {
    initialSettingsSnapshot: initialLocalSettingsSnapshot,
    readSettings: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appLocalSettingsRead),
    patchSettings: (args) => ipcRenderer.invoke(IPC_APP_CHANNELS.appLocalSettingsPatch, args),
  } satisfies CodexDesktopApi["localState"];
}
