import { type IpcRenderer } from "electron";
import { IPC_APP_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createLocalStateApi(
  ipcRenderer: IpcRenderer,
  initialLocalSettingsSnapshot: CodexDesktopApi["localState"]["initialSettingsSnapshot"]
): CodexDesktopApi["localState"] {
  return {
    // 首屏设置快照：渲染层启动时直接读取，减少一次 IPC 往返。
    initialSettingsSnapshot: initialLocalSettingsSnapshot,
    // 本地设置读取：获取用户当前保存的配置。
    readSettings: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appLocalSettingsRead),
    // 本地设置补丁：按字段增量更新配置。
    patchSettings: (args) => ipcRenderer.invoke(IPC_APP_CHANNELS.appLocalSettingsPatch, args),
  } satisfies CodexDesktopApi["localState"];
}
