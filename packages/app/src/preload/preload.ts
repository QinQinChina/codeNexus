import { contextBridge, ipcRenderer } from "electron";
import { createCodexDesktopApi } from "./api/client";
import { DEFAULT_USER_LOCAL_SETTINGS, normalizeUserLocalSettings } from "../common/localSettings";

// 从主进程传下来的启动参数里恢复首个本地设置快照，供渲染层初始化使用。
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

// 通过 contextBridge 把受控接口挂到 window 上，避免渲染进程直接接触 Node/Electron 原生能力。
contextBridge.exposeInMainWorld("codexDesktop", api);
