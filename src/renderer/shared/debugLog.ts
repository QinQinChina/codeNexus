import { getCachedUserLocalSettings } from "../domain/localSettings";

type DebugLogEntry = {
  t: number;
  scope: string;
  message: string;
  data?: unknown;
};

const entries: DebugLogEntry[] = [];
const MAX_DEBUG_LOG_ENTRIES = 2000;

export function isDebugLogEnabled(): boolean {
  return getCachedUserLocalSettings().settings.developer.debugLogEnabled;
}

// 业务调试日志采集：写入内存环形缓冲区，便于开发期排查。
export function appendDebugLog(scope: string, message: string, data?: unknown): void {
  if (!isDebugLogEnabled()) return;
  entries.push({
    t: Date.now(),
    scope: String(scope ?? "").trim() || "app",
    message: String(message ?? "").trim(),
    ...(data === undefined ? {} : { data }),
  });
  if (entries.length > MAX_DEBUG_LOG_ENTRIES) {
    entries.splice(0, entries.length - MAX_DEBUG_LOG_ENTRIES);
  }
}
