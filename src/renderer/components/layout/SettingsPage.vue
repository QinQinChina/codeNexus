<template>
  <section class="settings-page" :aria-label="t('settings.pageAria')">
    <div class="settings-workspace">
      <aside class="settings-sidebar app-scrollbar" :aria-label="t('settings.sidebarAria')">
        <nav class="settings-nav" role="tablist" :aria-label="t('settings.tabsAria')">
          <section v-for="group in tabGroups" :key="group.label" class="settings-nav-group">
            <div class="settings-nav-section">{{ group.label }}</div>
            <button
              v-for="tab in group.items"
              :key="tab.key"
              class="settings-nav-item"
              :class="{ 'is-active': activeTab === tab.key }"
              type="button"
              role="tab"
              :aria-selected="activeTab === tab.key ? 'true' : 'false'"
              @click="appShellStore.setSettingsTab(tab.key)"
            >
              <component :is="tab.icon" class="settings-nav-icon" aria-hidden="true" />
              <span class="settings-nav-copy">
                <span class="settings-nav-label">{{ tab.label }}</span>
                <span class="settings-nav-desc">{{ tab.desc }}</span>
              </span>
            </button>
          </section>
        </nav>
      </aside>

      <div class="settings-scroll app-scrollbar">
        <div class="settings-stage">
          <div class="settings-tab-content" :data-tab="activeTab">
            <GlobalConfigDrawer v-if="activeTab === 'global'" mode="settings" />
            <CodexProfilesSettingsTab v-else-if="activeTab === 'profiles'" />
            <SettingsSoundTab v-else-if="activeTab === 'sound'" />
            <SettingsImageGenerationTab v-else-if="activeTab === 'image'" />
            <SettingsFlowchartAiTab v-else-if="activeTab === 'flowchart'" />
            <SettingsUpdateTab v-else-if="activeTab === 'update'" />
            <EnvSetupDrawer v-else-if="activeTab === 'env'" mode="settings" />
            <IntegrationsDrawer v-else-if="activeTab === 'integrations'" mode="settings" />
            <GlobalConfigDrawer v-else mode="settings" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Bell, Bot, Download, Image, PlugZap, Settings2, SlidersHorizontal, Workflow } from "lucide-vue-next";
import { useAppShellStore } from "../../stores/appShell.store";
import GlobalConfigDrawer from "./overlays/GlobalConfigDrawer.vue";
import EnvSetupDrawer from "./overlays/EnvSetupDrawer.vue";
import IntegrationsDrawer from "./overlays/IntegrationsDrawer.vue";
import SettingsSoundTab from "./settings/SettingsSoundTab.vue";
import SettingsImageGenerationTab from "./settings/SettingsImageGenerationTab.vue";
import SettingsFlowchartAiTab from "./settings/SettingsFlowchartAiTab.vue";
import SettingsUpdateTab from "./settings/SettingsUpdateTab.vue";
import CodexProfilesSettingsTab from "./settings/CodexProfilesSettingsTab.vue";

const appShellStore = useAppShellStore();
const { t } = useI18n();
const activeTab = computed(() => appShellStore.settingsActiveTab);
const tabGroups = computed(() => [
  {
    label: t("settings.groups.basics"),
    items: [
      {
        key: "global" as const,
        label: t("settings.tabs.global"),
        desc: t("settings.tabs.globalDesc"),
        icon: SlidersHorizontal,
      },
      {
        key: "profiles" as const,
        label: t("settings.tabs.profiles"),
        desc: t("settings.tabs.profilesDesc"),
        icon: Bot,
      },
    ],
  },
  {
    label: t("settings.groups.extensions"),
    items: [
      {
        key: "integrations" as const,
        label: t("settings.tabs.integrations"),
        desc: t("settings.tabs.integrationsDesc"),
        icon: PlugZap,
      },
      {
        key: "image" as const,
        label: t("settings.tabs.image"),
        desc: t("settings.tabs.imageDesc"),
        icon: Image,
      },
      {
        key: "flowchart" as const,
        label: t("settings.tabs.flowchart"),
        desc: t("settings.tabs.flowchartDesc"),
        icon: Workflow,
      },
    ],
  },
  {
    label: t("settings.groups.runtime"),
    items: [
      {
        key: "sound" as const,
        label: t("settings.tabs.sound"),
        desc: t("settings.tabs.soundDesc"),
        icon: Bell,
      },
      {
        key: "update" as const,
        label: t("settings.tabs.update"),
        desc: t("settings.tabs.updateDesc"),
        icon: Download,
      },
      {
        key: "env" as const,
        label: t("settings.tabs.env"),
        desc: t("settings.tabs.envDesc"),
        icon: Settings2,
      },
    ],
  },
]);

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
