<template>
  <CommandActivityRow kind="search" :item="item" />
</template>

<script setup lang="ts">
import type { CommandSearchNode } from "../../../features/timeline/renderModel/buildTimelineNodes";
import CommandActivityRow from "./CommandActivityRow.vue";

defineProps<{ item: CommandSearchNode }>();
</script>
