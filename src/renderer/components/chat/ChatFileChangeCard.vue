<template>
  <div class="chat-tool-wrap w-full max-w-full min-w-0">
    <div
      v-for="(file, fileIndex) in renderableFiles"
      :key="`${item.id}:file:${fileIndex}`"
      class="mb-2.5 w-full max-w-full min-w-0 last:mb-0"
    >
      <FileChangeCardContent
        mode="chat"
        :statusText="statusText"
        :fileChangeEventClass="`${eventClass} opacity-[0.96]`"
        :file="file"
        :fileChangeKindClass="fileChangeKindClass"
        :fileChangeKindText="fileChangeKindText"
        :fileChangeDiffMetaText="fileChangeDiffMetaText"
        :isRunning="item.isStreaming"
        :streamUpdateCount="item.streamUpdateCount"
        :lastPatchUpdatedAt="item.lastPatchUpdatedAt"
        :settledAt="item.settledAt"
        :wrapDiffLines="false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import FileChangeCardContent from "../timeline/cards/FileChangeCardContent.vue";
import type { FileChangeNode } from "../../features/timeline/renderModel/buildTimelineNodes";

defineProps<{
  item: FileChangeNode;
  renderableFiles: any[];
  statusText: string;
  eventClass: string;
  fileChangeKindClass: (kind: string) => any;
  fileChangeKindText: (kind: string) => string;
  fileChangeDiffMetaText: (diffText: string) => string;
}>();
</script>
