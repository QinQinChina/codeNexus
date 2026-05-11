import { type IpcRenderer } from "electron";
import { IPC_EVENT_CHANNELS, IPC_HISTORY_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createHistoryApi(ipcRenderer: IpcRenderer): CodexDesktopApi["history"] {
  return {
    // 历史列表：展示所有线程会话。
    list: () => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyList),
    // 刷新历史：重新从主进程同步线程数据。
    refresh: () => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyRefresh),
    // 合并线程元数据：补齐来源、角色和父子关系。
    mergeThreadMetadata: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyMergeThreadMetadata, args),
    // 删除线程：从历史缓存和持久化里移除对应会话。
    deleteThread: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyDeleteThread, args),
    // 读取标题覆盖：获取手动设置的会话标题。
    getThreadTitleOverrides: () => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyGetThreadTitleOverrides),
    // 设置标题覆盖：人为指定某个线程的显示标题。
    setThreadTitleOverride: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historySetThreadTitleOverride, args),
    // 清除标题覆盖：回到自动生成标题。
    clearThreadTitleOverride: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyClearThreadTitleOverride, args),
    // 读取线程内容：拿到消息和事件分页。
    getThreadContent: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadContent, args),
    // 读取线程消息：只拿对话消息。
    getThreadMessages: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadMessages, args),
    // 读取线程事件：只拿时间线事件。
    getThreadEvents: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadEvents, args),
    // 新建任务：记录线程级待办事项。
    createThreadTask: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadTaskCreate, args),
    // 更新任务：修改任务标题、描述或状态。
    updateThreadTask: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadTaskUpdate, args),
    // 列出任务：按线程查看待办列表。
    listThreadTasks: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadTaskList, args),
    // 发布工件：把文本、文件或链接记录到线程下。
    publishThreadArtifact: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadArtifactPublish, args),
    // 列出工件：查看线程已有成果物。
    listThreadArtifacts: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadArtifactList, args),
    // 读取单个工件：展开具体内容。
    getThreadArtifact: (args) => ipcRenderer.invoke(IPC_HISTORY_CHANNELS.historyThreadArtifactGet, args),
    // 监听历史变化：用于线程列表和侧边栏实时刷新。
    onUpdated: (cb) => {
      const listener = (_evt: unknown, payload: any) => cb(payload);
      ipcRenderer.on(IPC_EVENT_CHANNELS.historyUpdated, listener);
      return () => ipcRenderer.off(IPC_EVENT_CHANNELS.historyUpdated, listener);
    },
  } satisfies CodexDesktopApi["history"];
}
