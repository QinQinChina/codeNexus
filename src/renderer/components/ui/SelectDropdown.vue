<template>
  <button
    ref="triggerRef"
    type="button"
    :disabled="disabled"
    :class="['ui-select-trigger', attrs.class]"
    :style="attrs.style as any"
    v-bind="forwardedAttrs"
    role="combobox"
    aria-haspopup="listbox"
    :aria-expanded="open ? 'true' : 'false'"
    :aria-controls="listboxId"
    :aria-activedescendant="open ? activeOptionId : undefined"
    @click="onTriggerClick"
    @keydown="onTriggerKeydown"
  >
    <span class="ui-select-value mono">{{ selectedLabel }}</span>
    <span class="ui-select-chevron" :class="{ open }" aria-hidden="true">▾</span>
  </button>

  <Teleport to="body">
    <Transition name="ui-select-popover">
      <div
        v-if="open"
        ref="popoverRef"
        :class="['ui-select-popover', 'app-scrollbar', { 'ui-select-popover--light': resolvedTheme === 'light' }]"
        :style="popoverStyle"
        :id="listboxId"
        role="listbox"
        :aria-label="ariaLabelText"
      >
        <button
          v-for="(opt, idx) in normalizedOptions"
          :id="toOptionId(idx)"
          :key="opt.key"
          type="button"
          class="ui-select-option mono"
          :data-value="opt.value"
          :class="{
            'is-selected': opt.value === modelValue,
            'is-active': idx === activeIndex,
            'is-disabled': opt.disabled,
          }"
          role="option"
          :aria-selected="opt.value === modelValue ? 'true' : 'false'"
          :disabled="opt.disabled"
          @mouseenter="onOptionMouseEnter(idx)"
          @click="onOptionClick(opt.value)"
        >
          <span class="ui-select-option-label">{{ opt.label }}</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useAttrs, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useThemeStore } from "../../stores/theme.store";

defineOptions({ inheritAttrs: false });

type OptionInput =
  | string
  | {
      value: string;
      label: string;
      disabled?: boolean;
    };

type NormalizedOption = {
  key: string;
  value: string;
  label: string;
  disabled: boolean;
};

let nextSelectId = 0;

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: readonly OptionInput[];
    disabled?: boolean;
    ariaLabel?: string;
    theme?: "auto" | "dark" | "light";
    minPopoverWidth?: number;
  }>(),
  {
    disabled: false,
    ariaLabel: "",
    theme: "auto",
    minPopoverWidth: 140,
  }
);

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();

const attrs = useAttrs();
const { t } = useI18n();
const open = ref(false);
const activeIndex = ref(0);
const triggerRef = ref<HTMLButtonElement | null>(null);
const popoverRef = ref<HTMLDivElement | null>(null);
const themeStore = useThemeStore();
const resolvedTheme = computed(() => {
  if (props.theme === "light") return "light";
  if (props.theme === "dark") return "dark";
  return themeStore.isLight ? "light" : "dark";
});
const instanceId = nextSelectId++;
const listboxId = computed(() => {
  const raw = attrs.id;
  const id = typeof raw === "string" && raw.trim() ? raw.trim() : `ui-select-${instanceId}`;
  return `${id}__listbox`;
});

const ariaLabelText = computed(() => {
  const fromProp = String(props.ariaLabel ?? "").trim();
  if (fromProp) return fromProp;
  const fromAttr = attrs["aria-label"];
  if (typeof fromAttr === "string" && fromAttr.trim()) return fromAttr.trim();
  return t("selectDropdown.aria");
});

const forwardedAttrs = computed(() => {
  const {
    class: _class,
    style: _style,
    role: _role,
    tabindex: _tabindex,
    "aria-haspopup": _ariaHaspopup,
    "aria-expanded": _ariaExpanded,
    "aria-controls": _ariaControls,
    "aria-activedescendant": _ariaActivedescendant,
    onClick: _onClick,
    onKeydown: _onKeydown,
    ...rest
  } = attrs as Record<string, unknown>;
  return rest;
});

