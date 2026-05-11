import { type IpcRenderer } from "electron";
import { IPC_APP_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createRemoteSyncApi(ipcRenderer: IpcRenderer): CodexDesktopApi["remoteSync"] {
  return {
    // 远程同步状态：查询当前登录、队列和同步情况。
    getState: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appRemoteSyncGetState),
    // 登录/登出：切换远程同步身份。
    login: (args) => ipcRenderer.invoke(IPC_APP_CHANNELS.appRemoteSyncLogin, args),
    logout: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appRemoteSyncLogout),
    // 队列刷新：把本地待同步内容尽快推送出去。
    flush: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appRemoteSyncFlush),
    // 监听同步状态变化：用于刷新设置页或状态栏。
    onState: (cb) => {
      const listener = (_evt: unknown, payload: any) => cb(payload);
      ipcRenderer.on(IPC_APP_CHANNELS.appRemoteSyncState, listener);
      return () => ipcRenderer.off(IPC_APP_CHANNELS.appRemoteSyncState, listener);
    },
  } satisfies CodexDesktopApi["remoteSync"];
}
