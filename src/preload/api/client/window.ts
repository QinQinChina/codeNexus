import { type IpcRenderer } from "electron";
import { IPC_APP_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createWindowApi(ipcRenderer: IpcRenderer): CodexDesktopApi["window"] {
  return {
    getState: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appWindowGetState),
    minimize: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appWindowMinimize),
    toggleMaximize: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appWindowToggleMaximize),
    close: async () => {
      ipcRenderer.send(IPC_APP_CHANNELS.appWindowClose);
      return { ok: true as const };
    },
    onState: (cb) => {
      const listener = (_evt: unknown, payload: any) => cb(payload);
      ipcRenderer.on(IPC_APP_CHANNELS.appWindowState, listener);
      return () => ipcRenderer.off(IPC_APP_CHANNELS.appWindowState, listener);
    },
    onClosingState: (cb) => {
      const listener = (_evt: unknown, payload: any) => cb(payload);
      ipcRenderer.on(IPC_APP_CHANNELS.appWindowClosingState, listener);
      return () => ipcRenderer.off(IPC_APP_CHANNELS.appWindowClosingState, listener);
    },
  } satisfies CodexDesktopApi["window"];
}

