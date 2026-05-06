import { onBeforeUnmount, ref } from "vue";

type AnchoredPopoverOptions = {
  marginPx?: number;
  gapPx?: number;
  prefer?: "below" | "above";
};

type AnchorLike = HTMLElement | null;
type PopoverLike = HTMLElement | null;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function rafThrottle(fn: () => void) {
  let rafId: number | null = null;
  return () => {
    if (rafId != null) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      fn();
    });
  };
}

export function useAnchoredPopover(options?: AnchoredPopoverOptions) {
  const marginPx = Math.max(0, options?.marginPx ?? 10);
  const gapPx = Math.max(0, options?.gapPx ?? 6);
  const prefer = options?.prefer ?? "below";

  const open = ref(false);
  const anchorEl = ref<AnchorLike>(null);
  const popoverEl = ref<PopoverLike>(null);
  const popoverStyle = ref<Record<string, string>>({});

  const compute = () => {
    const anchor = anchorEl.value;
    const pop = popoverEl.value;
    if (!anchor || !pop) return;

    const a = anchor.getBoundingClientRect();

    // Ensure popover has layout for measurement.
    const p = pop.getBoundingClientRect();

    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;

    const spaceAbove = Math.max(0, a.top - marginPx);
    const spaceBelow = Math.max(0, vh - a.bottom - marginPx);

    const canFitBelow = spaceBelow >= p.height + gapPx;
    const canFitAbove = spaceAbove >= p.height + gapPx;

    let place: "below" | "above" = prefer;
    if (place === "below" && !canFitBelow && canFitAbove) place = "above";
    else if (place === "above" && !canFitAbove && canFitBelow) place = "below";
    else if (!canFitBelow && !canFitAbove) {
      place = spaceBelow >= spaceAbove ? "below" : "above";
    }

    const top = place === "below" ? a.bottom + gapPx : a.top - gapPx - p.height;

    // Horizontal: align left with anchor, clamp to viewport.
    const leftWanted = a.left;
    const left = clamp(leftWanted, marginPx, Math.max(marginPx, vw - marginPx - p.width));

    // If we had to clamp a lot, nudge origin so the entrance animation feels right.
    const dx = leftWanted - left;
    const originX = dx > 6 ? "right" : dx < -6 ? "left" : "left";
    const originY = place === "below" ? "top" : "bottom";

    popoverStyle.value = {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      transformOrigin: `${originX} ${originY}`,
    };
  };

  const computeThrottled = rafThrottle(compute);

  const onWindowUpdate = () => {
    if (!open.value) return;
    computeThrottled();
  };

  const bindWindow = () => {
    window.addEventListener("scroll", onWindowUpdate, true);
    window.addEventListener("resize", onWindowUpdate, { passive: true } as any);
  };

  const unbindWindow = () => {
    window.removeEventListener("scroll", onWindowUpdate, true);
    window.removeEventListener("resize", onWindowUpdate as any);
  };

  const setAnchor = (el: AnchorLike) => {
    anchorEl.value = el;
  };
  const setPopover = (el: PopoverLike) => {
    popoverEl.value = el;
  };

  const openPopover = () => {
    if (open.value) return;
    open.value = true;
    bindWindow();
    // Next frame: popover ref is mounted and measurable.
    computeThrottled();
  };

  const closePopover = () => {
    if (!open.value) return;
    open.value = false;
    unbindWindow();
  };

  const updatePopover = () => {
    if (!open.value) return;
    computeThrottled();
  };

  onBeforeUnmount(() => {
    unbindWindow();
  });

  return {
    open,
    popoverStyle,
    setAnchor,
    setPopover,
    openPopover,
    closePopover,
    updatePopover,
  };
}

