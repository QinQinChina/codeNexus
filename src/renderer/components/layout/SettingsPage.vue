<template>
  <section class="settings-page" aria-label="设置页">
    <SettingsHeader />
    <div class="settings-workspace">
      <aside class="settings-sidebar app-scrollbar" aria-label="设置导航">
        <nav class="settings-nav" role="tablist" aria-label="设置选项卡">
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
            <EnvSetupDrawer v-else-if="activeTab === 'env'" mode="settings" />
            <IntegrationsDrawer v-else-if="activeTab === 'integrations'" mode="settings" />
            <SettingsRemoteSyncTab v-else-if="activeTab === 'remote'" />
            <GlobalConfigDrawer v-else mode="settings" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { Bell, Bot, Cloud, Image, PlugZap, Settings2, SlidersHorizontal } from "lucide-vue-next";
import { useAppShellStore } from "../../stores/appShell.store";
import SettingsHeader from "./SettingsHeader.vue";
import GlobalConfigDrawer from "./overlays/GlobalConfigDrawer.vue";
import EnvSetupDrawer from "./overlays/EnvSetupDrawer.vue";
import IntegrationsDrawer from "./overlays/IntegrationsDrawer.vue";
import SettingsSoundTab from "./settings/SettingsSoundTab.vue";
import SettingsImageGenerationTab from "./settings/SettingsImageGenerationTab.vue";
import SettingsRemoteSyncTab from "./settings/SettingsRemoteSyncTab.vue";
import CodexProfilesSettingsTab from "./settings/CodexProfilesSettingsTab.vue";

const appShellStore = useAppShellStore();
const activeTab = computed(() => appShellStore.settingsActiveTab);
const tabGroups = [
  {
    label: "基础配置",
    items: [
      {
        key: "global" as const,
        label: "通用",
        desc: "全局配置与界面偏好",
        icon: SlidersHorizontal,
      },
      {
        key: "profiles" as const,
        label: "模型配置",
        desc: "Provider、模型与 API Key",
        icon: Bot,
      },
    ],
  },
  {
    label: "能力扩展",
    items: [
      {
        key: "integrations" as const,
        label: "集成与工具",
        desc: "Skills、MCP 与扩展能力",
        icon: PlugZap,
      },
      {
        key: "image" as const,
        label: "图片生成",
        desc: "OpenAI Images API 与本地工作台",
        icon: Image,
      },
    ],
  },
  {
    label: "运行状态",
    items: [
      {
        key: "sound" as const,
        label: "提示音",
        desc: "线程结束提醒与音量",
        icon: Bell,
      },
      {
        key: "remote" as const,
        label: "远程同步",
        desc: "设备同步、登录与队列状态",
        icon: Cloud,
      },
      {
        key: "env" as const,
        label: "环境检测",
        desc: "本机依赖与运行环境",
        icon: Settings2,
      },
    ],
  },
];

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
