import { type IpcRenderer } from "electron";
import { IPC_APP_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createAppApi(ipcRenderer: IpcRenderer): CodexDesktopApi["app"] {
  return {
    openExternal: (args) => ipcRenderer.invoke(IPC_APP_CHANNELS.appOpenExternal, args),
    readTextFile: (args) => ipcRenderer.invoke(IPC_APP_CHANNELS.appReadTextFile, args),
    writeTextFile: (args) => ipcRenderer.invoke(IPC_APP_CHANNELS.appWriteTextFile, args),
    readDirectory: (args) => ipcRenderer.invoke(IPC_APP_CHANNELS.appReadDirectory, args),
    getFileMetadata: (args) => ipcRenderer.invoke(IPC_APP_CHANNELS.appGetFileMetadata, args),
    listNotificationSounds: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appListNotificationSounds),
    readNotificationSoundDataUrl: (args) => ipcRenderer.invoke(IPC_APP_CHANNELS.appReadNotificationSoundDataUrl, args),
    showSystemNotification: (args) => ipcRenderer.invoke(IPC_APP_CHANNELS.appSystemNotificationShow, args),
    appendFileChangeLog: (args) => ipcRenderer.invoke(IPC_APP_CHANNELS.appFileChangeLogAppend, args),
    readClipboardImageDataUrl: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appReadClipboardImageDataUrl),
    readImageFileDataUrl: (args) => ipcRenderer.invoke(IPC_APP_CHANNELS.appReadImageFileDataUrl, args),
    importBackgroundImage: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appImportBackgroundImage),
    clearBackgroundImage: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appClearBackgroundImage),
    invokeWindowsVoiceTyping: () => ipcRenderer.invoke(IPC_APP_CHANNELS.appInvokeWindowsVoiceTyping),
  } satisfies CodexDesktopApi["app"];
}
