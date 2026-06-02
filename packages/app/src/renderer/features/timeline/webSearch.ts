import type { ThreadItem } from "@codenexus/generated/codex-app-server/v2/ThreadItem";
import type { TimelineEventItem } from "../../domain/types";

type WebSearchThreadItem = Extract<ThreadItem, { type: "webSearch" }>;

export type NormalizedWebSearchActionType = "search" | "openPage" | "findInPage" | "other";

export type NormalizedWebSearchAction =
  | { type: "search"; query: string; queries: string[] }
  | { type: "openPage"; url: string }
  | { type: "findInPage"; url: string; pattern: string }
  | { type: "other" };

export type NormalizedWebSearchItem = {
  itemId: string;
  query: string;
  action: NormalizedWebSearchAction;
};

export type NormalizedWebSearchTimelineItem = NormalizedWebSearchItem & {
  status: "running" | "completed";
};

export type NormalizedHistoryWebSearchCall = {
  method: "item/started" | "item/completed";
  query: string;
  action: NormalizedWebSearchAction;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    const text = normalizeText(entry);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function normalizeActionType(value: unknown): NormalizedWebSearchActionType {
  const type = normalizeText(value);
  if (type === "search") return "search";
  if (type === "openPage" || type === "open_page") return "openPage";
  if (type === "findInPage" || type === "find_in_page") return "findInPage";
  return "other";
}

export function normalizeWebSearchAction(value: unknown): NormalizedWebSearchAction {
  const record = toRecord(value);
  const type = normalizeActionType(record.type);

  if (type === "search") {
    const queries = toStringArray(record.queries);
    const query = normalizeText(record.query) || queries[0] || "";
    return {
      type,
      query,
      queries: query && !queries.includes(query) ? [query, ...queries] : queries,
    };
  }

  if (type === "openPage") {
    return {
      type,
      url: normalizeText(record.url),
    };
  }

  if (type === "findInPage") {
    return {
      type,
      url: normalizeText(record.url),
      pattern: normalizeText(record.pattern),
    };
  }

  return { type: "other" };
}

export function deriveWebSearchQueryFromAction(action: NormalizedWebSearchAction): string {
  if (action.type === "search") {
    return action.query || action.queries[0] || "";
  }
  if (action.type === "openPage") {
    return action.url;
  }
  if (action.type === "findInPage") {
    if (action.pattern && action.url) return `'${action.pattern}' in ${action.url}`;
    return action.pattern || action.url;
  }
  return "";
}

export function normalizeWebSearchItem(value: unknown): NormalizedWebSearchItem | null {
  const item = value as Partial<WebSearchThreadItem> | null | undefined;
  if (!item || item.type !== "webSearch") return null;

  const itemId = normalizeText(item.id);
  if (!itemId) return null;

  const action = normalizeWebSearchAction(item.action);
  const query = normalizeText(item.query) || deriveWebSearchQueryFromAction(action);

  return {
    itemId,
    query,
    action,
  };
}

function toTimelineEventParamsObject(event: TimelineEventItem): Record<string, unknown> | null {
  if (event.params && typeof event.params === "object") return event.params as Record<string, unknown>;
  const paramsText = normalizeText(event.paramsText);
  if (!paramsText || (!paramsText.startsWith("{") && !paramsText.startsWith("["))) return null;
  try {
    const parsed = JSON.parse(paramsText);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function extractWebSearchTimelineItem(event: TimelineEventItem): NormalizedWebSearchTimelineItem | null {
  if (event.method !== "item/started" && event.method !== "item/completed") return null;
  const payload = toTimelineEventParamsObject(event);
  const normalized = normalizeWebSearchItem(payload?.item);
  if (!normalized) return null;
  return {
    ...normalized,
    status: event.method === "item/started" ? "running" : "completed",
  };
}

export function normalizeHistoryWebSearchCall(value: unknown): NormalizedHistoryWebSearchCall | null {
  const record = toRecord(value);
  if (normalizeText(record.type) !== "web_search_call") return null;

  const action = normalizeWebSearchAction(record.action);
  const query = normalizeText(record.query) || deriveWebSearchQueryFromAction(action);
  const statusRaw = normalizeText(record.status).toLowerCase();
  const method = /(running|inprogress|in_progress|pending|queued|started|start)/.test(statusRaw)
    ? "item/started"
    : "item/completed";

  return {
    method,
    query,
    action,
  };
}
