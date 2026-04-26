import { type IpcRenderer } from "electron";
import { IPC_CODEX_CHANNELS, IPC_EVENT_CHANNELS } from "../channels";
import { type CodexDesktopApi } from "../types";

export function createCodexServerApi(ipcRenderer: IpcRenderer): CodexDesktopApi["codexServer"] {
  const rpc: CodexDesktopApi["codexServer"]["rpc"] = (args) => ipcRenderer.invoke(IPC_CODEX_CHANNELS.codexRpc, args);
  const notify: CodexDesktopApi["codexServer"]["notify"] = (args) =>
    ipcRenderer.invoke(IPC_CODEX_CHANNELS.codexNotify, args);

  const onEvent: CodexDesktopApi["codexServer"]["onEvent"] = (cb) => {
    const listener = (_evt: unknown, payload: any) => cb(payload);
    ipcRenderer.on(IPC_EVENT_CHANNELS.codexEvent, listener);
    return () => ipcRenderer.off(IPC_EVENT_CHANNELS.codexEvent, listener);
  };

  return {
    ensureInstalled: () => ipcRenderer.invoke(IPC_CODEX_CHANNELS.codexEnsureInstalled),
    getDiagnostics: () => ipcRenderer.invoke(IPC_CODEX_CHANNELS.codexDiagnostics),
    start: (args) => ipcRenderer.invoke(IPC_CODEX_CHANNELS.codexServerStart, args),
    stop: (args) => ipcRenderer.invoke(IPC_CODEX_CHANNELS.codexServerStop, args),
    rpc,
    notify,
    respond: (args) => ipcRenderer.invoke(IPC_CODEX_CHANNELS.codexRespond, args),
    onEvent,
  } satisfies CodexDesktopApi["codexServer"];
}

