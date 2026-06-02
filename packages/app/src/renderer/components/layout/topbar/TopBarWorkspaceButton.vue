<template>
  <button
    id="btn-workspace-select"
    class="btn-mini topbar-workspace-select"
    type="button"
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
import { useI18n } from "vue-i18n";
import { basenameFromPath } from "../../../domain/workspaceFiles";
import { getRuntimeOrchestrator } from "../../../domain/runtimeOrchestrator";
import { useRuntimeStore } from "../../../stores/runtime.store";

const runtime = getRuntimeOrchestrator();
const runtimeStore = useRuntimeStore();
const { t } = useI18n();

const workspacePath = computed(() => String(runtimeStore.workspacePath ?? "").trim());
const workspaceButtonLabel = computed(() => {
  const currentWorkspacePath = workspacePath.value;
  if (!currentWorkspacePath) return t("topbarExtra.selectWorkspace");
  return basenameFromPath(currentWorkspacePath) || currentWorkspacePath;
});
const workspaceButtonTitle = computed(() => workspacePath.value || t("topbarExtra.selectWorkspace"));

const onSelectWorkspaceClick = async () => {
  await runtime.selectWorkspace();
};
</script>
