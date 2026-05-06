import { computed, ref, watch } from "vue";
import type { TimelineEventItem } from "../../domain/types";
import {
  buildTimelineRenderNodes,
  type TimelineRenderNode,
  type ReasoningBlockNode,
} from "../../features/timeline/renderModel/buildTimelineNodes";
import { isLocalUserEvent, isMarkdownEvent } from "../../features/timeline/renderModel/formatters";
import { useRuntimeStore } from "../../stores/runtime.store";
import { extractWebSearchTimelineItem } from "../../features/timeline/webSearch";
import { buildImageToolItemFromProtocolItem } from "../../features/timeline/imageToolRender";
import {
  buildGuardianApprovalReviewActivity,
  isGuardianApprovalReviewMethod,
} from "../../features/guardian/guardianApprovalReview";
import type { ChatRow, ChatRenderedRow, ChatWebSearchItem } from "./chat.types";

const STREAM_NOTIFICATION_ACTIVITY_METHODS = new Set([
  "command/exec/outputDelta",
  "item/commandExecution/terminalInteraction",
]);

function shortenActivityText(value: unknown, max = 220): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function toEventParamsObject(event: TimelineEventItem): Record<string, any> {
  return event.params && typeof event.params === "object" && !Array.isArray(event.params)
    ? (event.params as Record<string, any>)
    : {};
}

function decodeBase64Utf8(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    if (typeof atob === "function") {
      const binary = atob(raw);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
  } catch {}
  try {
    const bufferCtor = (globalThis as any).Buffer;
    if (bufferCtor?.from) return bufferCtor.from(raw, "base64").toString("utf8");
  } catch {}
  return raw;
}

function streamNotificationActivityText(event: TimelineEventItem): string {
  const params = toEventParamsObject(event);
  if (event.method === "command/exec/outputDelta") {
    const stream = String(params.stream ?? "").trim();
    const text = decodeBase64Utf8(params.deltaBase64);
    const suffix = params.capReached === true ? "（已截断）" : "";
    return `命令输出${stream ? ` ${stream}` : ""}：${shortenActivityText(text || event.paramsText || "收到输出")}${suffix}`;
  }
  if (event.method === "item/commandExecution/terminalInteraction") {
    const stdin = String(params.stdin ?? event.paramsText ?? "").trim();
    return `终端输入：${shortenActivityText(stdin || "空输入")}`;
  }
  return "";
}

function uniqueNonEmptyStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function extractUrlHost(value: string): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try {
    return new URL(text).host;
  } catch {}
  try {
    return new URL(`https://${text}`).host;
  } catch {}
  return "";
}

