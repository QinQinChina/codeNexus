<template>
  <button
    id="btn-workspace"
    class="topbar-pill topbar-pill--workspace"
    :class="{ 'is-active': props.open }"
    type="button"
    aria-haspopup="menu"
    :aria-expanded="props.open ? 'true' : 'false'"
    @click.stop="emit('toggle')"
  >
    <span class="topbar-pill-caption">工作区</span>
    <span class="topbar-pill-value topbar-pill-value--workspace" :class="{ dim: !runtimeStore.workspacePath }">
      {{ workspaceName }}
    </span>
    <ChevronDown class="topbar-pill-caret" aria-hidden="true" />
  </button>

  <Transition name="topbar-fly" @after-enter="onWorkspaceMenuAfterEnter" @after-leave="onWorkspaceMenuAfterLeave">
    <div v-if="props.open" class="topbar-menu-shell topbar-menu-shell--workspace" @click.stop>
      <div class="topbar-dropdown app-scrollbar topbar-menu topbar-menu--workspace" role="menu" aria-label="工作区菜单">
        <div class="workspace-menu-head">
          <div class="topbar-menu-heading">当前工作区</div>
          <button
            id="btn-workspace-select"
            class="btn-mini workspace-menu-select"
            type="button"
            role="menuitem"
            @click="onSelectWorkspace"
          >
            {{ workspaceMenuActionLabel }}
          </button>
        </div>
        <div
          class="workspace-path-inline mono"
          :class="{ dim: !runtimeStore.workspacePath }"
        >
          {{ runtimeStore.workspacePath || "未选择工作区" }}
        </div>
        <div class="topbar-menu-note">绑定当前任务目录，并驱动文件面板与动态工具</div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { getRuntimeOrchestrator } from "../../../domain/runtimeOrchestrator";
import { useAppShellStore } from "../../../stores/appShell.store";
import { useRuntimeStore } from "../../../stores/runtime.store";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle"): void;
  (e: "close"): void;
}>();

const runtime = getRuntimeOrchestrator();
const appShellStore = useAppShellStore();
const runtimeStore = useRuntimeStore();

const workspaceName = computed(() => {
  const pathValue = runtimeStore.workspacePath;
  if (!pathValue) return "未选择";
  const normalized = pathValue.replace(/[\\/]+$/, "");
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) || pathValue;
});

const workspaceMenuActionLabel = computed(() => (runtimeStore.workspacePath ? "更换工作区" : "选择工作区"));

function onWorkspaceMenuAfterEnter() {
  appShellStore.setWorkspaceMenuTourReady(true);
}

function onWorkspaceMenuAfterLeave() {
  appShellStore.setWorkspaceMenuTourReady(false);
}

async function onSelectWorkspace() {
  emit("close");
  await runtime.selectWorkspace();
}

onBeforeUnmount(() => {
  appShellStore.setWorkspaceMenuTourReady(false);
});
</script>
