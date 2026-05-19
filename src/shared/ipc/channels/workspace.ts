// 工作区域 IPC channels。
export const IPC_WORKSPACE_CHANNELS = {
  workspaceReverseDiffDryRun: "workspace:reverseDiff:dryRun",
  workspaceReverseDiffApply: "workspace:reverseDiff:apply",
  workspaceGitStatusRead: "workspace:gitStatus:read",
} as const;
