<template>
  <section class="settings-page" aria-label="设置页">
    <SettingsHeader />
    <div class="settings-scroll app-scrollbar">
      <div class="settings-stage">
        <div class="settings-tab-content" :data-tab="activeTab">
          <GlobalConfigDrawer v-if="activeTab === 'global'" mode="settings" />
          <SettingsSoundTab v-else-if="activeTab === 'sound'" />
          <EnvSetupDrawer v-else-if="activeTab === 'env'" mode="settings" />
          <IntegrationsDrawer v-else-if="activeTab === 'integrations'" mode="settings" />
          <SettingsRemoteSyncTab v-else-if="activeTab === 'remote'" />
          <UpdateDrawer v-else-if="activeTab === 'update'" mode="settings" />
          <GlobalConfigDrawer v-else mode="settings" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useAppShellStore } from "../../stores/appShell.store";
import SettingsHeader from "./SettingsHeader.vue";
import GlobalConfigDrawer from "./GlobalConfigDrawer.vue";
import EnvSetupDrawer from "./EnvSetupDrawer.vue";
import IntegrationsDrawer from "./IntegrationsDrawer.vue";
import UpdateDrawer from "./UpdateDrawer.vue";
import SettingsSoundTab from "./settings/SettingsSoundTab.vue";
import SettingsRemoteSyncTab from "./settings/SettingsRemoteSyncTab.vue";

const appShellStore = useAppShellStore();
const activeTab = computed(() => appShellStore.settingsActiveTab);

watch(
  () => appShellStore.settingsOpen,
  (open) => {
    if (!open) return;
    // Settings 页进入时保持 Integrations 子 tab 同步到 store，确保从 MCP 跳转能落地。
    if (activeTab.value === "integrations") {
      appShellStore.setSettingsIntegrationsTab(appShellStore.settingsIntegrationsTab);
    }
  }
);
</script>

<style scoped>
.settings-page {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.settings-scroll {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 14px 14px 16px;
  overscroll-behavior: contain;
}

.settings-stage {
  min-width: 0;
  max-width: 1060px;
  margin: 0 auto;
}

.settings-tab-content {
  min-width: 0;
  display: grid;
  gap: 12px;
}
</style>