const normalizedOptions = computed<NormalizedOption[]>(() => {
  const list: NormalizedOption[] = [];
  for (const opt of props.options ?? []) {
    if (typeof opt === "string") {
      const value = opt;
      list.push({ key: value, value, label: value, disabled: false });
      continue;
    }
    const value = String(opt.value ?? "");
    const label = String(opt.label ?? value);
    list.push({
      key: `${value}::${label}`,
      value,
      label,
      disabled: Boolean(opt.disabled),
    });
  }
  return list;
});

const selectedLabel = computed(() => {
  const hit = normalizedOptions.value.find((o) => o.value === props.modelValue);
  if (hit) return hit.label;
  return String(props.modelValue ?? "");
});

const clampIndex = (next: number) => {
  const max = Math.max(0, normalizedOptions.value.length - 1);
  return Math.min(max, Math.max(0, next));
};

const ensureActiveIndex = () => {
  const idx = normalizedOptions.value.findIndex((o) => o.value === props.modelValue);
  if (idx >= 0) activeIndex.value = idx;
  else activeIndex.value = 0;
};

const toOptionId = (idx: number) => `${listboxId.value}__opt_${idx}`;
const activeOptionId = computed(() => toOptionId(activeIndex.value));

const popoverStyle = ref<Record<string, string>>({});
const POPOVER_GAP_PX = 6;
const POPOVER_MAX_HEIGHT_PX = 280;
const VIEWPORT_PADDING_PX = 8;

const estimatePopoverHeight = () => {
  const pop = popoverRef.value;
  if (pop) {
    const measured = pop.scrollHeight;
    if (Number.isFinite(measured) && measured > 0) return Math.round(measured);
  }
  // 兜底估算：与 CSS 保持一致（.ui-select-option 高度 30，popover padding 6，gap 4）。
  const optionCount = normalizedOptions.value.length;
  const optionHeight = 30;
  const rowGap = 4;
  const paddingY = 12;
  const contentHeight = paddingY + optionCount * optionHeight + Math.max(0, optionCount - 1) * rowGap;
  return contentHeight;
};

const updatePopoverPosition = () => {
  const trigger = triggerRef.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const minWidth = Math.max(0, Math.round(Number(props.minPopoverWidth) || 0));
  const width = Math.max(minWidth, Math.round(rect.width));
  let left = Math.round(rect.left);
  left = Math.max(VIEWPORT_PADDING_PX, Math.min(left, Math.round(window.innerWidth - width - VIEWPORT_PADDING_PX)));

  const desiredHeight = Math.min(POPOVER_MAX_HEIGHT_PX, estimatePopoverHeight());
  const spaceBelow = Math.max(0, window.innerHeight - VIEWPORT_PADDING_PX - (rect.bottom + POPOVER_GAP_PX));
  const spaceAbove = Math.max(0, rect.top - POPOVER_GAP_PX - VIEWPORT_PADDING_PX);

  const canFitBelow = spaceBelow >= desiredHeight;
  const canFitAbove = spaceAbove >= desiredHeight;
  const openBelow = canFitBelow ? true : canFitAbove ? false : spaceBelow >= spaceAbove;

  const available = openBelow ? spaceBelow : spaceAbove;
  const maxHeight = Math.min(POPOVER_MAX_HEIGHT_PX, Math.max(60, Math.round(available)));
  const visibleHeight = Math.min(desiredHeight, maxHeight);

  const topRaw = openBelow ? rect.bottom + POPOVER_GAP_PX : rect.top - POPOVER_GAP_PX - visibleHeight;

  const top = Math.max(
    VIEWPORT_PADDING_PX,
    Math.min(Math.round(topRaw), Math.round(window.innerHeight - VIEWPORT_PADDING_PX - visibleHeight))
  );

  popoverStyle.value = {
    position: "fixed",
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    maxHeight: `${maxHeight}px`,
  };
};

const close = () => {
  if (!open.value) return;
  open.value = false;
  try {
    triggerRef.value?.focus();
  } catch {}
};

const openNow = async () => {
  if (open.value) return;
  open.value = true;
  ensureActiveIndex();
  await nextTick();
  updatePopoverPosition();
  // 等布局稳定后（字体/滚动条等）再二次定位，避免弹层位置抖动。
  window.requestAnimationFrame(() => updatePopoverPosition());
};

const toggleOpen = async () => {
  if (open.value) close();
  else await openNow();
};

const onTriggerClick = async () => {
  if (props.disabled) return;
  await toggleOpen();
};

