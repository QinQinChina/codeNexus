import {
  DEFAULT_LOCAL_DRAFT_STATE,
  mergeLocalDraftThreadStates,
  normalizeLocalDraftState,
  removeLocalDraftThreadState,
  type LocalDraftState,
  type LocalThreadComposeState,
  upsertLocalDraftThreadState,
} from "../../shared/localDraftState";
import { safeJsonStringify } from "../utils/safeJson";
import { codexDesktop } from "../api/codexDesktopClient";
import { resolveLocalStateFilePath } from "./localStateFiles";

function resolveDraftStatePath(): string {
  return resolveLocalStateFilePath("draft-state.json");
}

let cachedDraftState: LocalDraftState = normalizeLocalDraftState(DEFAULT_LOCAL_DRAFT_STATE);
let loadedPath: string | null = null;
let pendingLoad: Promise<LocalDraftState> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function serializedDraftState(state: LocalDraftState): string {
  return `${safeJsonStringify(state, { space: 2 })}\n`;
}

async function writeCachedDraftState(): Promise<void> {
  const filePath = resolveDraftStatePath();
  if (!filePath) return;
  await codexDesktop.app.writeTextFile({
    path: filePath,
    content: serializedDraftState(cachedDraftState),
  });
}

export function getLocalDraftStatePath(): string {
  return resolveDraftStatePath();
}

export function getCachedLocalDraftState(): LocalDraftState {
  return normalizeLocalDraftState(cachedDraftState);
}

export async function loadLocalDraftState(force = false): Promise<LocalDraftState> {
  const filePath = resolveDraftStatePath();
  if (!filePath) {
    loadedPath = null;
    return getCachedLocalDraftState();
  }

  if (!force && loadedPath === filePath) return getCachedLocalDraftState();
  if (!pendingLoad) {
    pendingLoad = (async () => {
      try {
        const result = await codexDesktop.app.readTextFile({ path: filePath });
        cachedDraftState = normalizeLocalDraftState(JSON.parse(String(result?.content ?? "{}")));
      } catch {
        cachedDraftState = normalizeLocalDraftState(DEFAULT_LOCAL_DRAFT_STATE);
      }
      loadedPath = filePath;
      return getCachedLocalDraftState();
    })().finally(() => {
      pendingLoad = null;
    });
  }
  return pendingLoad;
}

export function replaceCachedLocalDraftState(next: unknown): LocalDraftState {
  cachedDraftState = normalizeLocalDraftState(next);
  loadedPath = resolveDraftStatePath() || loadedPath;
  return getCachedLocalDraftState();
}

export async function saveLocalDraftThreadState(threadId: string, state: LocalThreadComposeState): Promise<void> {
  cachedDraftState = upsertLocalDraftThreadState(cachedDraftState, threadId, state);
  loadedPath = resolveDraftStatePath() || loadedPath;
  writeQueue = writeQueue.catch(() => undefined).then(() => writeCachedDraftState());
  return writeQueue;
}

export async function saveLocalDraftThreadStates(
  statesByThread: Record<string, LocalThreadComposeState>
): Promise<void> {
  cachedDraftState = mergeLocalDraftThreadStates(cachedDraftState, statesByThread);
  loadedPath = resolveDraftStatePath() || loadedPath;
  writeQueue = writeQueue.catch(() => undefined).then(() => writeCachedDraftState());
  return writeQueue;
}

export async function clearSavedLocalDraftThreadState(threadId: string): Promise<void> {
  cachedDraftState = removeLocalDraftThreadState(cachedDraftState, threadId);
  loadedPath = resolveDraftStatePath() || loadedPath;
  writeQueue = writeQueue.catch(() => undefined).then(() => writeCachedDraftState());
  return writeQueue;
}

export function getLocalDraftMemoryCacheStats(): { items: number; bytes: number; updatedAt: number } {
  const threads =
    cachedDraftState?.threads && typeof cachedDraftState.threads === "object" ? cachedDraftState.threads : {};
  return {
    items: Object.keys(threads).length,
    bytes: JSON.stringify(cachedDraftState).length,
    updatedAt: Date.now(),
  };
}

export function clearLocalDraftMemoryCache(): void {
  cachedDraftState = normalizeLocalDraftState(DEFAULT_LOCAL_DRAFT_STATE);
  loadedPath = null;
  pendingLoad = null;
}
