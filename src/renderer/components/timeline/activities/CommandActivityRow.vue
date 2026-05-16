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
          :cycle-max-chars="128"
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
  () => readItem.value.name || basename(readItem.value.path) || readItem.value.path || "读取内容"
);
const readPathText = computed(() => readItem.value.path || fileLabel.value);
const listScopeText = computed(() => listItem.value.path || "当前目录");
const searchScopeText = computed(() => searchItem.value.path || "");
const queryText = computed(() => searchItem.value.query || "搜索");

const activityText = computed(() => {
  if (props.kind === "read") {
    const target = readPathText.value ? `：${readPathText.value}` : "";
    return `读取文件${target}`;
  }

  if (props.kind === "list") {
    const scope = listScopeText.value;
    return `列出文件：${scope}`;
  }

  const scope = searchScopeText.value ? `（${searchScopeText.value}）` : "";
  return `搜索："${queryText.value}"${scope}`;
});

const metaText = computed(() => {
  if (props.kind === "read") return "";
  if (props.kind === "list") return `${listItem.value.filesCount} 项`;
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
