/// <reference types="vite/client" />

// 渲染进程全局类型补充：声明 window.codexDesktop 与历史类型别名。
import type {
  CodexDesktopApi,
  HistoryMessage as CodexHistoryMessage,
  HistoryThread as CodexHistoryThread,
} from "../shared/ipc";

export {};

declare global {
  type HistoryThread = CodexHistoryThread;
  type HistoryMessage = CodexHistoryMessage;

  interface Window {
    codexDesktop: CodexDesktopApi;
  }
}
