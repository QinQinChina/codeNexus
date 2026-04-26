import { type IpcRenderer } from "electron";
import { IPC_EVENT_CHANNELS, IPC_HISTORY_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createHistoryApi(ipcRenderer: IpcRenderer): CodexDesktopApi["history"] {
  return {
    list: () => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyList),
    refresh: () => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyRefresh),
    mergeThreadMetadata: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyMergeThreadMetadata, args),
    deleteThread: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyDeleteThread, args),
    getThreadTitleOverrides: () => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyGetThreadTitleOverrides),
    setThreadTitleOverride: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historySetThreadTitleOverride, args),
    clearThreadTitleOverride: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyClearThreadTitleOverride, args),
    getThreadContent: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadContent, args),
    getThreadMessages: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadMessages, args),
    getThreadEvents: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadEvents, args),
    createThreadTask: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadTaskCreate, args),
    updateThreadTask: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadTaskUpdate, args),
    listThreadTasks: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadTaskList, args),
    publishThreadArtifact: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadArtifactPublish, args),
    listThreadArtifacts: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadArtifactList, args),
    getThreadArtifact: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadArtifactGet, args),
    onUpdated: (cb) => {
      const listener = (_evt: unknown, payload: any) => cb(payload);
      ipcRenderer.on(IPC_EVENT_CHANNELS.historyUpdated, listener);
      return () => ipcRenderer.off(IPC_EVENT_CHANNELS.historyUpdated, listener);
    },
  } satisfies CodexDesktopApi["history"];
}
