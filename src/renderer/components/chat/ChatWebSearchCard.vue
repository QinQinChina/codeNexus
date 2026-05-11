<template>
  <div class="chat-tool-wrap w-full max-w-full min-w-0">
    <article
      class="web-search-activity"
      :class="webSearchActivityClass"
      :aria-busy="item.status === 'running'"
      tabindex="0"
    >
      <div class="web-search-line">
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
          :cycle-max-chars="128"
          :min-opacity="item.status === 'running' ? 0.34 : 0.72"
          :max-opacity="1"
        />
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { CircleDashed, FileSearch, Globe, Search } from "lucide-vue-next";
import type { ChatWebSearchItem } from "../layout/chat.types";
import WaveText from "../ui/WaveText.vue";

const props = defineProps<{
  item: ChatWebSearchItem;
}>();

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

.web-search-time {
  flex: none;
  color: color-mix(in srgb, var(--text-muted) 72%, transparent);
  font-size: 11px;
  line-height: 1;
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
}
</style>
