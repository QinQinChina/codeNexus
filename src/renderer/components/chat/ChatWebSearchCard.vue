<template>
  <div class="chat-tool-wrap w-full max-w-full min-w-0">
    <article
      class="web-search-activity"
      :class="webSearchActivityClass"
      :aria-busy="item.status === 'running'"
      tabindex="0"
      @pointerenter="openPopover"
      @pointerleave="closePopover"
      @pointermove="updatePopover"
      @focusin="openPopover"
      @focusout="closePopover"
    >
      <div class="web-search-line" :ref="setAnchor" @pointerenter="openPopover" @pointermove="updatePopover">
        <span class="web-search-icon-wrap" aria-hidden="true">
          <Globe v-if="item.actionType === 'openPage'" class="web-search-icon" />
          <FileSearch v-else-if="item.actionType === 'findInPage'" class="web-search-icon" />
          <CircleDashed v-else-if="item.actionType === 'other'" class="web-search-icon" />
          <Search v-else class="web-search-icon" />
        </span>

        <WaveText
          class="web-search-wave"
          :text="activityText"
          :enabled="waveEnabled"
          color="var(--web-search-wave-color)"
          :char-delay-sec="0.045"
          :char-anim-duration-sec="0.78"
          :pause-sec="0.5"
          :min-opacity="item.status === 'running' ? 0.34 : 0.72"
          :max-opacity="1"
        />

        <span v-if="item.status === 'running'" class="web-search-running-dot" aria-hidden="true"></span>
      </div>

      <div
        class="web-search-popover"
        :class="{ 'is-open': popoverOpen }"
        role="tooltip"
        :ref="setPopover"
        :style="popoverStyle"
      >
        <div class="web-search-popover-head">
          <span class="web-search-popover-title">{{ item.title }}</span>
          <span class="web-search-status">{{ webSearchStatusText }}</span>
        </div>

        <div class="web-search-detail" :title="item.primaryText">
          <span class="web-search-detail-label">{{ item.actionLabel }}</span>
          <span class="web-search-detail-value">{{ item.primaryText }}</span>
        </div>

        <div v-if="item.secondaryText" class="web-search-detail" :title="item.secondaryText">
          <span class="web-search-detail-label">详情</span>
          <span class="web-search-detail-value">{{ item.secondaryText }}</span>
        </div>

        <div v-if="visibleQueries.length > 0" class="web-search-query-list" aria-label="搜索查询">
          <span v-for="query in visibleQueries" :key="query" class="web-search-query" :title="query">
            {{ query }}
          </span>
        </div>

        <div v-if="item.url" class="web-search-url mono" :title="item.url">{{ item.url }}</div>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { CircleDashed, FileSearch, Globe, Search } from "lucide-vue-next";
import type { ChatWebSearchItem } from "../layout/chat.types";
import WaveText from "../ui/WaveText.vue";
import { useAnchoredPopover } from "../ui/useAnchoredPopover";

const props = defineProps<{
  item: ChatWebSearchItem;
}>();

const visibleQueries = computed(() => props.item.queries.slice(0, 6));

const webSearchStatusText = computed(() => (props.item.status === "running" ? "搜索中" : "已完成"));
const waveEnabled = computed(() => props.item.status === "running");

const activityText = computed(() => {
  const target = props.item.primaryText || props.item.summaryText || props.item.title || "网页操作";
  if (props.item.status === "running") {
    if (props.item.actionType === "openPage") return `正在打开 ${target}`;
    if (props.item.actionType === "findInPage") return `正在页内查找 ${target}`;
    if (props.item.actionType === "other") return `正在处理 ${target}`;
    return `正在搜索 ${target}`;
  }
  if (props.item.actionType === "openPage") return `已打开 ${target}`;
  if (props.item.actionType === "findInPage") return `已查找 ${target}`;
  if (props.item.actionType === "other") return `已处理 ${target}`;
  return `已搜索 ${target}`;
});

const webSearchActivityClass = computed(() => ({
  "is-running": props.item.status === "running",
  "is-search": props.item.actionType === "search",
  "is-open-page": props.item.actionType === "openPage",
  "is-find-in-page": props.item.actionType === "findInPage",
}));

