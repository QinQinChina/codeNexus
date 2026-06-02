// IPC 错误识别：用于把“handler 未注册”等错误归类为可降级处理的分支。
// 典型场景：新旧版本 channel 不一致时，调用方可据此走兼容兜底。
export function isIpcHandlerMissingError(message: string, channel: string): boolean {
  const msg = String(message ?? "");
  return msg.includes(`No handler registered for '${channel}'`);
}
