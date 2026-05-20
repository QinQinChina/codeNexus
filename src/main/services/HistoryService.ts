import { HistoryStore, type HistoryThread, type HistoryThreadMetadataPatch } from "../historyStore";
import type {
  HistoryThreadContentArgs,
  HistoryThreadContentResult,
  HistoryThreadLastSummaryArgs,
  HistoryThreadLastSummaryReasonCode,
  HistoryThreadLastSummaryResult,
} from "../../shared/ipc/contracts";

function createEmptyThreadEventsPage() {
  return { entries: [], total: 0, loaded: 0, hasMore: false };
}

function createLastSummaryFailure(
  threadId: string,
  reasonCode: HistoryThreadLastSummaryReasonCode,
  reasonMessage: string,
  source?: "cache" | "disk"
): HistoryThreadLastSummaryResult {
  return {
    found: false,
    threadId,
    reasonCode,
    reasonMessage,
    ...(source ? { source } : {}),
  };
}

export class HistoryService {
  constructor(private readonly historyStore: HistoryStore) {}

  async list(onUpdated?: (items: HistoryThread[]) => void): Promise<HistoryThread[]> {
    // 先返回缓存，再后台刷新；刷新结果通过回调增量推送。
    return await this.historyStore.listWithBackgroundRefresh((next) => {
      onUpdated?.(next);
    });
  }

  async refresh(onUpdated?: (items: HistoryThread[]) => void): Promise<HistoryThread[]> {
    // 强制从磁盘重读，适合手动刷新入口。
    return await this.historyStore.refreshDisk((next) => {
      onUpdated?.(next);
    });
  }

  async mergeThreadMetadata(
    args: { threads?: HistoryThreadMetadataPatch[] },
    onUpdated?: (items: HistoryThread[]) => void
  ): Promise<HistoryThread[]> {
    const next = await this.historyStore.mergeThreadMetadata(Array.isArray(args?.threads) ? args.threads : []);
    onUpdated?.(next);
    return next;
  }

  async deleteThread(args: { threadId: string }, onUpdated?: (items: HistoryThread[]) => void): Promise<{ ok: true }> {
    const threadId = typeof args?.threadId === "string" ? args.threadId.trim() : "";
    if (!threadId) return { ok: true };
    const next = await this.historyStore.deleteThread(threadId);
    onUpdated?.(next);
    return { ok: true };
  }

  async threadMessages(args: { threadId: string; limit?: number }) {
    const threadId = typeof args?.threadId === "string" ? args.threadId.trim() : "";
    if (!threadId) return [];
    // 默认限制返回条数，避免一次性拉取过大历史。
    const limit = typeof args?.limit === "number" ? args.limit : 120;
    return await this.historyStore.getThreadMessages(threadId, limit);
  }

  async threadEvents(args: { threadId: string; limit?: number; before?: number; includeAux?: boolean }) {
    const threadId = typeof args?.threadId === "string" ? args.threadId.trim() : "";
    if (!threadId) return { entries: [], total: 0, loaded: 0, hasMore: false };
    // 事件流仍通过分页窗口读取；renderer 可按 before 游标循环拉满历史。
    const limit = typeof args?.limit === "number" ? args.limit : 150;
    const before = typeof args?.before === "number" ? args.before : 0;
    const includeAux = args?.includeAux !== false;
    return await this.historyStore.getThreadEvents(threadId, { limit, before, includeAux });
  }

  async threadContent(args: HistoryThreadContentArgs): Promise<HistoryThreadContentResult> {
    const threadId = typeof args?.threadId === "string" ? args.threadId.trim() : "";
    if (!threadId) {
      return {
        found: false,
        threadId: "",
        thread: null,
        messages: [],
        eventsPage: createEmptyThreadEventsPage(),
      };
    }

    // 默认窗口偏保守：先保障快速读取，后续通过 before/limit 分页继续拉取。
    const messageLimit = typeof args?.messageLimit === "number" ? args.messageLimit : 80;
    const eventLimit = typeof args?.eventLimit === "number" ? args.eventLimit : 120;
    const eventBefore = typeof args?.eventBefore === "number" ? args.eventBefore : 0;
    const includeAux = args?.includeAux !== false;

    const cached = await this.historyStore.listWithBackgroundRefresh();
    let thread = cached.find((item) => item.id === threadId) ?? null;
    if (!thread) {
      const refreshed = await this.historyStore.refreshDisk();
      thread = refreshed.find((item) => item.id === threadId) ?? null;
    }
    if (!thread) {
      return {
        found: false,
        threadId,
        thread: null,
        messages: [],
        eventsPage: createEmptyThreadEventsPage(),
      };
    }

    const [messages, eventsPage] = await Promise.all([
      this.historyStore.getThreadMessages(threadId, messageLimit),
      this.historyStore.getThreadEvents(threadId, {
        limit: eventLimit,
        before: eventBefore,
        includeAux,
      }),
    ]);

    return {
      found: true,
      threadId,
      thread,
      messages,
      eventsPage,
    };
  }

  async threadLastSummary(args: HistoryThreadLastSummaryArgs): Promise<HistoryThreadLastSummaryResult> {
    const threadId = typeof args?.threadId === "string" ? args.threadId.trim() : "";
    if (!threadId) {
      return createLastSummaryFailure("", "INVALID_THREAD_ID", "threadId is required");
    }

    const messageLimitRaw = Number(args?.messageLimit);
    const messageLimit = Number.isFinite(messageLimitRaw) ? Math.max(1, Math.round(messageLimitRaw)) : 120;

    const cached = await this.historyStore.listWithBackgroundRefresh();
    let thread = cached.find((item) => item.id === threadId) ?? null;
    let source: "cache" | "disk" = "cache";
    if (!thread) {
      const refreshed = await this.historyStore.refreshDisk();
      thread = refreshed.find((item) => item.id === threadId) ?? null;
      source = "disk";
    }
    if (!thread) {
      return createLastSummaryFailure(threadId, "THREAD_NOT_FOUND", "Thread not found");
    }

    const messages = await this.historyStore.getThreadMessages(threadId, messageLimit);
    const pickFromTail = (role: "assistant" | "user") => {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const item = messages[index];
        if (item.role !== role) continue;
        const text = String(item.text ?? "").trim();
        if (!text) continue;
        return item;
      }
      return null;
    };

    const picked = pickFromTail("assistant") ?? pickFromTail("user");
    if (!picked) {
      return createLastSummaryFailure(threadId, "SUMMARY_NOT_FOUND", "No available summary found", source);
    }

    return {
      found: true,
      threadId,
      summaryText: picked.text,
      summaryRole: picked.role,
      source,
      ...(picked.timestamp ? { timestamp: picked.timestamp } : {}),
    };
  }
}
