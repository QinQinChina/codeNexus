<template>
  <div :class="[CHAT_ROW_BASE_CLASS, 'chat-row--aux-activity']">
    <section class="chat-aux-activity" :class="activityClass" :aria-busy="status === 'running'">
      <button
        class="chat-aux-activity__summary"
        type="button"
        :aria-expanded="open ? 'true' : 'false'"
        @click="toggleOpen"
      >
        <span class="chat-aux-activity__icon" aria-hidden="true">
          <Activity class="h-3.5 w-3.5 [stroke-width:2.25]" />
        </span>
        <span class="chat-aux-activity__main min-w-0">
          <span class="chat-aux-activity__title">{{ titleText }}</span>
          <span class="chat-aux-activity__counts">
            <span v-for="item in summaryItems" :key="item.key" class="chat-aux-activity__count">
              {{ item.label }} {{ item.count }}
            </span>
          </span>
        </span>
        <span class="chat-aux-activity__state">{{ statusText }}</span>
        <ChevronDown
          class="chat-aux-activity__chevron h-3.5 w-3.5 [stroke-width:2.35]"
          :class="{ 'rotate-180': open }"
          aria-hidden="true"
        />
      </button>

      <div
        class="chat-aux-activity__body-shell"
        :class="{ 'is-open': open }"
        :aria-hidden="open ? 'false' : 'true'"
        @transitionend="onBodyTransitionEnd"
      >
        <div class="chat-aux-activity__body-frame">
          <div ref="scrollerRef" class="chat-aux-activity__body app-scrollbar" @scroll="onBodyScroll">
            <div class="chat-aux-activity__items">
              <div v-for="item in items" :key="item.id" class="chat-aux-activity__item" :data-aux-kind="item.kind">
                <slot :item="item" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { Activity, ChevronDown } from "lucide-vue-next";
import type { ChatAuxActivityStatus, ChatAuxActivitySummaryItem, ChatAuxiliaryRow } from "../layout/types/chat.types";
import { CHAT_ROW_BASE_CLASS } from "../layout/chat/chatPresentation";

const props = defineProps<{
  id: string;
  items: ChatAuxiliaryRow[];
  summaryItems: ChatAuxActivitySummaryItem[];
  summaryText: string;
  status: ChatAuxActivityStatus;
  defaultCollapsed: boolean;
}>();

defineSlots<{
  default(props: { item: ChatAuxiliaryRow }): unknown;
}>();

const emit = defineEmits<{
  (e: "layout-change"): void;
}>();

const open = ref(!props.defaultCollapsed);
const userTouched = ref(false);
const followBottom = ref(true);
const scrollerRef = ref<HTMLElement | null>(null);
let pendingScrollRaf: number | null = null;

const titleText = computed(() => (props.status === "running" ? "正在处理辅助活动" : "辅助活动"));

const statusText = computed(() => {
  if (props.status === "running") return "进行中";
  return "已收起";
});

const activityClass = computed(() => ({
  "is-open": open.value,
  "is-running": props.status === "running",
}));

function distanceToBottom(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop);
}

function scheduleScrollToBottom() {
  if (!open.value || !followBottom.value) return;
  if (pendingScrollRaf != null) cancelAnimationFrame(pendingScrollRaf);
  pendingScrollRaf = requestAnimationFrame(() => {
    pendingScrollRaf = null;
    const element = scrollerRef.value;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  });
}

function onBodyScroll() {
  const element = scrollerRef.value;
  if (!element) return;
  followBottom.value = distanceToBottom(element) <= 24;
}

function toggleOpen() {
  userTouched.value = true;
  open.value = !open.value;
  if (open.value) {
    followBottom.value = true;
    void nextTick(() => {
      scheduleScrollToBottom();
      emit("layout-change");
    });
    return;
  }
  emit("layout-change");
}

function onBodyTransitionEnd(event: TransitionEvent) {
  if (event.target !== event.currentTarget || event.propertyName !== "grid-template-rows") return;
  emit("layout-change");
}

watch(
  () => props.id,
  () => {
    userTouched.value = false;
    followBottom.value = true;
    open.value = !props.defaultCollapsed;
    void nextTick(() => {
      scheduleScrollToBottom();
      emit("layout-change");
    });
  }
);

watch(
  () => props.defaultCollapsed,
  (next) => {
    if (next) {
      open.value = false;
      emit("layout-change");
      return;
    }
    if (!userTouched.value) {
      open.value = true;
      void nextTick(() => {
        scheduleScrollToBottom();
        emit("layout-change");
      });
    }
  }
);

watch(
  () => props.items.map((item) => item.id).join("\n"),
  () => {
    void nextTick(() => {
      scheduleScrollToBottom();
      emit("layout-change");
    });
  },
  { flush: "post" }
);

onBeforeUnmount(() => {
  if (pendingScrollRaf != null) cancelAnimationFrame(pendingScrollRaf);
  pendingScrollRaf = null;
});
</script>
