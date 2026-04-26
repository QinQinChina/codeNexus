import { contextBridge, ipcRenderer } from "electron";
import { createCodexDesktopApi } from "./api/client";
import { DEFAULT_USER_LOCAL_SETTINGS, normalizeUserLocalSettings } from "../shared/localSettings";

function parseInitialLocalSettingsSnapshot() {
  const prefix = "--codex-local-settings=";
  const hit = process.argv.find((arg) => typeof arg === "string" && arg.startsWith(prefix));
  if (!hit) {
    return {
      path: "",
      exists: false,
      settings: normalizeUserLocalSettings(DEFAULT_USER_LOCAL_SETTINGS),
    };
  }
  try {
    const encoded = hit.slice(prefix.length);
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { path?: unknown; exists?: unknown; settings?: unknown };
    return {
      path: String(parsed?.path ?? "").trim(),
      exists: Boolean(parsed?.exists),
      settings: normalizeUserLocalSettings(parsed?.settings),
    };
  } catch {
    return {
      path: "",
      exists: false,
      settings: normalizeUserLocalSettings(DEFAULT_USER_LOCAL_SETTINGS),
    };
  }
}

// 在隔离上下文中构造仅暴露白名单能力的桌面 API。
const api = createCodexDesktopApi(ipcRenderer, parseInitialLocalSettingsSnapshot());

// 向渲染进程注入安全桥接对象，避免直接暴露 Node 能力。
contextBridge.exposeInMainWorld("codexDesktop", api);
