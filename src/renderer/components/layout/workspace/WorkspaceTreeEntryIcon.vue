<template>
  <Icon
    :icon="vscodeIcon"
    class="workspace-file-tree-row__icon workspace-file-tree-row__icon--vscode"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Icon } from "@iconify/vue";
import { resolveVscodeEntryIcon } from "./vscodeFileIcons";

const props = withDefaults(
  defineProps<{
    path: string;
    isDirectory: boolean;
    isExpanded?: boolean;
  }>(),
  {
    isExpanded: false,
  }
);

const vscodeIcon = computed(() => {
  return resolveVscodeEntryIcon(props.path, {
    isDirectory: props.isDirectory,
    isExpanded: props.isExpanded,
  });
});
</script>
