<template>
  <div class="topbar-single-switch" :class="{ 'is-open': props.open }">
    <span class="topbar-single-switch-thumb" aria-hidden="true"></span>
    <button
      id="btn-topbar-tools"
      class="topbar-single-switch-option"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="props.open ? 'true' : 'false'"
      aria-label="工具"
      title="工具"
      @click.stop="emit('toggle')"
    >
      <SlidersHorizontal aria-hidden="true" />
      <span class="topbar-right-switch-label">工具</span>
    </button>
  </div>

  <Transition name="topbar-fly">
    <div v-if="props.open" class="topbar-menu-shell topbar-menu-shell--tools" @click.stop>
      <div class="topbar-dropdown topbar-menu app-scrollbar" role="menu" aria-label="工具菜单">
        <div class="topbar-menu-section">
          <div class="topbar-menu-heading">上下文操作</div>
          <button
            id="btn-topbar-rollback"
            class="btn-mini !justify-start"
            type="button"
            @click="onContextActionComingSoon"
          >
            撤回最近 N 轮
          </button>
          <div class="topbar-menu-note">撤回功能开发中，暂不可用。</div>
          <button
            id="btn-topbar-memory-enable"
            class="btn-mini !justify-start"
            type="button"
            @click="runtime.setCurrentThreadMemoryMode('enabled')"
          >
            {{ enableThreadMemoryLabel }}
          </button>
          <button
            id="btn-topbar-memory-disable"
            class="btn-mini !justify-start"
            type="button"
            @click="runtime.setCurrentThreadMemoryMode('disabled')"
          >
            {{ disableThreadMemoryLabel }}
          </button>
          <button
            id="btn-topbar-memory-reset"
            class="btn-mini !justify-start danger"
            type="button"
            @click="runtime.resetCodexMemory()"
          >
            {{ resetCodexMemoryLabel }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { SlidersHorizontal } from "lucide-vue-next";
import { showToast } from "../../../ui/toast";
import { getRuntimeOrchestrator } from "../../../domain/runtimeOrchestrator";

const props = defineProps<{
  open: boolean;
}>();

const runtime = getRuntimeOrchestrator();

const enableThreadMemoryLabel = "\u542f\u7528\u5f53\u524d\u7ebf\u7a0b\u8bb0\u5fc6";
const disableThreadMemoryLabel = "\u5173\u95ed\u5f53\u524d\u7ebf\u7a0b\u8bb0\u5fc6";
const resetCodexMemoryLabel = "\u91cd\u7f6e Codex \u8bb0\u5fc6";

const emit = defineEmits<{
  (e: "toggle"): void;
  (e: "close"): void;
}>();

const onContextActionComingSoon = () => {
  showToast({
    kind: "info",
    title: "撤回最近 N 轮",
    message: "正在开发中，暂时无法使用...",
    timeoutMs: 4500,
  });
};
</script>
