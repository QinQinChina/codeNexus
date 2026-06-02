import {
  DEFAULT_LOCAL_MESSAGE_OUTBOX,
  normalizeLocalMessageOutbox,
  removeLocalMessageOutboxThread,
  replaceLocalMessageOutboxThread,
  type LocalMessageOutbox,
  type LocalOutboxQueuedMessage,
} from "@codenexus/shared/localMessageOutbox";
import { safeJsonStringify } from "../utils/safeJson";
import { codexDesktop } from "../api/codexDesktopClient";
import { resolveLocalStateFilePath } from "./localStateFiles";

function resolveMessageOutboxPath(): string {
  return resolveLocalStateFilePath("message-outbox.json");
}

let cachedMessageOutbox: LocalMessageOutbox = normalizeLocalMessageOutbox(DEFAULT_LOCAL_MESSAGE_OUTBOX);
let loadedPath: string | null = null;
let pendingLoad: Promise<LocalMessageOutbox> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function serializedMessageOutbox(state: LocalMessageOutbox): string {
  return `${safeJsonStringify(state, { space: 2 })}\n`;
}

async function writeCachedMessageOutbox(): Promise<void> {
  const filePath = resolveMessageOutboxPath();
  if (!filePath) return;
  await codexDesktop.app.writeTextFile({
    path: filePath,
    content: serializedMessageOutbox(cachedMessageOutbox),
  });
}

export function getLocalMessageOutboxPath(): string {
  return resolveMessageOutboxPath();
}

export function getCachedLocalMessageOutbox(): LocalMessageOutbox {
  return normalizeLocalMessageOutbox(cachedMessageOutbox);
}

export async function loadLocalMessageOutbox(force = false): Promise<LocalMessageOutbox> {
  const filePath = resolveMessageOutboxPath();
  if (!filePath) {
    loadedPath = null;
    return getCachedLocalMessageOutbox();
  }

  if (!force && loadedPath === filePath) return getCachedLocalMessageOutbox();
  if (!pendingLoad) {
    pendingLoad = (async () => {
      try {
        const result = await codexDesktop.app.readTextFile({ path: filePath });
        cachedMessageOutbox = normalizeLocalMessageOutbox(JSON.parse(String(result?.content ?? "{}")));
      } catch {
        cachedMessageOutbox = normalizeLocalMessageOutbox(DEFAULT_LOCAL_MESSAGE_OUTBOX);
      }
      loadedPath = filePath;
      return getCachedLocalMessageOutbox();
    })().finally(() => {
      pendingLoad = null;
    });
  }
  return pendingLoad;
}

export function replaceCachedLocalMessageOutbox(next: unknown): LocalMessageOutbox {
  cachedMessageOutbox = normalizeLocalMessageOutbox(next);
  loadedPath = resolveMessageOutboxPath() || loadedPath;
  return getCachedLocalMessageOutbox();
}

export async function saveLocalMessageOutboxThread(threadId: string, items: LocalOutboxQueuedMessage[]): Promise<void> {
  cachedMessageOutbox = replaceLocalMessageOutboxThread(cachedMessageOutbox, threadId, items);
  loadedPath = resolveMessageOutboxPath() || loadedPath;
  writeQueue = writeQueue.catch(() => undefined).then(() => writeCachedMessageOutbox());
  return writeQueue;
}

export async function clearSavedLocalMessageOutboxThread(threadId: string): Promise<void> {
  cachedMessageOutbox = removeLocalMessageOutboxThread(cachedMessageOutbox, threadId);
  loadedPath = resolveMessageOutboxPath() || loadedPath;
  writeQueue = writeQueue.catch(() => undefined).then(() => writeCachedMessageOutbox());
  return writeQueue;
}

export function getLocalMessageOutboxMemoryCacheStats(): { items: number; bytes: number; updatedAt: number } {
  const threads =
    cachedMessageOutbox?.threads && typeof cachedMessageOutbox.threads === "object" ? cachedMessageOutbox.threads : {};
  return {
    items: Object.keys(threads).length,
    bytes: JSON.stringify(cachedMessageOutbox).length,
    updatedAt: Date.now(),
  };
}

export function clearLocalMessageOutboxMemoryCache(): void {
  cachedMessageOutbox = normalizeLocalMessageOutbox(DEFAULT_LOCAL_MESSAGE_OUTBOX);
  loadedPath = null;
  pendingLoad = null;
}
