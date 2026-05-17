import { type IpcRenderer } from "electron";
import { IPC_APP_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createWindowApi(ipcRenderer: IpcRenderer): CodexDesktopApi["window"] {
  return {
    // 窗口状态：提供当前最小化/最大化/全屏信息。
    getState: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appWindowGetState),
    // 最小化：交给主进程处理窗口行为。
    minimize: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appWindowMinimize),
    // 切换最大化：在正常与最大化之间来回切换。
    toggleMaximize: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appWindowToggleMaximize),
    // 关闭窗口：走主进程的关闭流程，保留清理逻辑。
    close: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appWindowClose),
    // 监听窗口状态变化：用于同步标题栏和文档数据属性。
    onState: (cb) => {
      const listener = (_evt: unknown, payload: any) => cb(payload);
      ipcRenderer.on(IPC_APP_CHANNELS.appWindowState, listener);
      return () => ipcRenderer.off(IPC_APP_CHANNELS.appWindowState, listener);
    },
    // 监听关闭流程状态：用于显示收尾遮罩与步骤进度。
    onClosingState: (cb) => {
      const listener = (_evt: unknown, payload: any) => cb(payload);
      ipcRenderer.on(IPC_APP_CHANNELS.appWindowClosingState, listener);
      return () => ipcRenderer.off(IPC_APP_CHANNELS.appWindowClosingState, listener);
    },
  } satisfies CodexDesktopApi["window"];
}
