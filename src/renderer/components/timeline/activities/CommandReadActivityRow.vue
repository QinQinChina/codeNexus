<template>
  <CommandActivityRow kind="read" :item="item" />
</template>

<script setup lang="ts">
import type { CommandReadNode } from "../../../features/timeline/renderModel/buildTimelineNodes";
import CommandActivityRow from "./CommandActivityRow.vue";

defineProps<{ item: CommandReadNode }>();
</script>
