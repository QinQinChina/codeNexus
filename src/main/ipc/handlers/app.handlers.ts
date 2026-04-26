import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, Notification, shell } from "electron";
import { spawnSync } from "node:child_process";
import { appendFile, copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { IPC_APP_CHANNELS } from "../../../shared/ipc/channels";
import { resolveUiFontSizeZoomFactor, type UserLocalSettingsPatch } from "../../../shared/localSettings";
import { normalizeSafeExternalUrl } from "../../utils/externalUrl";
import type { AppTextEncoding, AppTextLineEnding, AppWindowState } from "../../../shared/ipc/contracts";
import type { LocalSettingsService } from "../../services/LocalSettingsService";
import type { RemoteStateSyncService } from "../../services/RemoteStateSyncService";
import type { UpdateService } from "../../services/UpdateService";

function isPathWithinDir(filePath: string, dirPath: string): boolean {
  const file = resolve(String(filePath ?? ""));
  const dir = resolve(String(dirPath ?? ""));
  if (!file || !dir) return false;
  if (file === dir) return true;
  const rel = relative(dir, file);
  if (!rel) return false;
  return !rel.startsWith("..") && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
function resolveLocalFilePath(input: string): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  const home = homedir();
  // 支持 `~`、`%VAR%`、`$VAR` 三类路径变量，统一解析为绝对路径。
  let expanded = raw.replace(/^~(?=$|[\\/])/, home);
  expanded = expanded.replace(/%([^%]+)%/g, (_match, key: string) => {
    const value = process.env[String(key ?? "").trim()];
    return typeof value === "string" && value.length > 0 ? value : `%${key}%`;
  });
  expanded = expanded.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, key: string) => {
    const value = process.env[String(key ?? "").trim()];
    return typeof value === "string" && value.length > 0 ? value : `$${key}`;
  });
  if (isAbsolute(expanded)) return expanded;
  return resolve(expanded);
}

function detectTextEncoding(buffer: Buffer): AppTextEncoding {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return "UTF-8 BOM";
  }
  return "UTF-8";
}

function stripUtf8Bom(buffer: Buffer): Buffer {
  return detectTextEncoding(buffer) === "UTF-8 BOM" ? buffer.subarray(3) : buffer;
}

function detectLineEnding(text: string): AppTextLineEnding | null {
  if (text.includes("\r\n")) return "CRLF";
  if (text.includes("\n")) return "LF";
  if (text.includes("\r")) return "CR";
  return null;
}

function encodeUtf8Text(content: string, encoding: AppTextEncoding): Buffer {
  const body = Buffer.from(String(content ?? ""), "utf8");
  if (encoding === "UTF-8 BOM") {
    return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body]);
  }
  return body;
}

function toLocalDateYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? String(v) : v));
  } catch (e: any) {
    return JSON.stringify({ _error: "json_stringify_failed", message: String(e?.message ?? e) });
  }
}

