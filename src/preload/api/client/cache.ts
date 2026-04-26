import { type IpcRenderer } from "electron";
import { IPC_CACHE_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createCacheApi(ipcRenderer: IpcRenderer): CodexDesktopApi["cache"] {
  return {
    list: (args) => ipcRenderer.invoke(IPC_CACHE_CHANNELS.cacheList, args),
    clear: (args) => ipcRenderer.invoke(IPC_CACHE_CHANNELS.cacheClear, args),
  } satisfies CodexDesktopApi["cache"];
}

