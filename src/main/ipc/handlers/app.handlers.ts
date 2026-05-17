import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, Notification, shell } from "electron";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { IPC_APP_CHANNELS } from "../../../shared/ipc/channels";
import { resolveUiFontSizeZoomFactor, type UserLocalSettingsPatch } from "../../../shared/localSettings";
import { normalizeSafeExternalUrl } from "../../utils/externalUrl";
import type {
  AppTextEncoding,
  AppTextLineEnding,
  AppWindowState,
  ImageGenerationGeneratedImage,
  ImageGenerationGenerateArgs,
} from "../../../shared/ipc/contracts";
import type { LocalSettingsService } from "../../services/LocalSettingsService";
import type { CodexProfileService } from "../../services/CodexProfileService";
import type { CodexSkillRootsService } from "../../services/CodexSkillRootsService";
import type { ImageGenerationHistoryService } from "../../services/ImageGenerationHistoryService";
import type { ImageGenerationTaskService } from "../../services/ImageGenerationTaskService";
import type { RemoteStateSyncService } from "../../services/RemoteStateSyncService";
import type { CodexProviderProfileInput } from "../../../shared/codexProfiles";

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

function tryParseObjectJson(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function truncateText(value: unknown, maxLen: number): string | undefined {
  const text = typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
  if (!text) return undefined;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}\n…(truncated ${text.length - maxLen} chars)`;
}

function toNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function maskSecret(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length <= 10) return "********";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function toIntegerInRange(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  return Math.max(min, Math.min(max, rounded));
}

function normalizeHttpUrl(value: unknown): string | null {
  const text = toNullableText(value);
  if (!text) return null;
  const trimmed = text.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function normalizeOpenAiModelsEndpoint(baseUrlValue: unknown): string {
  const baseUrl = normalizeHttpUrl(baseUrlValue);
  if (!baseUrl) throw new Error("供应商 Base URL 无效，请填写 http(s) URL。");
  if (/\/models$/i.test(baseUrl)) return baseUrl;
  if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/models`;
  return `${baseUrl}/v1/models`;
}

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
};

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/bmp": ".bmp",
};

function imageMimeFromExt(extValue: unknown): string {
  const ext = String(extValue ?? "")
    .trim()
    .toLowerCase();
  return IMAGE_MIME_BY_EXT[ext] || "image/png";
}

