// 历史域 IPC channels。
export const IPC_HISTORY_CHANNELS = {
  historyList: "history:list",
  historyRefresh: "history:refresh",
  historyMergeThreadMetadata: "history:mergeThreadMetadata",
  historyDeleteThread: "history:deleteThread",
  historyGetThreadTitleOverrides: "history:getThreadTitleOverrides",
  historySetThreadTitleOverride: "history:setThreadTitleOverride",
  historyClearThreadTitleOverride: "history:clearThreadTitleOverride",
  historyThreadMessages: "history:threadMessages",
  historyThreadEvents: "history:threadEvents",
  historyThreadContent: "history:threadContent",
  historyThreadTaskCreate: "history:threadTaskCreate",
  historyThreadTaskUpdate: "history:threadTaskUpdate",
  historyThreadTaskList: "history:threadTaskList",
  historyThreadArtifactPublish: "history:threadArtifactPublish",
  historyThreadArtifactList: "history:threadArtifactList",
  historyThreadArtifactGet: "history:threadArtifactGet",
} as const;
