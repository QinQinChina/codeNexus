/**
 * 主进程统一日志工具。
 *
 * 替代散落的 console.warn/console.error 和空 catch，为后续接入文件日志或上报预留统一入口。
 */

type LogLevel = "debug" | "info" | "warn" | "error";

function formatTag(tag: string): string {
  return `[${tag}]`;
}

function log(level: LogLevel, tag: string, message: string, error?: unknown): void {
  const prefix = formatTag(tag);
  if (level === "error") {
    console.error(prefix, message, error ?? "");
  } else if (level === "warn") {
    console.warn(prefix, message, error ?? "");
  } else if (level === "info") {
    console.info(prefix, message);
  } else {
    console.debug(prefix, message);
  }
}

export const logger = {
  debug: (tag: string, message: string) => log("debug", tag, message),
  info: (tag: string, message: string) => log("info", tag, message),
  warn: (tag: string, message: string, error?: unknown) => log("warn", tag, message, error),
  error: (tag: string, message: string, error?: unknown) => log("error", tag, message, error),
};
