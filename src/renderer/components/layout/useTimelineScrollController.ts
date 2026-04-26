import { nextTick, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from "vue";
import {
  classifyViewportFollowState,
  resolveTimelineScrollIntent,
  restorePrependScrollTop,
  snapshotTimelineViewport,
  type TimelineViewportSnapshot,
} from "./timelineScrollPolicy";

type UseTimelineScrollControllerOptions = {
  timelineRef: Ref<HTMLElement | null>;
  timelineKey: ComputedRef<string>;
  timelineRevision: ComputedRef<number>;
  activeTurnId: ComputedRef<string>;
  isTimelineLoading: ComputedRef<boolean>;
  loadOlderHistoryTurns: (threadId: string) => Promise<boolean>;
  edgeFadeThresholdPx?: number;
  loadOlderTriggerPx?: number;
};

const DEFAULT_EDGE_FADE_THRESHOLD_PX = 1;
const DEFAULT_LOAD_OLDER_TRIGGER_PX = 24;

export function useTimelineScrollController(options: UseTimelineScrollControllerOptions) {
  const hasTopEdgeFade = ref(false);
  const hasBottomEdgeFade = ref(false);

  const autoFollowEnabled = ref(true);
  const pendingInitialScrollToBottomKey = ref<string | null>(null);
  const timelineRevealPending = ref(false);
  const timelineSignatureInitialized = ref(false);
  const pendingOlderHistoryThreadId = ref("");

  const edgeFadeThresholdPx = Math.max(0, Math.round(options.edgeFadeThresholdPx ?? DEFAULT_EDGE_FADE_THRESHOLD_PX));
  const loadOlderTriggerPx = Math.max(0, Math.round(options.loadOlderTriggerPx ?? DEFAULT_LOAD_OLDER_TRIGGER_PX));

  let activeInitialStabilizeToken = 0;
  let lastObservedTimelineScrollHeight = 0;
  let lastTimelineScrollTop = 0;
  let lastActiveTurnId = "";
  let pendingAutoScrollRafId: number | null = null;
  let pendingTimelineViewportStateRafId: number | null = null;
  let timelineResizeObserver: ResizeObserver | null = null;

  function captureViewport(): TimelineViewportSnapshot | null {
    const element = options.timelineRef.value;
    return element ? snapshotTimelineViewport(element) : null;
  }

  function updateTimelineViewportState() {
    const element = options.timelineRef.value;
    if (!element) {
      hasTopEdgeFade.value = false;
      hasBottomEdgeFade.value = false;
      return;
    }
    const snapshot = snapshotTimelineViewport(element);
    const followState = classifyViewportFollowState(snapshot);
    const maxScrollTop = Math.max(0, snapshot.scrollHeight - snapshot.clientHeight);
    const distanceToBottom = Math.max(0, maxScrollTop - snapshot.scrollTop);
    autoFollowEnabled.value = followState === "following";
    if (maxScrollTop <= edgeFadeThresholdPx) {
      hasTopEdgeFade.value = false;
      hasBottomEdgeFade.value = false;
      return;
    }
    hasTopEdgeFade.value = snapshot.scrollTop > edgeFadeThresholdPx;
    hasBottomEdgeFade.value = distanceToBottom > edgeFadeThresholdPx;
  }

  function scheduleTimelineViewportStateUpdate() {
    if (pendingTimelineViewportStateRafId != null) cancelAnimationFrame(pendingTimelineViewportStateRafId);
    pendingTimelineViewportStateRafId = requestAnimationFrame(() => {
      pendingTimelineViewportStateRafId = null;
      updateTimelineViewportState();
    });
  }

  function cancelPendingAutoScroll() {
    if (pendingAutoScrollRafId == null) return;
    cancelAnimationFrame(pendingAutoScrollRafId);
    pendingAutoScrollRafId = null;
  }

  function scrollTimelineToBottom(behavior: ScrollBehavior = "auto") {
    const element = options.timelineRef.value;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
    scheduleTimelineViewportStateUpdate();
  }

  function scheduleAutoScrollToBottom() {
    cancelPendingAutoScroll();
    pendingAutoScrollRafId = requestAnimationFrame(() => {
      pendingAutoScrollRafId = null;
      scrollTimelineToBottom("auto");
    });
  }

  function scrollTimelineToBottomImmediate(behavior: ScrollBehavior = "auto") {
    cancelPendingAutoScroll();
    scrollTimelineToBottom(behavior);
  }

  function forceFollowBottom(_reason: string = "explicit-bottom") {
    autoFollowEnabled.value = true;
    scheduleAutoScrollToBottom();
  }

  function waitForAnimationFrame() {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  async function waitForTimelineLayoutToSettle() {
    let previousScrollHeight = -1;
    let stableFrameCount = 0;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await waitForAnimationFrame();
      const element = options.timelineRef.value;
      if (!element) return;
      const nextScrollHeight = element.scrollHeight;
      if (nextScrollHeight === previousScrollHeight) stableFrameCount += 1;
      else stableFrameCount = 0;
      previousScrollHeight = nextScrollHeight;
      if (stableFrameCount >= 1) return;
    }
  }

  async function stabilizeInitialViewportAtBottom() {
    const key = options.timelineKey.value;
    if (pendingInitialScrollToBottomKey.value !== key) return;
    if (options.isTimelineLoading.value) return;

    const token = (activeInitialStabilizeToken += 1);
    timelineRevealPending.value = true;

    try {
      await nextTick();
      await waitForTimelineLayoutToSettle();
      if (token !== activeInitialStabilizeToken) return;
      if (key !== options.timelineKey.value) return;

      autoFollowEnabled.value = true;
      scrollTimelineToBottomImmediate("auto");
      await nextTick();
      await waitForTimelineLayoutToSettle();
      if (token !== activeInitialStabilizeToken) return;
      if (key !== options.timelineKey.value) return;

      scrollTimelineToBottomImmediate("auto");
      pendingInitialScrollToBottomKey.value = null;
      timelineRevealPending.value = false;
    } finally {
      if (options.timelineKey.value !== key) return;
      timelineRevealPending.value = false;
      scheduleTimelineViewportStateUpdate();
    }
  }

  async function finalizeThreadViewport() {
    const key = options.timelineKey.value;
    await nextTick();
    if (key !== options.timelineKey.value) return;
    if (options.isTimelineLoading.value) return;
    if (pendingInitialScrollToBottomKey.value === key) {
      await stabilizeInitialViewportAtBottom();
      return;
    }
    const intent = resolveTimelineScrollIntent({
      reason: "stream-update",
      followState: autoFollowEnabled.value ? "following" : "detached",
    });
    if (intent.kind === "scroll-to-bottom") scheduleAutoScrollToBottom();
    scheduleTimelineViewportStateUpdate();
  }

  function applyContentChangeIntent(reason: "stream-update" | "layout-change" | "turn-changed") {
    const intent = resolveTimelineScrollIntent({
      reason,
      followState: autoFollowEnabled.value ? "following" : "detached",
      previousTurnId: lastActiveTurnId,
      nextTurnId: options.activeTurnId.value,
    });
    if (intent.kind === "scroll-to-bottom") scheduleAutoScrollToBottom();
    else scheduleTimelineViewportStateUpdate();
  }

  function notifyTimelineLayoutChange() {
    const before = captureViewport();
    void nextTick(() => {
      const element = options.timelineRef.value;
      if (!element) {
        scheduleTimelineViewportStateUpdate();
        return;
      }
      if (before && !autoFollowEnabled.value) {
        const after = snapshotTimelineViewport(element);
        element.scrollTop = Math.max(
          0,
          Math.min(Math.max(0, after.scrollHeight - after.clientHeight), before.scrollTop)
        );
      }
      applyContentChangeIntent("layout-change");
    });
  }

  function bumpTimelineLayoutRevision() {
    notifyTimelineLayoutChange();
  }

  async function maybeLoadOlderHistoryFromTop(previousScrollTop: number) {
    const element = options.timelineRef.value;
    const threadId = options.timelineKey.value;
    if (!element || !threadId || threadId === "__app__") return;
    if (options.isTimelineLoading.value) return;
    if (pendingInitialScrollToBottomKey.value === threadId) return;
    if (timelineRevealPending.value) return;

    const currentScrollTop = Math.max(0, element.scrollTop);
    const crossedIntoTopZone = previousScrollTop > loadOlderTriggerPx && currentScrollTop <= loadOlderTriggerPx;
    if (!crossedIntoTopZone) return;
    if (pendingOlderHistoryThreadId.value === threadId) return;

    pendingOlderHistoryThreadId.value = threadId;
    const before = snapshotTimelineViewport(element);

    try {
      const loaded = await options.loadOlderHistoryTurns(threadId);
      if (!loaded) return;
      await nextTick();
      await waitForTimelineLayoutToSettle();
      if (options.timelineKey.value !== threadId) return;

      const nextElement = options.timelineRef.value;
      if (!nextElement) return;
      const after = snapshotTimelineViewport(nextElement);
      nextElement.scrollTop = restorePrependScrollTop(before, after);
      lastTimelineScrollTop = Math.max(0, nextElement.scrollTop);
      updateTimelineViewportState();
    } finally {
      if (pendingOlderHistoryThreadId.value === threadId) pendingOlderHistoryThreadId.value = "";
    }
  }

  function onTimelineScroll() {
    const previousScrollTop = lastTimelineScrollTop;
    updateTimelineViewportState();
    lastTimelineScrollTop = Math.max(0, options.timelineRef.value?.scrollTop ?? 0);
    void maybeLoadOlderHistoryFromTop(previousScrollTop);
  }

  function observeTimelineElement() {
    if (typeof ResizeObserver === "undefined") return;
    if (!timelineResizeObserver) {
      timelineResizeObserver = new ResizeObserver(() => {
        const element = options.timelineRef.value;
        const nextScrollHeight = Math.max(0, Math.round(element?.scrollHeight ?? 0));
        const hadHeight = lastObservedTimelineScrollHeight > 0;
        const heightChanged = nextScrollHeight !== lastObservedTimelineScrollHeight;
        lastObservedTimelineScrollHeight = nextScrollHeight;
        if (
          hadHeight &&
          heightChanged &&
          pendingInitialScrollToBottomKey.value !== options.timelineKey.value &&
          !timelineRevealPending.value
        ) {
          applyContentChangeIntent("layout-change");
        } else {
          scheduleTimelineViewportStateUpdate();
        }
      });
    }
    timelineResizeObserver.disconnect();
    if (options.timelineRef.value) timelineResizeObserver.observe(options.timelineRef.value);
  }

  watch(
    () => options.timelineKey.value,
    () => {
      cancelPendingAutoScroll();
      if (pendingTimelineViewportStateRafId != null) {
        cancelAnimationFrame(pendingTimelineViewportStateRafId);
        pendingTimelineViewportStateRafId = null;
      }
      timelineSignatureInitialized.value = false;
      pendingInitialScrollToBottomKey.value = options.timelineKey.value;
      timelineRevealPending.value = true;
      autoFollowEnabled.value = true;
      lastObservedTimelineScrollHeight = 0;
      lastTimelineScrollTop = 0;
      lastActiveTurnId = options.activeTurnId.value;
      if (!options.isTimelineLoading.value) void finalizeThreadViewport();
      else scheduleTimelineViewportStateUpdate();
    },
    { flush: "post" }
  );

  watch(
    () => [options.timelineKey.value, options.timelineRevision.value] as const,
    (next, prev) => {
      const nextKey = next?.[0] ?? "";
      const nextRevision = next?.[1] ?? 0;
      const prevKey = prev?.[0] ?? "";
      const prevRevision = prev?.[1] ?? 0;
      if (!timelineSignatureInitialized.value) {
        timelineSignatureInitialized.value = true;
        if (options.isTimelineLoading.value) {
          scheduleTimelineViewportStateUpdate();
          return;
        }
        void finalizeThreadViewport();
        return;
      }
      if (options.isTimelineLoading.value) return;
      if (nextKey === prevKey && nextRevision === prevRevision) return;
      void nextTick(async () => {
        if (pendingInitialScrollToBottomKey.value === options.timelineKey.value) {
          await stabilizeInitialViewportAtBottom();
          return;
        }
        applyContentChangeIntent("stream-update");
      });
    },
    { flush: "post" }
  );

  watch(
    () => options.activeTurnId.value,
    (nextTurnId, prevTurnId) => {
      const next = String(nextTurnId ?? "").trim();
      const prev = String(prevTurnId ?? "").trim();
      if (next && prev && next !== prev) {
        lastActiveTurnId = prev;
        applyContentChangeIntent("turn-changed");
      }
      if (next) lastActiveTurnId = next;
    },
    { flush: "post" }
  );

  watch(
    () => options.isTimelineLoading.value,
    (loading) => {
      if (loading) return;
      void finalizeThreadViewport();
    },
    { flush: "post" }
  );

  onMounted(() => {
    void nextTick(() => {
      observeTimelineElement();
      lastObservedTimelineScrollHeight = Math.max(0, Math.round(options.timelineRef.value?.scrollHeight ?? 0));
      lastTimelineScrollTop = Math.max(0, options.timelineRef.value?.scrollTop ?? 0);
      lastActiveTurnId = options.activeTurnId.value;
      scheduleAutoScrollToBottom();
      scheduleTimelineViewportStateUpdate();
    });
  });

  onBeforeUnmount(() => {
    cancelPendingAutoScroll();
    if (pendingTimelineViewportStateRafId != null) cancelAnimationFrame(pendingTimelineViewportStateRafId);
    pendingTimelineViewportStateRafId = null;
    timelineResizeObserver?.disconnect();
    timelineResizeObserver = null;
  });

  return {
    hasTopEdgeFade,
    hasBottomEdgeFade,
    autoFollowEnabled,
    bumpTimelineLayoutRevision,
    forceFollowBottom,
    notifyTimelineLayoutChange,
    onTimelineScroll,
    scheduleTimelineViewportStateUpdate,
    updateTimelineViewportState,
    observeTimelineElement,
  };
}