function imageExtFromMime(mimeValue: unknown, fallbackFormat: unknown): string {
  const mime = String(mimeValue ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (IMAGE_EXT_BY_MIME[mime]) return IMAGE_EXT_BY_MIME[mime];
  const format = String(fallbackFormat ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");
  if (format === "jpg" || format === "jpeg") return ".jpg";
  if (format === "webp") return ".webp";
  return ".png";
}

function normalizeImageOutputFormat(value: unknown, fallback: string): string | null {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");
  if (text === "auto") return null;
  if (text === "jpg") return "jpeg";
  if (text === "jpeg" || text === "png" || text === "webp") return text;
  const fallbackText = String(fallback || "png")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");
  if (fallbackText === "auto") return null;
  if (fallbackText === "jpg") return "jpeg";
  if (fallbackText === "jpeg" || fallbackText === "png" || fallbackText === "webp") return fallbackText;
  return "png";
}

function normalizeImageBackground(value: unknown, fallback: string): string {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (text === "transparent" || text === "opaque" || text === "auto") return text;
  return String(fallback || "auto").trim() || "auto";
}

function normalizeImageModeration(value: unknown, fallback: string): string {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (text === "low" || text === "auto") return text;
  return String(fallback || "auto").trim() || "auto";
}

function normalizeImageOutputCompression(value: unknown, fallback: number): number {
  return toIntegerInRange(value, fallback, 0, 100);
}

function normalizeImageEndpoint(baseUrlValue: unknown, kind: "generations" | "edits"): string {
  const baseUrl = normalizeHttpUrl(baseUrlValue);
  if (!baseUrl) throw new Error("图片生成服务地址无效，请填写 http(s) URL。");
  const url = new URL(baseUrl);
  const path = url.pathname.replace(/\/+$/, "");
  if (/\/images\/(generations|edits)$/i.test(path)) {
    return baseUrl.replace(/\/images\/(generations|edits)$/i, `/images/${kind}`);
  }
  if (/\/v1$/i.test(path)) return `${baseUrl}/images/${kind}`;
  return `${baseUrl}/v1/images/${kind}`;
}

function sanitizePathSegment(value: unknown, fallback: string): string {
  const text = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return text || fallback;
}

function parseImageDataUrl(value: string): { mimeType: string; buffer: Buffer } | null {
  const match = String(value ?? "").match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match) return null;
  const mimeType = String(match[1] ?? "image/png").trim().toLowerCase() || "image/png";
  const body = String(match[2] ?? "").trim();
  if (!body) return null;
  return { mimeType, buffer: Buffer.from(body, "base64") };
}

function dataUrlToBlob(value: string): { blob: Blob; mimeType: string } | null {
  const parsed = parseImageDataUrl(value);
  if (!parsed) return null;
  return {
    blob: new Blob([new Uint8Array(parsed.buffer)], { type: parsed.mimeType }),
    mimeType: parsed.mimeType,
  };
}

function imageBufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType || "image/png"};base64,${buffer.toString("base64")}`;
}

async function readImageFileAsDataUrl(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();
  const directMime = IMAGE_MIME_BY_EXT[ext];
  if (directMime) {
    const buffer = await readFile(filePath);
    return imageBufferToDataUrl(buffer, directMime);
  }
  const image = nativeImage.createFromPath(filePath);
  if (image.isEmpty()) throw new Error("app:readImageFileDataUrl failed to load image");
  return image.toDataURL();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > 1200 ? `${text.slice(0, 1200)}...` : text;
  } catch {
    return "";
  }
}

function extractGeneratedImages(value: unknown): Array<{
  buffer?: Buffer;
  url?: string;
  mimeType?: string;
  revisedPrompt: string | null;
}> {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
  const data = Array.isArray(record.data) ? record.data : [];
  const items = data.length > 0 ? data : Array.isArray(record.images) ? record.images : [];
  const out: Array<{ buffer?: Buffer; url?: string; mimeType?: string; revisedPrompt: string | null }> = [];
  for (const itemValue of items) {
    const item =
      itemValue && typeof itemValue === "object" && !Array.isArray(itemValue)
        ? (itemValue as Record<string, any>)
        : {};
    const revisedPrompt = toNullableText(item.revised_prompt ?? item.revisedPrompt);
    const rawBase64 = toNullableText(item.b64_json ?? item.base64 ?? item.image_base64);
    if (rawBase64) {
      if (/^https?:\/\//i.test(rawBase64)) {
        out.push({ url: rawBase64, mimeType: toNullableText(item.mime_type) ?? undefined, revisedPrompt });
        continue;
      }
      const parsedDataUrl = parseImageDataUrl(rawBase64);
      if (parsedDataUrl) {
        out.push({ buffer: parsedDataUrl.buffer, mimeType: parsedDataUrl.mimeType, revisedPrompt });
      } else {
        out.push({
          buffer: Buffer.from(rawBase64, "base64"),
          mimeType: toNullableText(item.mime_type) ?? undefined,
          revisedPrompt,
        });
      }
      continue;
    }
    const url = toNullableText(item.url ?? item.image_url ?? item.output_url ?? item.image);
    if (url) out.push({ url, mimeType: toNullableText(item.mime_type) ?? undefined, revisedPrompt });
  }
  return out;
}

export async function generateImagesWithSettings(
  localSettingsService: LocalSettingsService,
  imageGenerationHistoryService: ImageGenerationHistoryService,
  args: ImageGenerationGenerateArgs,
  signal?: AbortSignal
) {
  const prompt = toNullableText(args?.prompt);
  if (!prompt) throw new Error("图片生成提示词不能为空。");

  const { settings } = await localSettingsService.read();
  const imageSettings = settings.imageGeneration;
  if (!imageSettings.enabled) throw new Error("图片生成功能未启用，请先在设置中开启。");
  if (!imageSettings.baseUrl) throw new Error("图片生成服务地址未配置。");
  if (!imageSettings.apiKey) throw new Error("图片生成 API Key 未配置。");

  const timeoutMs = toIntegerInRange(imageSettings.timeoutMs, 120_000, 10_000, 600_000);
  const inputImages = Array.isArray(args?.inputImages)
    ? args.inputImages
        .map((item) => ({
          dataUrl: toNullableText(item?.dataUrl),
          name: toNullableText(item?.name),
        }))
        .filter((item): item is { dataUrl: string; name: string | null } => Boolean(item.dataUrl))
    : [];
  const mode = inputImages.length > 0 ? "edit" : "generate";
  const endpoint = normalizeImageEndpoint(imageSettings.baseUrl, mode === "edit" ? "edits" : "generations");
  const outputFormat = normalizeImageOutputFormat(args?.outputFormat, imageSettings.outputFormat);
  const n = Math.min(
    toIntegerInRange(args?.n, 1, 1, 4),
    toIntegerInRange(imageSettings.maxImages, 1, 1, 4)
  );
  const size = toNullableText(args?.size) ?? imageSettings.defaultSize;
  const quality = toNullableText(args?.quality) ?? imageSettings.defaultQuality;
  const model = toNullableText(imageSettings.model) || "gpt-image-2";
  const background = normalizeImageBackground(args?.background, imageSettings.defaultBackground);
  const moderation = normalizeImageModeration(args?.moderation, imageSettings.defaultModeration);
  const outputCompression = normalizeImageOutputCompression(args?.outputCompression, imageSettings.outputCompression);
  const requestBody =
    mode === "edit"
      ? (() => {
          const form = new FormData();
          form.append("model", model);
          form.append("prompt", prompt);
          form.append("n", String(n));
          form.append("size", size);
          form.append("quality", quality);
          if (outputFormat) form.append("output_format", outputFormat);
          if (background) form.append("background", background);
          if ((outputFormat === "jpeg" || outputFormat === "webp") && Number.isFinite(outputCompression)) {
            form.append("output_compression", String(outputCompression));
          }
          for (let index = 0; index < inputImages.length; index += 1) {
            const image = inputImages[index];
            const parsed = dataUrlToBlob(image.dataUrl);
            if (!parsed) throw new Error(`图片输入无效：第 ${index + 1} 张不是有效的 data URL。`);
            const name = image.name || `image-${index + 1}${imageExtFromMime(parsed.mimeType, outputFormat)}`;
            form.append("image[]", parsed.blob, name);
          }
          const maskDataUrl = toNullableText(args?.maskDataUrl);
          if (maskDataUrl) {
            const parsedMask = dataUrlToBlob(maskDataUrl);
            if (!parsedMask) throw new Error("图片蒙版无效：不是有效的 data URL。");
            form.append("mask", parsedMask.blob, `mask${imageExtFromMime(parsedMask.mimeType, outputFormat)}`);
          }
          return form;
        })()
      : JSON.stringify({
          model,
          prompt,
          n,
          size,
          quality,
          background,
          moderation,
          ...(outputFormat ? { output_format: outputFormat } : {}),
          output_compression: outputFormat === "jpeg" || outputFormat === "webp" ? outputCompression : undefined,
        });

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers:
        mode === "edit"
          ? {
              Authorization: `Bearer ${imageSettings.apiKey}`,
            }
          : {
              Authorization: `Bearer ${imageSettings.apiKey}`,
              "Content-Type": "application/json",
            },
      body: requestBody,
    },
    timeoutMs,
    signal
  );

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`图片${mode === "edit" ? "编辑" : "生成"}失败：HTTP ${response.status}${body ? ` ${body}` : ""}`);
  }

  const json = (await response.json()) as unknown;
  const images = extractGeneratedImages(json);
  if (images.length === 0) throw new Error(`图片${mode === "edit" ? "编辑" : "生成"}响应中没有可用图片。`);

  const threadSegment = sanitizePathSegment(args?.threadId, "app");
  const callSegment = sanitizePathSegment(args?.callId, randomUUID());
  const dir = join(app.getPath("userData"), "generated-images", threadSegment);
  await mkdir(dir, { recursive: true });

  const savedImages: ImageGenerationGeneratedImage[] = [];
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    let buffer = image.buffer;
    let mimeType = image.mimeType || "";
    if (!buffer && image.url) {
      const imageUrl = normalizeHttpUrl(image.url);
      if (!imageUrl) throw new Error(`图片下载地址无效：${image.url}`);
      const imageResponse = await fetchWithTimeout(imageUrl, { method: "GET" }, timeoutMs, signal);
      if (!imageResponse.ok) {
        const body = await readErrorBody(imageResponse);
        throw new Error(`图片下载失败：HTTP ${imageResponse.status}${body ? ` ${body}` : ""}`);
      }
      const contentType = imageResponse.headers.get("content-type") || "";
      mimeType = mimeType || contentType.split(";")[0].trim();
      buffer = Buffer.from(await imageResponse.arrayBuffer());
    }
    if (!buffer) continue;
    const ext = imageExtFromMime(mimeType, outputFormat);
    mimeType = mimeType || imageMimeFromExt(ext);
    const fileName = `${Date.now()}-${callSegment}-${index + 1}${ext}`;
    const filePath = join(dir, fileName);
    await writeFile(filePath, buffer);
    savedImages.push({
      path: filePath,
      dataUrl: imageBufferToDataUrl(buffer, mimeType),
      mimeType,
      revisedPrompt: image.revisedPrompt,
    });
  }

  if (savedImages.length === 0) throw new Error(`图片${mode === "edit" ? "编辑" : "生成"}结果保存失败。`);
  const historyItem = await imageGenerationHistoryService.create({
    model,
    prompt,
    revisedPrompt: savedImages.find((image) => image.revisedPrompt)?.revisedPrompt ?? null,
    mode,
    size,
    quality,
    outputFormat,
    background,
    moderation,
    outputCompression,
    images: savedImages.map((image) => ({
      path: image.path,
      mimeType: image.mimeType,
      revisedPrompt: image.revisedPrompt,
    })),
  });
  return {
    ok: true as const,
    historyId: historyItem.id,
    createdAt: historyItem.createdAt,
    model,
    prompt,
    revisedPrompt: historyItem.revisedPrompt,
    images: savedImages,
  };
}

function focusMainWindow(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return;
  try {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  } catch {}
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
  "木琴铃声-手机来电通知音效_爱给网_aigei_com.mp3",
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
  codexProfileService: CodexProfileService;
  codexSkillRootsService: CodexSkillRootsService;
  imageGenerationHistoryService: ImageGenerationHistoryService;
  imageGenerationTaskService: ImageGenerationTaskService;
  remoteSyncService: RemoteStateSyncService;
}) {
  const {
    localSettingsService,
    codexProfileService,
    codexSkillRootsService,
    imageGenerationHistoryService,
    imageGenerationTaskService,
    remoteSyncService,
  } = deps;
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

  ipcMain.handle(IPC_APP_CHANNELS.appDeleteFile, async (_evt, args: { path: string }) => {
    const filePath = resolveLocalFilePath(args?.path ?? "");
    if (!filePath) throw new Error("app:deleteFile requires path");
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("app:deleteFile path is not a file");
    await unlink(filePath);
    return { ok: true as const };
  });

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

  ipcMain.handle(IPC_APP_CHANNELS.appCodexProfilesRead, async () => {
    const { exists, state } = await codexProfileService.read();
    return { path: codexProfileService.path, exists, state };
  });

  ipcMain.handle(
    IPC_APP_CHANNELS.appCodexProfilesUpsert,
    async (_evt, args: { profile: CodexProviderProfileInput }) => {
      const state = await codexProfileService.upsert(args?.profile ?? {});
      return { path: codexProfileService.path, exists: true as const, state };
    }
  );

  ipcMain.handle(IPC_APP_CHANNELS.appCodexProfilesDelete, async (_evt, args: { id: string }) => {
    const state = await codexProfileService.delete(args?.id ?? "");
    return { path: codexProfileService.path, exists: true as const, state };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appCodexProfilesSetActive, async (_evt, args: { id: string | null }) => {
    const state = await codexProfileService.setActive(args?.id ?? null);
    return { path: codexProfileService.path, exists: true as const, state };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appCodexAuthReadApiKey, async () => {
    const authPath = join(homedir(), ".codex", "auth.json");
    let existing: Record<string, unknown> = {};
    let exists = false;
    try {
      existing = tryParseObjectJson(await readFile(authPath, "utf8"));
      exists = true;
    } catch {}
    const apiKey = toNullableText(existing.OPENAI_API_KEY);
    return { ok: true as const, path: authPath, exists, apiKey, maskedApiKey: maskSecret(apiKey) };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appCodexAuthWriteApiKey, async (_evt, args: { apiKey: string }) => {
    const apiKey = String(args?.apiKey ?? "").trim();
    const authPath = join(homedir(), ".codex", "auth.json");
    let existing: Record<string, unknown> = {};
    try {
      existing = tryParseObjectJson(await readFile(authPath, "utf8"));
    } catch {}
    const next = { ...existing, OPENAI_API_KEY: apiKey };
    await mkdir(dirname(authPath), { recursive: true });
    await writeFile(authPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return { ok: true as const, path: authPath };
  });

  ipcMain.handle(
    IPC_APP_CHANNELS.appCodexProviderTest,
    async (_evt, args: { baseUrl: string; apiKey: string; timeoutMs?: number }) => {
      const endpoint = normalizeOpenAiModelsEndpoint(args?.baseUrl);
      const apiKey = String(args?.apiKey ?? "").trim();
      if (!apiKey) throw new Error("API Key 不能为空。");
      const timeoutMs = toIntegerInRange(args?.timeoutMs, 15_000, 3_000, 60_000);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
        });
        const text = await response.text().catch(() => "");
        let modelCount: number | null = null;
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed?.data)) modelCount = parsed.data.length;
        } catch {}
        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            message: truncateText(text, 240) || response.statusText || "连接失败",
            modelCount,
          };
        }
        return {
          ok: true,
          status: response.status,
          message: modelCount == null ? "连接成功。" : `连接成功，读取到 ${modelCount} 个模型。`,
          modelCount,
        };
      } catch (error: any) {
        return {
          ok: false,
          status: null,
          message: error?.name === "AbortError" ? "连接超时。" : String(error?.message ?? error ?? "连接失败"),
          modelCount: null,
        };
      } finally {
        clearTimeout(timer);
      }
    }
  );

  ipcMain.handle(IPC_APP_CHANNELS.appCodexSkillRootsRead, async () => {
    const { exists, state } = await codexSkillRootsService.read();
    return { path: codexSkillRootsService.path, exists, state };
  });

  ipcMain.handle(
    IPC_APP_CHANNELS.appCodexSkillRootsSetForWorkspace,
    async (_evt, args: { workspacePath: string; roots: string[] }) => {
      const state = await codexSkillRootsService.setRootsForWorkspace(args?.workspacePath ?? "", args?.roots ?? []);
      return { path: codexSkillRootsService.path, exists: true as const, state };
    }
  );

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

  ipcMain.handle(IPC_APP_CHANNELS.appWriteClipboardImageFromPath, async (_evt, args: { path: string }) => {
    const filePath = resolveLocalFilePath(args?.path ?? "");
    if (!filePath) throw new Error("app:writeClipboardImageFromPath requires path");
    const image = nativeImage.createFromPath(filePath);
    if (image.isEmpty()) throw new Error("app:writeClipboardImageFromPath failed to load image");
    clipboard.writeImage(image);
    return { ok: true as const };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appReadImageFileDataUrl, async (_evt, args: { path: string }) => {
    const filePath = resolveLocalFilePath(args?.path ?? "");
    if (!filePath) throw new Error("app:readImageFileDataUrl requires path");
    return { ok: true, dataUrl: await readImageFileAsDataUrl(filePath) };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appImageGenerationGenerate, async (_evt, args: ImageGenerationGenerateArgs) => {
    return generateImagesWithSettings(localSettingsService, imageGenerationHistoryService, args);
  });

  ipcMain.handle(IPC_APP_CHANNELS.appImageGenerationHistoryList, async () => {
    return { items: await imageGenerationHistoryService.list() };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appImageGenerationHistoryDelete, async (_evt, args: { id: string }) => {
    const result = await imageGenerationHistoryService.delete(args?.id);
    return { ok: true as const, ...result };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appImageGenerationTaskList, async () => {
    return { tasks: await imageGenerationTaskService.list() };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appImageGenerationTaskSubmit, async (_evt, args: ImageGenerationGenerateArgs) => {
    const result = await imageGenerationTaskService.submit(args);
    return { ok: true as const, ...result };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appImageGenerationTaskCancel, async (_evt, args: { id: string }) => {
    const result = await imageGenerationTaskService.cancel(args?.id);
    return { ok: true as const, ...result };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appImageGenerationTaskDelete, async (_evt, args: { id: string }) => {
    const result = await imageGenerationTaskService.delete(args?.id);
    return { ok: true as const, ...result };
  });

  ipcMain.handle(IPC_APP_CHANNELS.appImageGenerationTaskRetry, async (_evt, args: { id: string }) => {
    const result = await imageGenerationTaskService.retry(args?.id);
    return { ok: true as const, ...result };
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
