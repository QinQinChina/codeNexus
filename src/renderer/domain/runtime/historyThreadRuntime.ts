import { codexDesktop } from "../../api/codexDesktopClient";
import type {
  HistoryThreadContentResult,
  HistoryThreadTaskCreateArgs,
  HistoryThreadTaskCreateResult,
  HistoryThreadTaskUpdateArgs,
  HistoryThreadTaskUpdateResult,
} from "../../../shared/ipc/contracts";
import {
  cloneHistoryThreadContentResult,
  pruneExpiredThreadContentCache,
  toThreadContentCacheKey,
  type ThreadContentCacheEntry,
} from "./rendererCacheRuntime";

type HistoryThreadRuntimeDeps = {
  getCurrentThreadId: () => string;
  threadContentCacheByKey: Map<string, ThreadContentCacheEntry>;
  threadContentCacheTtlMs: number;
};

export type HistoryThreadRuntime = {
  readThreadContent: (params?: {
    threadId?: string;
    messageLimit?: number;
    eventLimit?: number;
    eventBefore?: number;
    includeAux?: boolean;
  }) => Promise<HistoryThreadContentResult>;
  createThreadTask: (args: HistoryThreadTaskCreateArgs) => Promise<HistoryThreadTaskCreateResult>;
  updateThreadTask: (args: HistoryThreadTaskUpdateArgs) => Promise<HistoryThreadTaskUpdateResult>;
};

function toOptionalRoundedNumber(value: unknown): number | undefined {
  const raw = Number(value);
  return Number.isFinite(raw) ? Math.round(raw) : undefined;
}

export function createHistoryThreadRuntime(deps: HistoryThreadRuntimeDeps): HistoryThreadRuntime {
  const readThreadContent = async (params?: {
    threadId?: string;
    messageLimit?: number;
    eventLimit?: number;
    eventBefore?: number;
    includeAux?: boolean;
  }): Promise<HistoryThreadContentResult> => {
    const threadId = String(params?.threadId ?? deps.getCurrentThreadId() ?? "").trim();
    if (!threadId) {
      return {
        found: false,
        threadId: "",
        thread: null,
        messages: [],
        eventsPage: { entries: [], total: 0, loaded: 0, hasMore: false },
      };
    }

    const messageLimit = toOptionalRoundedNumber(params?.messageLimit);
    const eventLimit = toOptionalRoundedNumber(params?.eventLimit);
    const eventBefore = toOptionalRoundedNumber(params?.eventBefore);
    const includeAux = typeof params?.includeAux === "boolean" ? params.includeAux : undefined;
    const cacheKey = toThreadContentCacheKey({
      threadId,
      messageLimit,
      eventLimit,
      eventBefore,
      includeAux,
    });
    pruneExpiredThreadContentCache(deps.threadContentCacheByKey);
    const cached = deps.threadContentCacheByKey.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cloneHistoryThreadContentResult(cached.result);
    }

    const fetched = await codexDesktop.history.getThreadContent({
      threadId,
      ...(messageLimit != null ? { messageLimit } : {}),
      ...(eventLimit != null ? { eventLimit } : {}),
      ...(eventBefore != null ? { eventBefore } : {}),
      ...(includeAux != null ? { includeAux } : {}),
    });
    deps.threadContentCacheByKey.set(cacheKey, {
      threadId,
      expiresAt: Date.now() + deps.threadContentCacheTtlMs,
      result: cloneHistoryThreadContentResult(fetched),
    });
    return fetched;
  };

  const createThreadTask = async (args: HistoryThreadTaskCreateArgs): Promise<HistoryThreadTaskCreateResult> => {
    return await codexDesktop.history.createThreadTask(args);
  };

  const updateThreadTask = async (args: HistoryThreadTaskUpdateArgs): Promise<HistoryThreadTaskUpdateResult> => {
    return await codexDesktop.history.updateThreadTask(args);
  };

  return {
    readThreadContent,
    createThreadTask,
    updateThreadTask,
  };
}
