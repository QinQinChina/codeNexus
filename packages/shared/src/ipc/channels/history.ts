// 历史域 IPC channels。
//
// 历史域聚合 runtime/cache/disk 中的线程资料。renderer 不关心数据来自哪里，
// 只通过这些频道读取列表、内容、回放事件、任务和线程产物。
export const IPC_HISTORY_CHANNELS = {
  // 线程列表和基础元数据维护：用于侧边栏、标题覆盖、删除和来源关系更新。
  historyList: "history:list",
  historyRefresh: "history:refresh",
  historyMergeThreadMetadata: "history:mergeThreadMetadata",
  historyDeleteThread: "history:deleteThread",
  historyGetThreadTitleOverrides: "history:getThreadTitleOverrides",
  historySetThreadTitleOverride: "history:setThreadTitleOverride",
  historyClearThreadTitleOverride: "history:clearThreadTitleOverride",

  // 线程内容读取：消息用于展示，事件用于调试/回放，content 是聚合后的分页视图。
  historyThreadMessages: "history:threadMessages",
  historyThreadEvents: "history:threadEvents",
  historyThreadContent: "history:threadContent",

  // 线程任务：把 todo/进度类信息挂到历史线程上，供后续恢复和追踪。
  historyThreadTaskCreate: "history:threadTaskCreate",
  historyThreadTaskUpdate: "history:threadTaskUpdate",
  historyThreadTaskList: "history:threadTaskList",

  // 线程产物：用于发布、枚举和读取某个线程生成的持久化内容。
  historyThreadArtifactPublish: "history:threadArtifactPublish",
  historyThreadArtifactList: "history:threadArtifactList",
  historyThreadArtifactGet: "history:threadArtifactGet",
} as const;
