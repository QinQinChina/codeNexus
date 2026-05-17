import { onBeforeUnmount, ref, watch } from "vue";

type ScrollToBottomOptions = {
  force?: boolean;
};

type UseFollowBottomScrollerOptions = {
  bottomThresholdPx?: number;
  enabled?: () => boolean;
  onContentResize?: () => void;
};

export function useFollowBottomScroller(options: UseFollowBottomScrollerOptions = {}) {
  const scrollerRef = ref<HTMLElement | null>(null);
  const contentRef = ref<HTMLElement | null>(null);
  const followBottom = ref(true);
  const bottomThresholdPx = Math.max(0, options.bottomThresholdPx ?? 24);
  let pendingScrollRaf: number | null = null;
  let contentResizeObserver: ResizeObserver | null = null;

  const isEnabled = () => options.enabled?.() ?? true;

  function cancelPendingScroll() {
    if (pendingScrollRaf == null) return;
    cancelAnimationFrame(pendingScrollRaf);
    pendingScrollRaf = null;
  }

  function distanceToBottom(element: HTMLElement): number {
    return Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop);
  }

  function syncFollowBottomFromScroll() {
    const element = scrollerRef.value;
    if (!element) return;
    followBottom.value = distanceToBottom(element) <= bottomThresholdPx;
  }

  function resetFollowBottom() {
    followBottom.value = true;
  }

  function scrollToBottomNow() {
    const element = scrollerRef.value;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    syncFollowBottomFromScroll();
  }

  function scheduleScrollToBottom(scrollOptions: ScrollToBottomOptions = {}) {
    const force = scrollOptions.force === true;
    if (!isEnabled() || (!force && !followBottom.value)) return;
    cancelPendingScroll();
    pendingScrollRaf = requestAnimationFrame(() => {
      pendingScrollRaf = null;
      if (!isEnabled() || (!force && !followBottom.value)) return;
      scrollToBottomNow();
    });
  }

  function onScroll() {
    syncFollowBottomFromScroll();
  }

  function onObservedContentResize() {
    if (!isEnabled()) return;
    scheduleScrollToBottom();
    options.onContentResize?.();
  }

  watch(
    contentRef,
    (element) => {
      contentResizeObserver?.disconnect();
      contentResizeObserver = null;
      if (!element || typeof ResizeObserver === "undefined") return;
      contentResizeObserver = new ResizeObserver(onObservedContentResize);
      contentResizeObserver.observe(element);
    },
    { flush: "post" }
  );

  onBeforeUnmount(() => {
    cancelPendingScroll();
    contentResizeObserver?.disconnect();
    contentResizeObserver = null;
  });

  return {
    contentRef,
    scrollerRef,
    followBottom,
    distanceToBottom,
    onScroll,
    resetFollowBottom,
    scheduleScrollToBottom,
  };
}
