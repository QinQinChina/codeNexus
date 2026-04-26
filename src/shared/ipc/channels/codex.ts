// Codex 服务域 IPC channels。
export const IPC_CODEX_CHANNELS = {
  codexEnsureInstalled: "codex:ensureInstalled",
  codexDiagnostics: "codex:diagnostics",
  codexServerStart: "codex:serverStart",
  codexServerStop: "codex:serverStop",
  codexRpc: "codex:rpc",
  codexNotify: "codex:notify",
  codexRespond: "codex:respond",
} as const;

