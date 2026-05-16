<template>
  <button
    id="btn-workspace-select"
    class="btn-mini topbar-workspace-select"
    type="button"
    v-tooltip="workspaceButtonTitle"
    :aria-label="workspaceButtonTitle"
    @click="onSelectWorkspaceClick"
  >
    <FolderOpen class="topbar-workspace-select__icon" aria-hidden="true" />
    <span class="topbar-workspace-select__label">{{ workspaceButtonLabel }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { FolderOpen } from "lucide-vue-next";
import { basenameFromPath } from "../../../domain/workspaceFiles";
import { getRuntimeOrchestrator } from "../../../domain/runtimeOrchestrator";
import { useRuntimeStore } from "../../../stores/runtime.store";

const runtime = getRuntimeOrchestrator();
const runtimeStore = useRuntimeStore();

const workspacePath = computed(() => String(runtimeStore.workspacePath ?? "").trim());
const workspaceButtonLabel = computed(() => {
  const currentWorkspacePath = workspacePath.value;
  if (!currentWorkspacePath) return "选择工作区";
  return basenameFromPath(currentWorkspacePath) || currentWorkspacePath;
});
const workspaceButtonTitle = computed(() => workspacePath.value || "选择工作区");

const onSelectWorkspaceClick = async () => {
  await runtime.selectWorkspace();
};
</script>