export function useChatRenderModel(
  contentEvents: () => TimelineEventItem[],
  workspaceRoot: () => string,
  mcpToolDefinitions: () => any,
  onLayoutChange?: () => void
) {
  const runtimeStore = useRuntimeStore();

  const toWebSearchChatItem = (event: TimelineEventItem): ChatWebSearchItem | null => {
    const normalized = extractWebSearchTimelineItem(event);
    if (!normalized) return null;
    const actionType = normalized.action.type;
    let title = "网页搜索";
    let actionLabel = "其他";
    let primaryText = normalized.query || "网页操作";
    let secondaryText = "";
    let summaryText = normalized.query || "网页操作";
    let queries: string[] = [];
    let url = "";
    let pattern = "";
    let host = "";
    if (actionType === "search") {
      actionLabel = "搜索";
      queries = uniqueNonEmptyStrings([normalized.action.query, ...(normalized.action.queries || [])]);
      primaryText = queries[0] || normalized.query || "搜索网页";
      secondaryText = queries.length > 1 ? `共 ${queries.length} 个查询` : "";
      summaryText = queries.join(" ｜ ") || primaryText;
    } else if (actionType === "openPage") {
      title = "打开页面";
      actionLabel = "打开";
      url = normalized.action.url || normalized.query || "";
      host = extractUrlHost(url);
      primaryText = host || url || "打开搜索结果页面";
      secondaryText = host && url ? url : "";
      summaryText = url || primaryText;
    } else if (actionType === "findInPage") {
      title = "页内查找";
      actionLabel = "查找";
      url = normalized.action.url || "";
      pattern = normalized.action.pattern || "";
      host = extractUrlHost(url);
      primaryText = pattern || "页内查找";
      secondaryText = url ? `${host || "页面"}${pattern ? ` ｜ ${url}` : ""}` : "";
      summaryText = pattern
        ? url
          ? `关键词：${pattern} ｜ 页面：${url}`
          : `关键词：${pattern}`
        : url || normalized.query || "页内查找";
    }
    return {
      itemId: normalized.itemId,
      actionType,
      status: normalized.status,
      title,
      summaryText,
      actionLabel,
      primaryText,
      secondaryText,
      queries,
      url,
      pattern,
      host,
    };
  };

  const buildChatRowsFromNodes = (nodes: TimelineRenderNode[], threadKeyFallback: string) => {
    const rows: ChatRow[] = [];
    const rowIndexById = new Map<string, number>();
    const pushRow = (row: ChatRow) => {
      rowIndexById.set(row.id, rows.length);
      rows.push(row);
    };
    const upsertRow = (row: ChatRow) => {
      const index = rowIndexById.get(row.id);
      if (index != null) {
        rows[index] = { ...row, turnKey: rows[index].turnKey || row.turnKey };
        return;
      }
      pushRow(row);
    };

    const toChatTurnKey = (turnIdValue: unknown, fallbackValue: unknown, threadKey: string) => {
      const turnId = String(turnIdValue ?? "").trim();
      return turnId ? `turn:${turnId}` : `loose:${String(fallbackValue ?? "").trim() || threadKey || "__app__"}`;
    };

    for (const node of nodes) {
      const turnKey =
        node.kind === "event"
          ? toChatTurnKey(node.event.turnId, String(node.event.id ?? "").trim() || node.id, threadKeyFallback)
          : node.kind === "mcpToolGroup"
            ? toChatTurnKey(node.group.turnId, node.id, threadKeyFallback)
            : toChatTurnKey(node.item.turnId, node.id, threadKeyFallback);

      if (node.kind === "event") {
        const e = node.event;
        if (isLocalUserEvent(e)) {
          pushRow({ id: `u:${e.id}`, turnKey, kind: "user", event: e });
          continue;
        }
        if (e.method === "history/contextInjected") {
          const p = (e.params ?? {}) as any;
          const f = (
            typeof p.file === "string" ? p.file : (String(e.paramsText ?? "").match(/\bfile=([^\s]+)\b/)?.[1] ?? "")
          ).trim();
          const r = typeof p.rules === "number" ? p.rules : null;
          pushRow({
            id: `x:${e.id}`,
            turnKey,
            kind: "activity",
            text: f
              ? `读取 ${f} 文件${r && r > 0 ? `（规则 ${r}）` : ""}`
              : String(e.paramsText ?? "").trim() || "已注入上下文",
            createdAt: e.createdAt,
          });
          continue;
        }
        if (isGuardianApprovalReviewMethod(e.method)) {
          const g = buildGuardianApprovalReviewActivity(e.method, e.params);
          if (g) {
            pushRow({
              id: `guardian:${e.id}`,
              turnKey,
              kind: "activity",
              text: g.summaryText || String(e.paramsText ?? "").trim() || "Guardian 审批复核",
              createdAt: e.createdAt,
              tone: g.tone,
            });
            continue;
          }
        }
        if (STREAM_NOTIFICATION_ACTIVITY_METHODS.has(e.method)) {
          const text = streamNotificationActivityText(e);
          if (text) {
            pushRow({ id: `stream:${e.id}`, turnKey, kind: "activity", text, createdAt: e.createdAt });
            continue;
          }
        }
        if ((e.method === "item/agentMessage/delta" && isMarkdownEvent(e)) || e.method === "item/plan/delta") {
          pushRow({ id: `a:${e.id}`, turnKey, kind: "assistant", event: e });
          continue;
        }
        if (e.method === "item/started" || e.method === "item/completed") {
          const item = ((e.params ?? {}) as any).item;
          const type = item && typeof item === "object" ? String(item.type ?? "").trim() : "";
          if (type === "imageView" || type === "imageGeneration") {
            const imageToolItem = buildImageToolItemFromProtocolItem(item, e.method);
            if (imageToolItem) {
              upsertRow({
                id: `imgtool:${imageToolItem.itemType}:${imageToolItem.itemId}`,
                turnKey,
                kind: "imageTool",
                createdAt: e.createdAt,
                item: imageToolItem,
              });
            }
            continue;
          }
          if (type === "webSearch") {
            const wsi = toWebSearchChatItem(e);
            if (wsi)
              upsertRow({
                id: `websearch:${wsi.itemId}`,
                turnKey,
                kind: "webSearch",
                createdAt: e.createdAt,
                item: wsi,
              });
            continue;
          }
        }
        if (e.method === "rawResponseItem/completed") {
          const item = ((e.params ?? {}) as any).item;
          const imageToolItem = buildImageToolItemFromProtocolItem(item, e.method);
          if (imageToolItem) {
            upsertRow({
              id: `imgtool:${imageToolItem.itemType}:${imageToolItem.itemId}`,
              turnKey,
              kind: "imageTool",
              createdAt: e.createdAt,
              item: imageToolItem,
            });
            continue;
          }
        }
        if (e.level === "error")
          pushRow({ id: `s:${e.id}`, turnKey, kind: "system", text: String(e.paramsText ?? "").trim() || e.method });
        continue;
      }
      if (node.kind === "reasoningBlock") {
        pushRow({ id: `r:${node.id}`, turnKey, kind: "reasoningBlock", item: node.item });
        continue;
      }
      if (node.kind === "fileChange") {
        pushRow({ id: `f:${node.id}`, turnKey, kind: "fileChange", item: node.item });
        continue;
      }
      if (node.kind === "commandAction") {
        pushRow({ id: `c:${node.id}`, turnKey, kind: "commandAction", item: node.item });
        continue;
      }
      if (node.kind === "commandRead") {
        pushRow({ id: `cr:${node.id}`, turnKey, kind: "commandRead", item: node.item });
        continue;
      }
      if (node.kind === "commandList") {
        pushRow({ id: `cl:${node.id}`, turnKey, kind: "commandList", item: node.item });
        continue;
      }
      if (node.kind === "commandSearch") {
        pushRow({ id: `cs:${node.id}`, turnKey, kind: "commandSearch", item: node.item });
        continue;
      }
      if (node.kind === "mcpResourceRead") {
        pushRow({ id: `mr:${node.id}`, turnKey, kind: "mcpResourceRead", item: node.item });
        continue;
      }
      if (node.kind === "mcpToolGroup")
        pushRow({ id: `m:${node.id}`, turnKey, kind: "mcpToolGroup", group: node.group });
    }
    return rows;
  };

  const chatRows = computed<ChatRow[]>(() => {
    const threadKey = String(runtimeStore.timelineKey ?? "__app__").trim() || "__app__";
    const nodes = buildTimelineRenderNodes({
      events: contentEvents(),
      timelineKey: runtimeStore.timelineKey,
      workspaceRoot: workspaceRoot(),
      debug: false,
      mcpToolDefinitions: mcpToolDefinitions(),
    });
    return buildChatRowsFromNodes(nodes, threadKey);
  });

  const chatRenderedRows = computed<ChatRenderedRow[]>(() => chatRows.value);

  const reasoningOpenById = ref(new Map<string, boolean>());
  const autoCollapsedReasoningIds = ref(new Set<string>());
  const isReasoningOpen = (b: ReasoningBlockNode) => {
    const id = String(b?.id ?? "").trim();
    if (!id) return false;
    const f = reasoningOpenById.value.get(id);
    return typeof f === "boolean" ? f : Boolean(b.openDefault);
  };
  const setReasoningOpen = (b: ReasoningBlockNode, open: boolean) => {
    const id = String(b?.id ?? "").trim();
    if (!id) return;
    reasoningOpenById.value.set(id, open);
    onLayoutChange?.();
  };

  const reasoningAutoCollapseCandidateIds = computed<string[]>(() => {
    const seen = new Set<string>(),
      candidates = new Set<string>();
    for (let idx = chatRows.value.length - 1; idx >= 0; idx -= 1) {
      const r = chatRows.value[idx];
      if (!r.turnKey) continue;
      if (r.kind === "reasoningBlock") {
        if (seen.has(r.turnKey)) {
          const id = String(r.item.id ?? "").trim();
          if (id) candidates.add(id);
        }
      } else seen.add(r.turnKey);
    }
    return [...candidates];
  });

  watch(
    reasoningAutoCollapseCandidateIds,
    (ids) => {
      let changed = false;
      for (const id of ids) {
        if (!autoCollapsedReasoningIds.value.has(id)) {
          autoCollapsedReasoningIds.value.add(id);
          reasoningOpenById.value.set(id, false);
          changed = true;
        }
      }
      if (changed) onLayoutChange?.();
    },
    { immediate: true }
  );

  const mcpToolGroupOpenByKey = ref(new Map<string, boolean>());
  const mcpToolDetailOpenByKey = ref(new Map<string, boolean>());
  const mcpResourceOpenByKey = ref(new Map<string, boolean>());
  const isMcpToolGroupOpen = (id: string) =>
    mcpToolGroupOpenByKey.value.get(`${runtimeStore.timelineKey}:${id}`) ?? false;
  const onMcpToolGroupToggle = (id: string, open: boolean) => {
    mcpToolGroupOpenByKey.value.set(`${runtimeStore.timelineKey}:${id}`, open);
    onLayoutChange?.();
  };
  const isMcpToolItemDetailOpen = (k: string) =>
    mcpToolDetailOpenByKey.value.get(`${runtimeStore.timelineKey}:${k}`) ?? false;
  const onMcpToolItemDetailToggle = (k: string, open: boolean) => {
    mcpToolDetailOpenByKey.value.set(`${runtimeStore.timelineKey}:${k}`, open);
    onLayoutChange?.();
  };
  const isMcpResourceOpen = (id: string) =>
    mcpResourceOpenByKey.value.get(`${runtimeStore.timelineKey}:${id}`) ?? false;
  const setMcpResourceOpen = (id: string, open: boolean) => {
    mcpResourceOpenByKey.value.set(`${runtimeStore.timelineKey}:${id}`, open);
    onLayoutChange?.();
  };

  return {
    chatRows,
    chatRenderedRows,
    isReasoningOpen,
    setReasoningOpen,
    isMcpToolGroupOpen,
    onMcpToolGroupToggle,
    isMcpToolItemDetailOpen,
    onMcpToolItemDetailToggle,
    isMcpResourceOpen,
    setMcpResourceOpen,
  };
}
