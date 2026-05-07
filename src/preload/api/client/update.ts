import { type IpcRenderer } from "electron";
import { IPC_APP_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createUpdateApi(ipcRenderer: IpcRenderer): CodexDesktopApi["update"] {
  return {
    getState: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appUpdateGetState),
    check: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appUpdateCheck),
    download: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appUpdateDownload),
    restartToInstall: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appUpdateRestartToInstall),
    onState: (cb) => {
      const listener = (_evt: unknown, payload: any) => cb(payload);
      ipcRenderer.on(IPC_APP_CHANNELS.appUpdateState, listener);
      return () => ipcRenderer.off(IPC_APP_CHANNELS.appUpdateState, listener);
    },
  } satisfies CodexDesktopApi["update"];
}