const moveActive = (delta: number) => {
  if (normalizedOptions.value.length === 0) return;
  let next = clampIndex(activeIndex.value + delta);
  // 跳过 disabled 选项。
  for (let i = 0; i < normalizedOptions.value.length; i++) {
    if (!normalizedOptions.value[next]?.disabled) break;
    next = clampIndex(next + Math.sign(delta || 1));
  }
  activeIndex.value = next;
  scrollActiveOptionIntoView();
};

const scrollActiveOptionIntoView = () => {
  const pop = popoverRef.value;
  if (!pop) return;
  const el = document.getElementById(toOptionId(activeIndex.value));
  if (!el) return;
  try {
    el.scrollIntoView({ block: "nearest" });
  } catch {}
};

const pickValue = (value: string) => {
  const opt = normalizedOptions.value.find((o) => o.value === value);
  if (!opt || opt.disabled) return;
  emit("update:modelValue", value);
  close();
};

const onOptionClick = (value: string) => {
  pickValue(value);
};

const onOptionMouseEnter = (idx: number) => {
  activeIndex.value = clampIndex(idx);
};

let typeaheadBuffer = "";
let typeaheadTimer: number | null = null;

const pushTypeahead = (ch: string) => {
  typeaheadBuffer += ch.toLowerCase();
  if (typeaheadTimer != null) window.clearTimeout(typeaheadTimer);
  typeaheadTimer = window.setTimeout(() => {
    typeaheadBuffer = "";
    typeaheadTimer = null;
  }, 650);

  const idx = normalizedOptions.value.findIndex((o) => {
    if (o.disabled) return false;
    return o.label.toLowerCase().startsWith(typeaheadBuffer);
  });
  if (idx >= 0) {
    activeIndex.value = idx;
    scrollActiveOptionIntoView();
  }
};

const onTriggerKeydown = async (event: KeyboardEvent) => {
  if (props.disabled) return;

  if (event.key === "Escape") {
    if (open.value) {
      event.preventDefault();
      close();
    }
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (!open.value) {
      await openNow();
      return;
    }
    const opt = normalizedOptions.value[activeIndex.value];
    if (opt && !opt.disabled) pickValue(opt.value);
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (!open.value) await openNow();
    moveActive(1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (!open.value) await openNow();
    moveActive(-1);
    return;
  }

  if (event.key === "Home") {
    if (!open.value) return;
    event.preventDefault();
    activeIndex.value = 0;
    scrollActiveOptionIntoView();
    return;
  }

  if (event.key === "End") {
    if (!open.value) return;
    event.preventDefault();
    activeIndex.value = Math.max(0, normalizedOptions.value.length - 1);
    scrollActiveOptionIntoView();
    return;
  }

  if (event.key.length === 1 && /[\\p{L}\\p{N}\\s]/u.test(event.key)) {
    if (!open.value) await openNow();
    pushTypeahead(event.key);
  }
};

const onWindowPointerDownCapture = (event: PointerEvent) => {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (!target) return;
  const trigger = triggerRef.value;
  const pop = popoverRef.value;
  if (trigger && trigger.contains(target)) return;
  if (pop && pop.contains(target)) return;
  close();
};

const onWindowResizeOrScroll = () => {
  if (!open.value) return;
  updatePopoverPosition();
};

watch(open, (next) => {
  if (next) {
    window.addEventListener("pointerdown", onWindowPointerDownCapture, true);
    window.addEventListener("resize", onWindowResizeOrScroll, true);
    window.addEventListener("scroll", onWindowResizeOrScroll, true);
    return;
  }
  window.removeEventListener("pointerdown", onWindowPointerDownCapture, true);
  window.removeEventListener("resize", onWindowResizeOrScroll, true);
  window.removeEventListener("scroll", onWindowResizeOrScroll, true);
});

onBeforeUnmount(() => {
  try {
    window.removeEventListener("pointerdown", onWindowPointerDownCapture, true);
    window.removeEventListener("resize", onWindowResizeOrScroll, true);
    window.removeEventListener("scroll", onWindowResizeOrScroll, true);
  } catch {}
  if (typeaheadTimer != null) {
    try {
      window.clearTimeout(typeaheadTimer);
    } catch {}
  }
});
</script>