function truncateText(value: unknown, maxLen: number): string | undefined {
  const text = typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
  if (!text) return undefined;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}\n…(truncated ${text.length - maxLen} chars)`;
}

function focusMainWindow(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return;
  try {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  } catch {}
}

const ALLOWED_BACKGROUND_IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"]);
const GLOBAL_BACKGROUND_RELATIVE_DIR = "global-background";

function getBackgroundRelativeDir(): string {
  return GLOBAL_BACKGROUND_RELATIVE_DIR;
}

function getBackgroundAbsoluteDir(): string {
  return join(app.getPath("userData"), getBackgroundRelativeDir());
}

function invokeWindowsVoiceTyping(): { ok: boolean; reason?: string; detail?: string } {
  if (process.platform !== "win32") {
    return { ok: false, reason: "unsupported-platform", detail: "Only available on Windows." };
  }

  const psScript = [
    "$signature='[DllImport(\"user32.dll\", SetLastError=true)] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);'",
    "Add-Type -MemberDefinition $signature -Name NativeKey -Namespace WinApi",
    "$VK_LWIN=0x5B",
    "$VK_H=0x48",
    "$KEYUP=0x0002",
    "[WinApi.NativeKey]::keybd_event($VK_LWIN,0,0,0)",
    "Start-Sleep -Milliseconds 35",
    "[WinApi.NativeKey]::keybd_event($VK_H,0,0,0)",
    "Start-Sleep -Milliseconds 35",
    "[WinApi.NativeKey]::keybd_event($VK_H,0,$KEYUP,0)",
    "Start-Sleep -Milliseconds 35",
    "[WinApi.NativeKey]::keybd_event($VK_LWIN,0,$KEYUP,0)",
  ].join("; ");

  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript],
    { encoding: "utf8", windowsHide: true, timeout: 5000 }
  );

  if (result.error) {
    return { ok: false, reason: "spawn-failed", detail: String(result.error.message || result.error) };
  }

  if (typeof result.status === "number" && result.status !== 0) {
    const stderr = String(result.stderr ?? "").trim();
    const stdout = String(result.stdout ?? "").trim();
    const detail = stderr || stdout || `powershell exited with status ${result.status}`;
    return { ok: false, reason: "invoke-failed", detail };
  }

  return { ok: true };
}

const ALLOWED_NOTIFICATION_SOUND_EXTS = new Set<string>([".mp3", ".wav", ".ogg", ".m4a"]);
const ALLOWED_NOTIFICATION_SOUND_IDS = new Set<string>([
  "阿啵.mp3",
  "比比拉布.mp3",
  "布谷鸟.mp3",
  "ciallo.mp3",
  "酱酱微信提示音.mp3",
  "曼波.mp3",
  "你干嘛 哎呦.mp3",
  "通知铃声.mp3",
  "主人，有消息哦，.mp3",
]);

function toAudioMime(ext: string): string {
  const e = String(ext ?? "")
    .trim()
    .toLowerCase();
  if (e === ".mp3") return "audio/mpeg";
  if (e === ".wav") return "audio/wav";
  if (e === ".ogg") return "audio/ogg";
  if (e === ".m4a") return "audio/mp4";
  return "application/octet-stream";
}

async function firstExistingDir(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      const s = await stat(candidate);
      if (s.isDirectory()) return candidate;
    } catch {}
  }
  return null;
}

function bundledMusicDirCandidates(): string[] {
  const out: string[] = [];
  try {
    const p = String(process.resourcesPath ?? "").trim();
    if (p) out.push(join(p, "music"));
  } catch {}
  try {
    out.push(join(app.getAppPath(), "music"));
  } catch {}
  return out;
}

function isSafeSoundId(id: unknown): id is string {
  const text = String(id ?? "").trim();
  if (!text) return false;
  if (text.includes("/") || text.includes("\\")) return false;
  if (text.includes("..")) return false;
  const ext = extname(text).toLowerCase();
  return ALLOWED_NOTIFICATION_SOUND_EXTS.has(ext) && ALLOWED_NOTIFICATION_SOUND_IDS.has(text);
}

function resolveSoundPathOrThrow(musicDir: string, id: string): string {
  const safeDir = resolve(musicDir);
  const filePath = resolve(join(safeDir, id));
  const rel = relative(safeDir, filePath);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("app:notificationSound invalid path");
  // 额外确保分隔符边界（避免 safeDir=/a/b 与 filePath=/a/b2/... 的前缀误判）。
  if (!filePath.toLowerCase().startsWith((safeDir + sep).toLowerCase()))
    throw new Error("app:notificationSound invalid path scope");
  return filePath;
}

// 注册应用基础 IPC（工作区、外链、读写文本文件）。
export function registerAppHandlers(deps: {
  getMainWindow: () => BrowserWindow | null;
  localSettingsService: LocalSettingsService;
  remoteSyncService: RemoteStateSyncService;
  updateService: UpdateService;
}) {
  const { localSettingsService, remoteSyncService, updateService } = deps;
  const getWindowOrNull = (): BrowserWindow | null => {
    const win = deps.getMainWindow();
    if (!win || win.isDestroyed()) return null;
    return win;
  };

  const DEFAULT_WINDOW_STATE: AppWindowState = {
    isMaximized: false,
    isMinimized: false,
    isFullScreen: false,
  };

  const toWindowState = (win: BrowserWindow): AppWindowState => ({
    isMaximized: win.isMaximized(),
    isMinimized: win.isMinimized(),
    isFullScreen: win.isFullScreen(),
  });

  ipcMain.handle(IPC_APP_CHANNELS.appSelectWorkspace, async () => {
    const mainWindow = deps.getMainWindow();
    if (!mainWindow) return null;

    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory", "createDirectory"],
    });
    if (res.canceled) return null;
    return res.filePaths[0] ?? null;
  });

  ipcMain.handle(IPC_APP_CHANNELS.appOpenExternal, async (_evt, args: { url: string }) => {
    const url = normalizeSafeExternalUrl(args?.url ?? "");
    if (!url) throw new Error("app:openExternal blocked unsupported url protocol");
    // 统一通过系统默认浏览器打开外链。
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appReadTextFile, async (_evt, args: { path: string }) => {
    const filePath = resolveLocalFilePath(args?.path ?? "");
    if (!filePath) throw new Error("app:readTextFile requires path");
    // 统一按 UTF-8 读取，并保留 UTF-8 BOM / 行尾风格信息。
    try {
      const raw = await readFile(filePath);
      const encoding = detectTextEncoding(raw);
      const content = stripUtf8Bom(raw).toString("utf8");
      return { ok: true, content, encoding, lineEnding: detectLineEnding(content) };
    } catch (error: any) {
      // 首次启动时，本地状态文件可能尚未创建。仅对 userData 目录下的缺失文件做兜底，避免渲染进程被带崩。
      if (String(error?.code ?? "") === "ENOENT" && isPathWithinDir(filePath, app.getPath("userData"))) {
        return { ok: true, content: "", encoding: "UTF-8" as const, lineEnding: null };
      }
      throw error;
    }
  });

  ipcMain.handle(
    IPC_APP_CHANNELS.appWriteTextFile,
    async (_evt, args: { path: string; content: string; encoding?: AppTextEncoding }) => {
      const filePath = resolveLocalFilePath(args?.path ?? "");
      if (!filePath) throw new Error("app:writeTextFile requires path");
      const content = String(args?.content ?? "");
      const encoding = args?.encoding === "UTF-8 BOM" ? "UTF-8 BOM" : "UTF-8";
      // 写入前自动创建父目录，减少调用端前置判断。
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, encodeUtf8Text(content, encoding));
      return { ok: true };
    }
  );

  ipcMain.handle(IPC_APP_CHANNELS.appReadDirectory, async (_evt, args: { path: string }) => {
    const dirPath = resolveLocalFilePath(args?.path ?? "");
    if (!dirPath) throw new Error("app:readDirectory requires path");
    const info = await stat(dirPath);
    if (!info.isDirectory()) throw new Error("app:readDirectory path is not a directory");
    const entries = await readdir(dirPath, { withFileTypes: true });
    return {
      ok: true as const,
      entries: entries
        .map((entry) => ({
          fileName: entry.name,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
        }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.fileName.localeCompare(b.fileName, "zh-CN");
        }),
    };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appGetFileMetadata, async (_evt, args: { path: string }) => {
    const filePath = resolveLocalFilePath(args?.path ?? "");
    if (!filePath) throw new Error("app:getFileMetadata requires path");
    const info = await stat(filePath);
    return {
      ok: true as const,
      metadata: {
        isDirectory: info.isDirectory(),
        isFile: info.isFile(),
        createdAtMs: Number.isFinite(info.birthtimeMs) ? Math.round(info.birthtimeMs) : 0,
        modifiedAtMs: Number.isFinite(info.mtimeMs) ? Math.round(info.mtimeMs) : 0,
      },
    };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appLocalSettingsRead, async () => {
    const { exists, settings } = await localSettingsService.read();
    return { path: localSettingsService.path, exists, settings };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appLocalSettingsPatch, async (_evt, args: { patch: UserLocalSettingsPatch }) => {
    const settings = await localSettingsService.patch(args?.patch ?? {});
    remoteSyncService.onSettingsUpdated(settings);
    const win = getWindowOrNull();
    if (win) {
      try {
        win.webContents.setZoomFactor(resolveUiFontSizeZoomFactor(settings.ui.fontSizePreset));
      } catch {}
    }
    return { path: localSettingsService.path, exists: true as const, settings };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appRemoteSyncGetState, async () => {
    return { state: remoteSyncService.getState() };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appRemoteSyncLogin, async (_evt, args: { password: string }) => {
    return await remoteSyncService.login({ password: args?.password ?? "" });
  });

  ipcMain.handle(IPC_APP_CHANNELS.appRemoteSyncLogout, async () => {
    return await remoteSyncService.logout();
  });

  ipcMain.handle(IPC_APP_CHANNELS.appRemoteSyncFlush, async () => {
    return await remoteSyncService.flushNow();
  });

  ipcMain.handle(IPC_APP_CHANNELS.appListNotificationSounds, async () => {
    const musicDir = await firstExistingDir(bundledMusicDirCandidates());
    if (!musicDir) return { items: [] };
    const entries = await readdir(musicDir, { withFileTypes: true });
    const items = entries
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter(
        (name) =>
          ALLOWED_NOTIFICATION_SOUND_EXTS.has(extname(name).toLowerCase()) && ALLOWED_NOTIFICATION_SOUND_IDS.has(name)
      )
      .map((name) => ({
        id: name,
        label: basename(name, extname(name)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
    return { items };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appReadNotificationSoundDataUrl, async (_evt, args: { id: string }) => {
    const id = String(args?.id ?? "").trim();
    if (!isSafeSoundId(id)) throw new Error("app:notificationSound invalid id");
    const musicDir = await firstExistingDir(bundledMusicDirCandidates());
    if (!musicDir) throw new Error("app:notificationSound dir not found");
    const filePath = resolveSoundPathOrThrow(musicDir, id);
    const buf = await readFile(filePath);
    const ext = extname(id).toLowerCase();
    const mime = toAudioMime(ext);
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    return { ok: true, dataUrl };
  });

  ipcMain.handle(
    IPC_APP_CHANNELS.appSystemNotificationShow,
    async (_evt, args: { title?: string; body?: string; silent?: boolean }) => {
      if (!Notification.isSupported()) return { ok: false as const, reason: "unsupported" as const };
      try {
        const notification = new Notification({
          title: String(args?.title ?? "").trim() || app.getName() || "CodeNexus",
          body: String(args?.body ?? "").trim(),
          silent: Boolean(args?.silent),
        });
        notification.on("click", () => focusMainWindow(getWindowOrNull()));
        notification.show();
        return { ok: true as const };
      } catch (error: any) {
        return { ok: false as const, reason: "failed" as const, message: String(error?.message ?? error) };
      }
    }
  );

  ipcMain.handle(IPC_APP_CHANNELS.appFileChangeLogAppend, async (_evt, args: { record: unknown }) => {
    // 统一落盘到 ~/.codex/logs，便于和 ~/.codex/sessions 并排排查。
    const logDir = join(homedir(), ".codex", "logs");
    const logPath = join(logDir, `file-change-${toLocalDateYmd()}.txt`);

    const record = args?.record ?? null;
    const normalized = {
      ...(record && typeof record === "object" && !Array.isArray(record) ? (record as any) : { record }),
      // 防止单条事件过大导致日志不可用：只截断两个高风险字段（其余保持原样）。
      paramsText: truncateText((record as any)?.paramsText, 200_000),
      delta: truncateText((record as any)?.delta, 400_000),
      chunk: truncateText((record as any)?.chunk, 400_000),
    };

    const line = `${safeJsonStringify(normalized)}\n`;
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, line, "utf8");
    return { ok: true, path: logPath };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appReadClipboardImageDataUrl, async () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) return { ok: true, dataUrl: null };
    return { ok: true, dataUrl: image.toDataURL() };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appReadImageFileDataUrl, async (_evt, args: { path: string }) => {
    const filePath = resolveLocalFilePath(args?.path ?? "");
    if (!filePath) throw new Error("app:readImageFileDataUrl requires path");
    const image = nativeImage.createFromPath(filePath);
    if (image.isEmpty()) throw new Error("app:readImageFileDataUrl failed to load image");
    return { ok: true, dataUrl: image.toDataURL() };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appImportBackgroundImage, async () => {
    const mainWindow = deps.getMainWindow();
    if (!mainWindow) return { ok: false as const, canceled: true as const };

    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        {
          name: "图片",
          extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"],
        },
      ],
    });
    if (res.canceled) return { ok: false as const, canceled: true as const };

    const sourcePath = resolveLocalFilePath(res.filePaths[0] ?? "");
    if (!sourcePath) throw new Error("app:background:import requires source file");
    const ext = extname(sourcePath).toLowerCase();
    if (!ALLOWED_BACKGROUND_IMAGE_EXTS.has(ext)) {
      throw new Error(`app:background:import unsupported extension ${ext || "<empty>"}`);
    }

    const relativeDir = getBackgroundRelativeDir();
    const absoluteDir = getBackgroundAbsoluteDir();
    const relativePath = join(relativeDir, `background${ext}`);
    const absolutePath = join(app.getPath("userData"), relativePath);

    await rm(absoluteDir, { recursive: true, force: true });
    await mkdir(absoluteDir, { recursive: true });
    await copyFile(sourcePath, absolutePath);

    const image = nativeImage.createFromPath(absolutePath);
    if (image.isEmpty()) {
      await rm(absoluteDir, { recursive: true, force: true });
      throw new Error("app:background:import failed to load copied image");
    }

    return {
      ok: true as const,
      canceled: false as const,
      relativePath,
      dataUrl: image.toDataURL(),
    };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appClearBackgroundImage, async () => {
    await rm(getBackgroundAbsoluteDir(), { recursive: true, force: true });
    return { ok: true as const };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appInvokeWindowsVoiceTyping, async () => {
    return invokeWindowsVoiceTyping();
  });

  ipcMain.handle(IPC_APP_CHANNELS.appUpdateGetState, async () => {
    return { state: updateService.getState() };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appUpdateCheck, async () => {
    await updateService.checkForUpdates();
    return { ok: true as const };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appUpdateDownload, async () => {
    await updateService.downloadUpdate();
    return { ok: true as const };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appUpdateRestartToInstall, async () => {
    updateService.requestRestartToInstall();
    const win = getWindowOrNull();
    if (win) win.close();
    return { ok: true as const };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appWindowGetState, async () => {
    const win = getWindowOrNull();
    return win ? toWindowState(win) : DEFAULT_WINDOW_STATE;
  });

  ipcMain.handle(IPC_APP_CHANNELS.appWindowMinimize, async () => {
    const win = getWindowOrNull();
    if (!win) return { ok: true };
    win.minimize();
    return { ok: true };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appWindowToggleMaximize, async () => {
    const win = getWindowOrNull();
    if (!win) return { ok: true };
    if (win.isFullScreen()) win.setFullScreen(false);
    else if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return { ok: true };
  });

  ipcMain.on(IPC_APP_CHANNELS.appWindowClose, () => {
    const win = getWindowOrNull();
    if (!win) return;
    win.close();
  });

  ipcMain.handle(IPC_APP_CHANNELS.appWindowClose, async () => {
    const win = getWindowOrNull();
    if (!win) return { ok: true };
    win.close();
    return { ok: true };
  });
}
