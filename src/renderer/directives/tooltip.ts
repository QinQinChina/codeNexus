import type { App, Directive, DirectiveBinding } from "vue";

type TooltipPlacement = "top" | "bottom" | "left" | "right";

type TooltipObjectValue = {
  content?: unknown;
  placement?: TooltipPlacement;
  disabled?: boolean;
  delay?: number;
};

type TooltipValue = string | number | TooltipObjectValue | null | undefined | false;

type TooltipState = {
  content: string;
  placement: TooltipPlacement;
  disabled: boolean;
  delay: number;
  showTimer: number | null;
  cleanup: Array<() => void>;
};

const DEFAULT_DELAY_MS = 360;
const GAP_PX = 8;
const VIEWPORT_PADDING_PX = 8;
const PLACEMENTS: TooltipPlacement[] = ["top", "bottom", "left", "right"];

const stateByElement = new WeakMap<HTMLElement, TooltipState>();

let tooltipEl: HTMLDivElement | null = null;
let currentAnchor: HTMLElement | null = null;
let currentState: TooltipState | null = null;
let describedById = 0;

function normalizeValue(value: TooltipValue): Pick<TooltipState, "content" | "placement" | "disabled" | "delay"> {
  if (value == null || value === false) {
    return { content: "", placement: "top", disabled: true, delay: DEFAULT_DELAY_MS };
  }

  if (typeof value === "object") {
    const placement = PLACEMENTS.includes(value.placement as TooltipPlacement) ? value.placement! : "top";
    return {
      content: String(value.content ?? "").trim(),
      placement,
      disabled: Boolean(value.disabled),
      delay: Math.max(0, Math.round(Number(value.delay ?? DEFAULT_DELAY_MS))),
    };
  }

  return {
    content: String(value).trim(),
    placement: "top",
    disabled: false,
    delay: DEFAULT_DELAY_MS,
  };
}

