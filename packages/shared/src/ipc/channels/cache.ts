// 缓存域 IPC channels。
//
// 用于管理应用侧聚合缓存：renderer 只发起列表/清理意图，具体缓存来源和清理策略由 main 侧服务决定。
export const IPC_CACHE_CHANNELS = {
  // 返回各缓存区域的统计信息，不暴露缓存内部存储细节。
  cacheList: "cache:list",

  // 按 scope 清理缓存；是否允许清理、清理哪些目录由 contracts 与 main handler 共同约束。
  cacheClear: "cache:clear",
} as const;
