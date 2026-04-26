import type { CacheStatsItem, HistoryThreadContentResult } from "../../../shared/ipc/contracts";

export type RendererCacheProviderStats = {
  items: number;
  bytes: number;
  updatedAt?: number;
  note?: string;
};

export type RendererCacheProvider = {
  namespace: string;
  clearable?: boolean;
  getStats: () => RendererCacheProviderStats | Promise<RendererCacheProviderStats>;
  clear?: () => void | Promise<void>;
};

export type ThreadContentCacheEntry = {
  threadId: string;
  expiresAt: number;
  result: HistoryThreadContentResult;
};

export function normalizeCacheCount(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num));
}

export function normalizeCacheNamespace(value: unknown): string {
  return String(value ?? "").trim();
}

export function cloneHistoryThreadContentResult(input: HistoryThreadContentResult): HistoryThreadContentResult {
  return {
    found: Boolean(input?.found),
    threadId: String(input?.threadId ?? "").trim(),
    thread: input?.thread ? { ...input.thread } : null,
    messages: Array.isArray(input?.messages) ? input.messages.map((item) => ({ ...item })) : [],
    eventsPage: {
      entries: Array.isArray(input?.eventsPage?.entries) ? input.eventsPage.entries.map((item) => ({ ...item })) : [],
      total: normalizeCacheCount(input?.eventsPage?.total),
      loaded: normalizeCacheCount(input?.eventsPage?.loaded),
      hasMore: Boolean(input?.eventsPage?.hasMore),
    },
  };
}

export function toThreadContentCacheKey(args: {
  threadId: string;
  messageLimit?: number;
  eventLimit?: number;
  eventBefore?: number;
  includeAux?: boolean;
}): string {
  return [
    String(args.threadId ?? "").trim(),
    Number.isFinite(Number(args.messageLimit)) ? Math.round(Number(args.messageLimit)) : "",
    Number.isFinite(Number(args.eventLimit)) ? Math.round(Number(args.eventLimit)) : "",
    Number.isFinite(Number(args.eventBefore)) ? Math.round(Number(args.eventBefore)) : "",
    args.includeAux === false ? "noAux" : "aux",
  ].join("|");
}

export function pruneExpiredThreadContentCache(cache: Map<string, ThreadContentCacheEntry>, now = Date.now()): void {
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt > now) continue;
    cache.delete(key);
  }
}

export function invalidateThreadContentCache(
  cache: Map<string, ThreadContentCacheEntry>,
  threadIdValue?: string
): void {
  const threadId = String(threadIdValue ?? "").trim();
  if (!threadId) {
    cache.clear();
    return;
  }
  for (const [key, entry] of cache.entries()) {
    if (entry.threadId !== threadId && !key.startsWith(`${threadId}|`)) continue;
    cache.delete(key);
  }
}

export function toRendererCacheItem(
  namespace: string,
  provider: RendererCacheProvider,
  stats: RendererCacheProviderStats,
  now = Date.now()
): CacheStatsItem {
  return {
    namespace,
    scope: "renderer",
    clearable: provider.clearable !== false && typeof provider.clear === "function",
    items: normalizeCacheCount(stats.items),
    bytes: normalizeCacheCount(stats.bytes),
    updatedAt: normalizeCacheCount(stats.updatedAt ?? now),
    note: String(stats.note ?? "").trim() || undefined,
  };
}
