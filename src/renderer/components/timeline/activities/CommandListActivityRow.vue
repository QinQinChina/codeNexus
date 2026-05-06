<template>
  <CommandActivityRow kind="list" :item="item" />
</template>

<script setup lang="ts">
import type { CommandListNode } from "../../../features/timeline/renderModel/buildTimelineNodes";
import CommandActivityRow from "./CommandActivityRow.vue";

defineProps<{ item: CommandListNode }>();
</script>