const {
  open: popoverOpen,
  popoverStyle,
  setAnchor,
  setPopover,
  openPopover,
  closePopover,
  updatePopover,
} = useAnchoredPopover({ prefer: "below", marginPx: 10, gapPx: 6 });
</script>

<style scoped>
:global(.timeline-pane--chat .chat-tool-wrap > .web-search-activity) {
  border: 0;
  background: transparent;
  box-shadow: none;
}

:global(:root[data-theme="light"] .timeline-pane--chat .chat-tool-wrap > .web-search-activity) {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.web-search-activity {
  --web-search-wave-color: color-mix(in srgb, var(--text-muted) 76%, var(--text) 24%);
  position: relative;
  z-index: 1;
  display: grid;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 1px 2px;
  color: var(--text-muted);
  outline: none;
}

.web-search-activity.is-running {
  --web-search-wave-color: color-mix(in srgb, var(--fg-accent) 82%, var(--text) 18%);
}

.web-search-line {
  display: inline-flex;
  justify-self: start;
  width: auto;
  max-width: 100%;
  min-width: 0;
  min-height: 24px;
  align-items: center;
  gap: 7px;
  border-radius: 5px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.web-search-activity:focus-visible .web-search-line {
  outline: 1px solid color-mix(in srgb, var(--border-accent) 66%, transparent);
  outline-offset: 3px;
}

.web-search-icon-wrap {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  color: color-mix(in srgb, var(--text-muted) 78%, var(--text) 22%);
}

.web-search-activity.is-running .web-search-icon-wrap {
  color: var(--fg-accent);
}

.web-search-icon {
  width: 14px;
  height: 14px;
  stroke-width: 2.1;
}

.web-search-wave {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  overflow-wrap: normal;
  word-break: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-search-running-dot {
  flex: none;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--fg-accent);
  opacity: 0.78;
  animation: web-search-pulse 900ms ease-in-out infinite;
}

.web-search-time {
  flex: none;
  color: color-mix(in srgb, var(--text-muted) 72%, transparent);
  font-size: 11px;
  line-height: 1;
}

.web-search-popover {
  position: fixed;
  z-index: 1200;
  display: grid;
  width: min(520px, calc(100cqw - 44px));
  max-width: calc(100vw - 48px);
  min-width: min(360px, calc(100cqw - 44px));
  gap: 8px;
  padding: 10px 11px;
  border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--surface-1) 98%, var(--bg) 2%);
  box-shadow:
    0 10px 26px color-mix(in srgb, var(--theme-seed-canvas-deep) 46%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--text) 4%, transparent);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-3px);
  transition:
    opacity 130ms ease,
    transform 130ms ease;
}

.web-search-popover.is-open {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.web-search-popover-head {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.web-search-popover-title {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-search-status {
  flex: none;
  color: color-mix(in srgb, var(--text-muted) 82%, var(--text) 18%);
  font-size: 11px;
  line-height: 1;
}

.web-search-detail {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 9px;
  min-width: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.web-search-detail-label {
  color: color-mix(in srgb, var(--text-muted) 72%, transparent);
  white-space: nowrap;
}

.web-search-detail-value {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--text) 88%, var(--text-muted) 12%);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-search-query-list {
  display: flex;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  gap: 5px;
}

.web-search-query {
  display: inline-flex;
  flex: 0 1 auto;
  min-width: 0;
  max-width: min(100%, 280px);
  align-items: center;
  height: 21px;
  overflow: hidden;
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--surface-2) 74%, transparent);
  color: color-mix(in srgb, var(--text) 82%, var(--text-muted) 18%);
  font-size: 11px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-search-url {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--text-muted) 82%, transparent);
  font-size: 11px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes web-search-pulse {
  0%,
  100% {
    opacity: 0.38;
    transform: scale(0.86);
  }

  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .web-search-running-dot,
  .web-search-popover {
    animation: none;
    transition: none;
  }
}

@container (max-width: 520px) {
  .web-search-line {
    align-items: flex-start;
    gap: 6px;
  }

  .web-search-wave {
    max-width: 100%;
  }

  .web-search-time {
    display: none;
  }

  .web-search-popover {
    width: min(520px, calc(100vw - 20px));
    min-width: 0;
  }
}
</style>
