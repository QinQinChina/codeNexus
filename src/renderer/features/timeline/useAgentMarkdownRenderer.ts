// Agent Markdown 渲染 Hook：把增量/流式 markdown 渲染为安全 HTML，并提供缓存清理。
import { onBeforeUnmount, shallowRef, watch } from "vue";
import type { TimelineEventItem } from "../../domain/types";
import { getMarkdownRendererVersion, renderMarkdownToSafeHtml, whenMarkdownRendererReady } from "./markdownRenderer";

type AgentMarkdownRenderEntry = {
  renderedText: string;
  renderedHtml: string;
  pendingText: string | null;
  lastRenderedAt: number;
  flushTimer: ReturnType<typeof setTimeout> | null;
  rendererVersion: number;
};

const AGENT_MARKDOWN_MIN_INTERVAL_MS = 24;
const AGENT_MARKDOWN_EVENT_CACHE_MAX = 240;
const AGENT_MARKDOWN_EVENT_CACHE_KEEP = 180;

// 维护事件级 markdown 渲染缓存，避免高频 delta 触发抖动重渲染。
export function useAgentMarkdownRenderer(params: { key: () => string }) {
  const agentMarkdownRenderTick = shallowRef(0);
  const agentMarkdownByEventId = new Map<string, AgentMarkdownRenderEntry>();
  let markdownReadyListenerRegistered = false;

  const scheduleMarkdownReadyRefresh = () => {
    if (getMarkdownRendererVersion() > 0) return;
    if (markdownReadyListenerRegistered) return;
    markdownReadyListenerRegistered = true;
    void whenMarkdownRendererReady()
      .then(() => {
        markdownReadyListenerRegistered = false;
        agentMarkdownRenderTick.value += 1;
      })
      .catch(() => {
        markdownReadyListenerRegistered = false;
      });
  };

  const renderWithCurrentMarkdownRenderer = (text: string) => {
    const renderedHtml = renderMarkdownToSafeHtml(text);
    const rendererVersion = getMarkdownRendererVersion();
    if (rendererVersion === 0) scheduleMarkdownReadyRefresh();
    return { renderedHtml, rendererVersion };
  };

  const clearEntryTimer = (entry: AgentMarkdownRenderEntry) => {
    if (entry.flushTimer == null) return;
    clearTimeout(entry.flushTimer);
    entry.flushTimer = null;
  };

  // 缓存超过上限后丢弃最旧项。
  const pruneCache = () => {
    if (agentMarkdownByEventId.size <= AGENT_MARKDOWN_EVENT_CACHE_MAX) return;
    const dropCount = Math.max(0, agentMarkdownByEventId.size - AGENT_MARKDOWN_EVENT_CACHE_KEEP);
    if (dropCount <= 0) return;
    const staleIds = [...agentMarkdownByEventId.keys()].slice(0, dropCount);
    for (const staleId of staleIds) {
      const entry = agentMarkdownByEventId.get(staleId);
      if (entry) clearEntryTimer(entry);
      agentMarkdownByEventId.delete(staleId);
    }
  };

  // 清空事件缓存与全局 markdown 缓存。
  const clear = () => {
    for (const entry of agentMarkdownByEventId.values()) clearEntryTimer(entry);
    agentMarkdownByEventId.clear();
    // 不清空全局 markdown 文本缓存：它自带上限与淘汰策略，频繁清空会导致切线程回放时反复重渲染。
  };

  // 获取指定事件的 markdown HTML；高频更新时做最小间隔节流。
  const getMarkdownEventHtml = (event: TimelineEventItem) => {
    void agentMarkdownRenderTick.value;
    const eventId = String(event.id ?? "").trim();
    const text = String(event.paramsText ?? "");
    if (!eventId) return renderWithCurrentMarkdownRenderer(text).renderedHtml;
    const currentRendererVersion = getMarkdownRendererVersion();

    let entry = agentMarkdownByEventId.get(eventId);
    if (!entry) {
      entry = {
        renderedText: "",
        renderedHtml: "",
        pendingText: null,
        lastRenderedAt: 0,
        flushTimer: null,
        rendererVersion: -1,
      };
      agentMarkdownByEventId.set(eventId, entry);
      pruneCache();
    }

    if (
      text === entry.renderedText &&
      entry.pendingText == null &&
      entry.rendererVersion === currentRendererVersion
    ) {
      return entry.renderedHtml;
    }

    const now = Date.now();
    const elapsed = now - entry.lastRenderedAt;
    if (
      entry.renderedText.length === 0 ||
      entry.rendererVersion !== currentRendererVersion ||
      elapsed >= AGENT_MARKDOWN_MIN_INTERVAL_MS
    ) {
      clearEntryTimer(entry);
      const { renderedHtml, rendererVersion } = renderWithCurrentMarkdownRenderer(text);
      entry.renderedText = text;
      entry.renderedHtml = renderedHtml;
      entry.pendingText = null;
      entry.rendererVersion = rendererVersion;
      entry.lastRenderedAt = now;
      return entry.renderedHtml;
    }

    entry.pendingText = text;
    if (entry.flushTimer == null) {
      const waitMs = Math.max(1, AGENT_MARKDOWN_MIN_INTERVAL_MS - elapsed);
      entry.flushTimer = setTimeout(() => {
        entry!.flushTimer = null;
        if (entry!.pendingText == null || entry!.pendingText === entry!.renderedText) return;
        const finalText = entry!.pendingText;
        entry!.pendingText = null;
        const { renderedHtml, rendererVersion } = renderWithCurrentMarkdownRenderer(finalText);
        entry!.renderedText = finalText;
        entry!.renderedHtml = renderedHtml;
        entry!.rendererVersion = rendererVersion;
        entry!.lastRenderedAt = Date.now();
        agentMarkdownRenderTick.value += 1;
      }, waitMs);
    }
    return entry.renderedHtml || renderWithCurrentMarkdownRenderer(text).renderedHtml;
  };

  watch(
    () => params.key(),
    () => {
      clear();
    }
  );

  onBeforeUnmount(() => {
    clear();
  });

  return { getMarkdownEventHtml, clear };
}