function ensureTooltipElement() {
  if (tooltipEl) return tooltipEl;

  tooltipEl = document.createElement("div");
  tooltipEl.id = `app-tooltip-${describedById++}`;
  tooltipEl.className = "app-tooltip";
  tooltipEl.setAttribute("role", "tooltip");
  tooltipEl.setAttribute("aria-hidden", "true");
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getOppositePlacement(placement: TooltipPlacement): TooltipPlacement {
  if (placement === "top") return "bottom";
  if (placement === "bottom") return "top";
  if (placement === "left") return "right";
  return "left";
}

function hasSpace(anchorRect: DOMRect, tooltipRect: DOMRect, placement: TooltipPlacement) {
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  if (placement === "top") return anchorRect.top >= tooltipRect.height + GAP_PX + VIEWPORT_PADDING_PX;
  if (placement === "bottom") return vh - anchorRect.bottom >= tooltipRect.height + GAP_PX + VIEWPORT_PADDING_PX;
  if (placement === "left") return anchorRect.left >= tooltipRect.width + GAP_PX + VIEWPORT_PADDING_PX;
  return vw - anchorRect.right >= tooltipRect.width + GAP_PX + VIEWPORT_PADDING_PX;
}

function resolvePlacement(anchorRect: DOMRect, tooltipRect: DOMRect, preferred: TooltipPlacement) {
  if (hasSpace(anchorRect, tooltipRect, preferred)) return preferred;
  const opposite = getOppositePlacement(preferred);
  if (hasSpace(anchorRect, tooltipRect, opposite)) return opposite;
  return preferred;
}

function positionTooltip(anchor: HTMLElement, state: TooltipState) {
  const el = ensureTooltipElement();
  const anchorRect = anchor.getBoundingClientRect();
  const tooltipRect = el.getBoundingClientRect();
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  const placement = resolvePlacement(anchorRect, tooltipRect, state.placement);

  let left = 0;
  let top = 0;

  if (placement === "top" || placement === "bottom") {
    left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
    top = placement === "top" ? anchorRect.top - tooltipRect.height - GAP_PX : anchorRect.bottom + GAP_PX;
  } else {
    left = placement === "left" ? anchorRect.left - tooltipRect.width - GAP_PX : anchorRect.right + GAP_PX;
    top = anchorRect.top + anchorRect.height / 2 - tooltipRect.height / 2;
  }

  left = clamp(left, VIEWPORT_PADDING_PX, Math.max(VIEWPORT_PADDING_PX, vw - tooltipRect.width - VIEWPORT_PADDING_PX));
  top = clamp(top, VIEWPORT_PADDING_PX, Math.max(VIEWPORT_PADDING_PX, vh - tooltipRect.height - VIEWPORT_PADDING_PX));

  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
  el.dataset.placement = placement;
}

function clearShowTimer(state: TooltipState) {
  if (state.showTimer == null) return;
  window.clearTimeout(state.showTimer);
  state.showTimer = null;
}

function hideTooltip(anchor?: HTMLElement) {
  if (anchor && currentAnchor && anchor !== currentAnchor) return;
  if (currentState) clearShowTimer(currentState);

  const el = tooltipEl;
  if (el) {
    el.classList.remove("is-visible");
    el.setAttribute("aria-hidden", "true");
  }

  if (currentAnchor) {
    currentAnchor.removeAttribute("aria-describedby");
  }

  currentAnchor = null;
  currentState = null;
}

function showTooltip(anchor: HTMLElement, state: TooltipState, delayOverride?: number) {
  clearShowTimer(state);
  if (state.disabled || !state.content) {
    hideTooltip(anchor);
    return;
  }

  state.showTimer = window.setTimeout(() => {
    const el = ensureTooltipElement();
    currentAnchor?.removeAttribute("aria-describedby");
    currentAnchor = anchor;
    currentState = state;

    el.textContent = state.content;
    anchor.setAttribute("aria-describedby", el.id);
    el.setAttribute("aria-hidden", "false");
    el.classList.add("is-visible");

    positionTooltip(anchor, state);
    window.requestAnimationFrame(() => positionTooltip(anchor, state));
    state.showTimer = null;
  }, delayOverride ?? state.delay);
}

function updateCurrentPosition() {
  if (!currentAnchor || !currentState) return;
  positionTooltip(currentAnchor, currentState);
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") hideTooltip();
}

function onWindowUpdate() {
  if (!currentAnchor) return;
  hideTooltip();
}

function bind(el: HTMLElement, state: TooltipState) {
  const onPointerEnter = () => showTooltip(el, state);
  const onPointerLeave = () => hideTooltip(el);
  const onFocus = () => showTooltip(el, state, 0);
  const onBlur = () => hideTooltip(el);
  const onPointerDown = () => hideTooltip(el);

  el.addEventListener("pointerenter", onPointerEnter);
  el.addEventListener("pointerleave", onPointerLeave);
  el.addEventListener("focus", onFocus);
  el.addEventListener("blur", onBlur);
  el.addEventListener("pointerdown", onPointerDown);

  state.cleanup.push(
    () => el.removeEventListener("pointerenter", onPointerEnter),
    () => el.removeEventListener("pointerleave", onPointerLeave),
    () => el.removeEventListener("focus", onFocus),
    () => el.removeEventListener("blur", onBlur),
    () => el.removeEventListener("pointerdown", onPointerDown)
  );
}

const tooltipDirective: Directive<HTMLElement, TooltipValue> = {
  mounted(el, binding: DirectiveBinding<TooltipValue>) {
    const normalized = normalizeValue(binding.value);
    const state: TooltipState = {
      ...normalized,
      showTimer: null,
      cleanup: [],
    };
    stateByElement.set(el, state);
    bind(el, state);
  },
  updated(el, binding: DirectiveBinding<TooltipValue>) {
    const state = stateByElement.get(el);
    if (!state) return;
    const normalized = normalizeValue(binding.value);
    state.content = normalized.content;
    state.placement = normalized.placement;
    state.disabled = normalized.disabled;
    state.delay = normalized.delay;
    if (currentAnchor === el) {
      if (state.disabled || !state.content) hideTooltip(el);
      else {
        const tooltip = tooltipEl;
        if (tooltip) tooltip.textContent = state.content;
        updateCurrentPosition();
      }
    }
  },
  beforeUnmount(el) {
    const state = stateByElement.get(el);
    if (!state) return;
    clearShowTimer(state);
    state.cleanup.forEach((fn) => fn());
    stateByElement.delete(el);
    hideTooltip(el);
  },
};

let globalListenersBound = false;

function bindGlobalListeners() {
  if (globalListenersBound) return;
  globalListenersBound = true;
  window.addEventListener("scroll", onWindowUpdate, true);
  window.addEventListener("resize", onWindowUpdate, { passive: true } as AddEventListenerOptions);
  document.addEventListener("keydown", onDocumentKeydown);
}

export function installTooltipDirective(app: App) {
  bindGlobalListeners();
  app.directive("tooltip", tooltipDirective);
}
