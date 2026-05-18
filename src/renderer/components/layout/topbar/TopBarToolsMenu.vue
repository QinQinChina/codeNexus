<template>
  <div class="topbar-single-switch" :class="{ 'is-open': props.open }">
    <span class="topbar-single-switch-thumb" aria-hidden="true"></span>
    <button
      id="btn-topbar-tools"
      class="topbar-single-switch-option"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="props.open ? 'true' : 'false'"
      :aria-label="t('topbarExtra.tools')"
      @click.stop="emit('toggle')"
    >
      <SlidersHorizontal aria-hidden="true" />
      <span class="topbar-right-switch-label">{{ t("topbarExtra.tools") }}</span>
    </button>
  </div>

  <Transition name="topbar-fly">
    <div v-if="props.open" class="topbar-menu-shell topbar-menu-shell--tools" @click.stop>
      <div class="topbar-dropdown topbar-menu app-scrollbar" role="menu" :aria-label="t('topbarExtra.toolsMenu')">
        <div class="topbar-menu-section">
          <div class="topbar-menu-heading">{{ t("topbarExtra.contextActions") }}</div>
          <button
            id="btn-topbar-rollback"
            class="btn-mini !justify-start"
            type="button"
            @click="onContextActionComingSoon"
          >
            {{ t("topbarExtra.rollbackRecent") }}
          </button>
          <div class="topbar-menu-note">{{ t("topbarExtra.rollbackUnavailable") }}</div>
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
import { computed } from "vue";
import { SlidersHorizontal } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { showToast } from "../../../ui/toast";
import { getRuntimeOrchestrator } from "../../../domain/runtimeOrchestrator";

const props = defineProps<{
  open: boolean;
}>();

const runtime = getRuntimeOrchestrator();
const { t } = useI18n();

const enableThreadMemoryLabel = computed(() => t("topbarExtra.enableThreadMemory"));
const disableThreadMemoryLabel = computed(() => t("topbarExtra.disableThreadMemory"));
const resetCodexMemoryLabel = computed(() => t("topbarExtra.resetCodexMemory"));

const emit = defineEmits<{
  (e: "toggle"): void;
  (e: "close"): void;
}>();

const onContextActionComingSoon = () => {
  showToast({
    kind: "info",
    title: t("topbarExtra.rollbackRecent"),
    message: t("topbarExtra.rollbackUnavailableToast"),
    timeoutMs: 4500,
  });
};
</script>
