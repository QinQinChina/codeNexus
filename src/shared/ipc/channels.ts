import { IPC_APP_CHANNELS } from "./channels/app";
import { IPC_CACHE_CHANNELS } from "./channels/cache";
import { IPC_CODEX_CHANNELS } from "./channels/codex";
import { IPC_EVENT_CHANNELS } from "./channels/events";
import { IPC_HISTORY_CHANNELS } from "./channels/history";
import { IPC_WORKSPACE_CHANNELS } from "./channels/workspace";

// IPC channel 常量：Main/Preload/Renderer 共享的单一事实来源（按域拆分）。
export {
  IPC_APP_CHANNELS,
  IPC_CODEX_CHANNELS,
  IPC_WORKSPACE_CHANNELS,
  IPC_HISTORY_CHANNELS,
  IPC_CACHE_CHANNELS,
  IPC_EVENT_CHANNELS,
};

type ValueOf<T> = T[keyof T];

export type IpcChannel =
  | ValueOf<typeof IPC_APP_CHANNELS>
  | ValueOf<typeof IPC_CODEX_CHANNELS>
  | ValueOf<typeof IPC_WORKSPACE_CHANNELS>
  | ValueOf<typeof IPC_HISTORY_CHANNELS>
  | ValueOf<typeof IPC_CACHE_CHANNELS>
  | ValueOf<typeof IPC_EVENT_CHANNELS>;
