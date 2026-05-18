<template>
  <div class="chat-tool-wrap command-activity-wrap w-full max-w-full min-w-0">
    <article class="chat-inline-activity command-activity" :class="activityClass" :aria-busy="isRunning" tabindex="0">
      <div class="chat-inline-activity__line chat-inline-activity__line--compact command-activity-line">
        <span class="chat-inline-activity__icon command-activity-icon-wrap" aria-hidden="true">
          <FileText v-if="kind === 'read'" class="chat-inline-activity__svg command-activity-icon" />
          <ListTree v-else-if="kind === 'list'" class="chat-inline-activity__svg command-activity-icon" />
          <Search v-else class="chat-inline-activity__svg command-activity-icon" />
        </span>

        <ExecutionWaveText
          v-if="isRunning"
          class="chat-inline-activity__text command-activity-text"
          color="var(--accent)"
          :text="activityText"
          :cycle-max-chars="0"
        />
        <span v-else class="chat-inline-activity__text command-activity-text">
          {{ activityText }}
        </span>
        <span v-if="metaText" class="chat-inline-activity__meta command-activity-meta mono">{{ metaText }}</span>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { FileText, ListTree, Search } from "lucide-vue-next";
import ExecutionWaveText from "../../ui/ExecutionWaveText.vue";
import type {
  CommandListNode,
  CommandReadNode,
  CommandSearchNode,
} from "../../../features/timeline/renderModel/buildTimelineNodes";

type CommandActivityKind = "read" | "list" | "search";
type CommandActivityItem = CommandReadNode | CommandListNode | CommandSearchNode;

const props = withDefaults(
  defineProps<{
    kind: CommandActivityKind;
    item: CommandActivityItem;
  }>(),
  {}
);

const { t } = useI18n();
const readItem = computed(() => props.item as CommandReadNode);
const listItem = computed(() => props.item as CommandListNode);
const searchItem = computed(() => props.item as CommandSearchNode);
const isRunning = computed(() => props.item.status === "running");

const basename = (value: string) =>
  String(value ?? "")
    .split(/[\\/]+/)
    .filter(Boolean)
    .pop() ?? "";

const fileLabel = computed(
  () => readItem.value.name || basename(readItem.value.path) || readItem.value.path || t("commandActivity.readContent")
);
const readPathText = computed(() => readItem.value.path || fileLabel.value);
const listScopeText = computed(() => listItem.value.path || t("commandActivity.currentDirectory"));
const searchScopeText = computed(() => searchItem.value.path || "");
const queryText = computed(() => searchItem.value.query || t("commandActivity.search"));

const activityText = computed(() => {
  if (props.kind === "read") {
    return t("commandActivity.readFile", { target: readPathText.value });
  }

  if (props.kind === "list") {
    return t("commandActivity.listFiles", { scope: listScopeText.value });
  }

  const scope = searchScopeText.value ? t("commandActivity.searchScope", { scope: searchScopeText.value }) : "";
  return t("commandActivity.searchInScope", { query: queryText.value, scope });
});

const metaText = computed(() => {
  if (props.kind === "read") return "";
  if (props.kind === "list") return t("commandActivity.itemCount", { count: listItem.value.filesCount });
  return "";
});

const activityClass = computed(() => ({
  "is-running": props.item.status === "running",
  "is-completed": props.item.status === "completed",
  "is-read": props.kind === "read",
  "is-list": props.kind === "list",
  "is-search": props.kind === "search",
}));
</script>
