import { type IpcRenderer } from "electron";
import { IPC_APP_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createRemoteSyncApi(ipcRenderer: IpcRenderer): CodexDesktopApi["remoteSync"] {
  return {
    getState: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appRemoteSyncGetState),
    login: (args) => ipcRenderer.invoke(IPC_APP_CHANNELS.appRemoteSyncLogin, args),
    logout: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appRemoteSyncLogout),
    flush: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appRemoteSyncFlush),
    onState: (cb) => {
      const listener = (_evt: unknown, payload: any) => cb(payload);
      ipcRenderer.on(IPC_APP_CHANNELS.appRemoteSyncState, listener);
      return () => ipcRenderer.off(IPC_APP_CHANNELS.appRemoteSyncState, listener);
    },
  } satisfies CodexDesktopApi["remoteSync"];
}
