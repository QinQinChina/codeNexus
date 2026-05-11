<template>
  <section class="settings-page" aria-label="设置页">
    <SettingsHeader />
    <div class="settings-workspace">
      <aside class="settings-sidebar app-scrollbar" aria-label="设置导航">
        <div class="settings-nav-section">管理</div>
        <nav class="settings-nav" role="tablist" aria-label="设置选项卡">
          <button
            v-for="tab in tabs"
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
        </nav>
      </aside>

      <div class="settings-scroll app-scrollbar">
        <div class="settings-stage">
          <header class="settings-content-head">
            <div>
              <div class="settings-content-eyebrow">{{ activeTabMeta.eyebrow }}</div>
              <h2>{{ activeTabMeta.label }}</h2>
              <p>{{ activeTabMeta.desc }}</p>
            </div>
            <span class="settings-content-chip mono">{{ activeTabMeta.chip }}</span>
          </header>

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
import GlobalConfigDrawer from "./GlobalConfigDrawer.vue";
import EnvSetupDrawer from "./EnvSetupDrawer.vue";
import IntegrationsDrawer from "./IntegrationsDrawer.vue";
import SettingsSoundTab from "./settings/SettingsSoundTab.vue";
import SettingsImageGenerationTab from "./settings/SettingsImageGenerationTab.vue";
import SettingsRemoteSyncTab from "./settings/SettingsRemoteSyncTab.vue";
import CodexProfilesSettingsTab from "./settings/CodexProfilesSettingsTab.vue";

const appShellStore = useAppShellStore();
const activeTab = computed(() => appShellStore.settingsActiveTab);
const tabs = [
  {
    key: "global" as const,
    label: "通用",
    desc: "全局配置与界面偏好",
    chip: "core",
    eyebrow: "General",
    icon: SlidersHorizontal,
  },
  {
    key: "profiles" as const,
    label: "模型配置",
    desc: "Provider、模型与 API Key",
    chip: "profile",
    eyebrow: "Codex",
    icon: Bot,
  },
  {
    key: "integrations" as const,
    label: "集成与工具",
    desc: "Skills、MCP 与扩展能力",
    chip: "tools",
    eyebrow: "Integrations",
    icon: PlugZap,
  },
  {
    key: "image" as const,
    label: "图片生成",
    desc: "OpenAI Images API 与本地工作台",
    chip: "image",
    eyebrow: "Images",
    icon: Image,
  },
  {
    key: "sound" as const,
    label: "提示音",
    desc: "线程结束提醒与音量",
    chip: "audio",
    eyebrow: "Notification",
    icon: Bell,
  },
  {
    key: "remote" as const,
    label: "远程同步",
    desc: "设备同步、登录与队列状态",
    chip: "sync",
    eyebrow: "Remote",
    icon: Cloud,
  },
  {
    key: "env" as const,
    label: "环境检测",
    desc: "本机依赖与运行环境",
    chip: "env",
    eyebrow: "Setup",
    icon: Settings2,
  },
];
const activeTabMeta = computed(() => tabs.find((tab) => tab.key === activeTab.value) ?? tabs[0]);

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
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface-2) 34%, transparent),
    color-mix(in srgb, var(--bg) 96%, transparent)
  );
}

.settings-workspace {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr);
  gap: 0;
}

.settings-sidebar {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 14px 12px;
  border-right: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: color-mix(in srgb, var(--surface-1) 50%, transparent);
}

.settings-nav-section {
  padding: 0 8px 8px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.settings-nav {
  display: grid;
  gap: 5px;
}

.settings-nav-item {
  width: 100%;
  min-width: 0;
  min-height: 48px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  text-align: left;
  transition:
    background-color 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease;
}

.settings-nav-item:hover:not(.is-active) {
  border-color: color-mix(in srgb, var(--border) 56%, transparent);
  background: color-mix(in srgb, var(--surface-2) 46%, transparent);
  color: color-mix(in srgb, var(--text) 82%, transparent);
}

.settings-nav-item.is-active {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-1));
  color: var(--text);
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--accent) 88%, var(--text) 12%);
}

.settings-nav-icon {
  width: 17px;
  height: 17px;
  justify-self: center;
  stroke-width: 2;
}

.settings-nav-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.settings-nav-label,
.settings-nav-desc {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-nav-label {
  color: currentColor;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.2;
}

.settings-nav-desc {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.2;
}

.settings-scroll {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 12px 14px 14px;
  overscroll-behavior: contain;
  background: color-mix(in srgb, var(--bg) 72%, var(--surface-1) 28%);
}

.settings-stage {
  min-width: 0;
  width: 100%;
  max-width: none;
  margin: 0;
  display: grid;
  gap: 12px;
  align-content: start;
}

.settings-content-head {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
  background: color-mix(in srgb, var(--surface-1) 72%, transparent);
}

.settings-content-eyebrow {
  margin-bottom: 4px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.settings-content-head h2 {
  margin: 0;
  color: var(--text-1);
  font-size: 18px;
  line-height: 1.25;
  font-weight: 720;
}

.settings-content-head p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.4;
}

.settings-content-chip {
  flex: 0 0 auto;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border-accent) 76%, transparent);
  background: var(--bg-accent-soft);
  color: var(--fg-accent);
  display: inline-flex;
  align-items: center;
  font-size: 11px;
}

.settings-tab-content {
  min-width: 0;
  width: 100%;
  display: grid;
  gap: 12px;
}

.settings-tab-content :deep(.global-config-drawer-overlay.is-settings) {
  width: 100%;
}

.settings-tab-content :deep(.global-config-drawer-overlay.is-settings .global-config-drawer-panel) {
  max-width: none;
  min-height: calc(100vh - var(--topbar-h, 0px) - 168px);
  margin: 0;
  border-radius: 8px;
  box-shadow: 0 8px 22px color-mix(in srgb, rgb(from var(--ui-shadow-source) r g b / 0.5) 12%, transparent);
}

.settings-tab-content :deep(.global-config-drawer-body.is-settings) {
  padding: 12px;
}

@media (max-width: 860px) {
  .settings-workspace {
    grid-template-columns: 1fr;
  }

  .settings-sidebar {
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    overflow-x: auto;
    overflow-y: hidden;
  }

  .settings-nav {
    grid-auto-flow: column;
    grid-auto-columns: minmax(156px, 1fr);
  }
}

@media (max-width: 560px) {
  .settings-scroll {
    padding: 10px;
  }

  .settings-content-head {
    display: grid;
  }
}
</style>
