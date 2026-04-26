<template>
  <header class="settings-header" aria-label="设置导航">
    <div class="settings-header-inner">
      <button
        id="btn-settings-back"
        class="settings-back"
        type="button"
        aria-label="返回"
        title="返回"
        @click="appShellStore.closeSettings()"
      >
        <ChevronLeft aria-hidden="true" />
        <span class="settings-back-label">返回</span>
      </button>

      <nav class="settings-tabs-shell" role="tablist" aria-label="设置选项卡">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="settings-tab"
          :class="{ 'is-active': activeTab === t.key }"
          type="button"
          role="tab"
          :aria-selected="activeTab === t.key ? 'true' : 'false'"
          @click="onSelectTab(t.key)"
        >
          {{ t.label }}
          <span class="settings-underline" aria-hidden="true"></span>
        </button>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft } from "lucide-vue-next";
import { useAppShellStore, type SettingsTab } from "../../stores/appShell.store";

const appShellStore = useAppShellStore();

const tabs = [
  { key: "global" as const, label: "全局配置" },
  { key: "sound" as const, label: "提示音" },
  { key: "env" as const, label: "环境检测" },
  { key: "integrations" as const, label: "扩展能力" },
  { key: "remote" as const, label: "远程同步" },
  { key: "update" as const, label: "应用更新" },
];

const activeTab = computed(() => appShellStore.settingsActiveTab);

const onSelectTab = (tab: SettingsTab) => {
  appShellStore.setSettingsTab(tab);
};
</script>

<style scoped>
.settings-header {
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background:
    radial-gradient(900px 180px at 18% 0%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 60%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-1) 92%, transparent),
      color-mix(in srgb, var(--surface-1) 70%, transparent)
    );
  -webkit-app-region: no-drag;
}

.settings-header-inner {
  min-width: 0;
  max-width: 1060px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-back {
  height: 28px;
  padding: 0 10px 0 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, var(--surface-1) 72%, transparent);
  color: var(--text);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    border-color 0.14s ease,
    transform 0.14s ease;
}

.settings-back:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--border-accent, var(--accent-soft)) 42%, var(--border) 58%);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-1));
  transform: translateY(-1px);
}

.settings-back :deep(svg) {
  width: 16px;
  height: 16px;
  stroke-width: 2.2;
}

.settings-back-label {
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  user-select: none;
}

.settings-tabs-shell {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
  gap: 0;
  padding: 0 10px;
}

.settings-tab {
  position: relative;
  height: 34px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  letter-spacing: 0.02em;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.14s ease;
}

.settings-tab:hover:not(.is-active) {
  color: color-mix(in srgb, var(--text) 78%, transparent);
}

.settings-tab.is-active {
  color: var(--text);
}

.settings-underline {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 6px;
  height: 2px;
  border-radius: 999px;
  background: transparent;
  transform: scaleX(0.6);
  transform-origin: center;
  transition:
    transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
    background-color 180ms ease;
}

.settings-tab.is-active .settings-underline {
  background: color-mix(in srgb, var(--accent) 92%, var(--surface-1, white) 8%);
  transform: scaleX(1);
}
</style>
