<template>
  <div class="chat-tool-wrap w-full max-w-full min-w-0">
    <article
      class="chat-inline-activity web-search-activity"
      :class="webSearchActivityClass"
      :aria-busy="item.status === 'running'"
      tabindex="0"
    >
      <div class="chat-inline-activity__line web-search-line">
        <span class="chat-inline-activity__icon web-search-icon-wrap" aria-hidden="true">
          <Globe v-if="item.actionType === 'openPage'" class="chat-inline-activity__svg web-search-icon" />
          <FileSearch v-else-if="item.actionType === 'findInPage'" class="chat-inline-activity__svg web-search-icon" />
          <CircleDashed v-else-if="item.actionType === 'other'" class="chat-inline-activity__svg web-search-icon" />
          <Search v-else class="chat-inline-activity__svg web-search-icon" />
        </span>

        <ExecutionWaveText
          class="chat-inline-activity__text web-search-wave"
          :text="activityText"
          :enabled="waveEnabled"
          color="var(--web-search-wave-color)"
          :char-delay-sec="0.045"
          :char-anim-duration-sec="0.78"
          :pause-sec="0.5"
          :cycle-max-chars="0"
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
import { useI18n } from "vue-i18n";
import type { ChatWebSearchItem } from "../layout/types/chat.types";
import ExecutionWaveText from "../ui/ExecutionWaveText.vue";

const props = defineProps<{
  item: ChatWebSearchItem;
}>();

const { t } = useI18n();
const waveEnabled = computed(() => props.item.status === "running");

const activityText = computed(() => {
  const target = props.item.primaryText || props.item.summaryText || props.item.title || t("chat.activity.webOperation");
  if (props.item.status === "running") {
    if (props.item.actionType === "openPage") return t("chat.activity.openingWeb", { target });
    if (props.item.actionType === "findInPage") return t("chat.activity.findingWeb", { target });
    if (props.item.actionType === "other") return t("chat.activity.processingWeb", { target });
    return t("chat.activity.searchingWeb", { target });
  }
  if (props.item.actionType === "openPage") return t("chat.activity.openedWeb", { target });
  if (props.item.actionType === "findInPage") return t("chat.activity.foundWeb", { target });
  if (props.item.actionType === "other") return t("chat.activity.processedWeb", { target });
  return t("chat.activity.searchedWeb", { target });
});

const webSearchActivityClass = computed(() => ({
  "is-running": props.item.status === "running",
  "is-search": props.item.actionType === "search",
  "is-open-page": props.item.actionType === "openPage",
  "is-find-in-page": props.item.actionType === "findInPage",
}));
</script>
