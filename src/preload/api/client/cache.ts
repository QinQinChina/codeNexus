import { type IpcRenderer } from "electron";
import { IPC_CACHE_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createCacheApi(ipcRenderer: IpcRenderer): CodexDesktopApi["cache"] {
  return {
    // 缓存列表：给设置页或诊断页展示当前缓存占用。
    list: (args) => ipcRenderer.invoke(IPC_CACHE_CHANNELS.cacheList, args),
    // 清理缓存：由主进程统一执行，避免渲染层直接碰文件系统。
    clear: (args) => ipcRenderer.invoke(IPC_CACHE_CHANNELS.cacheClear, args),
  } satisfies CodexDesktopApi["cache"];
}
