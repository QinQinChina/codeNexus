/**
 * shared 包的公共出口。
 *
 * 只暴露跨进程、跨包稳定契约；具体功能包的实现细节不从这里反向泄漏。
 */
export * from "./agent-protocol";
export * from "./codex-protocol";
export * from "./ipc";
