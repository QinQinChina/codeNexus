<template>
  <div class="topbar-wrap">
    <header class="topbar">
      <div class="topbar-left row">
        <TopBarWorkspaceButton />
      </div>

      <div class="topbar-center row"></div>

      <div class="topbar-right-stack">
        <div class="row topbar-controls topbar-controls--sleek">
          <div class="control-group control-group-panes" aria-label="面板">
            <button
              id="btn-toggle-thread-pane"
              class="btn-icon"
              :class="{ 'is-active': appShellStore.leftSidebarVisible }"
              type="button"
              :title="threadPaneTitle"
              :aria-label="threadPaneTitle"
              :aria-pressed="appShellStore.leftSidebarVisible ? 'true' : 'false'"
              @click="onToggleThreadPane"
            >
              <PanelLeftClose v-if="appShellStore.leftSidebarVisible" aria-hidden="true" />
              <PanelLeftOpen v-else aria-hidden="true" />
            </button>
            <button
              id="btn-toggle-files-pane"
              class="btn-icon"
              :class="{ 'is-active': filesPaneVisible }"
              type="button"
              :disabled="!hasWorkspace || appShellStore.settingsOpen"
              :title="filesPaneTitle"
              :aria-label="filesPaneTitle"
              :aria-pressed="filesPaneVisible ? 'true' : 'false'"
              @click="onToggleFilesPane"
            >
              <PanelRightClose v-if="filesPaneVisible" aria-hidden="true" />
              <PanelRightOpen v-else aria-hidden="true" />
            </button>
            <button
              id="btn-open-settings"
              class="btn-icon"
              :class="{ 'is-active': appShellStore.settingsOpen }"
              type="button"
              title="打开设置"
              aria-label="打开设置"
              :aria-pressed="appShellStore.settingsOpen ? 'true' : 'false'"
              @click="onOpenSettings"
            >
              <Settings aria-hidden="true" />
            </button>
          </div>
          <div class="topbar-control-divider" aria-hidden="true"></div>
          <div class="topbar-connection" :class="connectionClass">
            <span class="topbar-connection__dot" aria-hidden="true"></span>
            <span>{{ connectionText }}</span>
          </div>
          <div class="topbar-control-divider" aria-hidden="true"></div>
          <div class="topbar-menu-anchor">
            <TopBarApprovalMenu :open="approvalMenuOpen" @toggle="toggleApprovalMenu" @close="closeApprovalMenu" />
          </div>
          <div class="topbar-control-divider" aria-hidden="true"></div>
          <div class="control-group control-group-actions">
            <TopBarThemeSwitch />
          </div>

          <div class="control-group control-group-window">
            <TopBarWindowControls />
          </div>
        </div>
      </div>
    </header>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from "vue";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Settings } from "lucide-vue-next";
import TopBarWorkspaceButton from "./topbar/TopBarWorkspaceButton.vue";
import TopBarThemeSwitch from "./topbar/TopBarThemeSwitch.vue";
import TopBarWindowControls from "./topbar/TopBarWindowControls.vue";
import { useAppShellStore } from "../../stores/appShell.store";
import { useRuntimeStore } from "../../stores/runtime.store";
import { useWorkspaceFilesStore } from "../../stores/workspaceFiles.store";
import "./topbar/topbar.css";

const TopBarApprovalMenu = defineAsyncComponent(() => import("./topbar/TopBarApprovalMenu.vue"));

const appShellStore = useAppShellStore();
const runtimeStore = useRuntimeStore();
const workspaceFilesStore = useWorkspaceFilesStore();
const approvalMenuOpen = ref(false);

const hasWorkspace = computed(() => Boolean(String(runtimeStore.workspacePath ?? "").trim()));
const filesPaneVisible = computed(
  () => hasWorkspace.value && !appShellStore.settingsOpen && appShellStore.filesSidebarVisible
);
const threadPaneTitle = computed(() => (appShellStore.leftSidebarVisible ? "关闭线程面板" : "打开线程面板"));
const filesPaneTitle = computed(() => {
  if (!hasWorkspace.value) return "先选择工作区后再打开文件面板";
  if (appShellStore.settingsOpen) return "设置页中暂不显示文件面板";
  return filesPaneVisible.value ? "关闭文件面板" : "打开文件面板";
});

const connectionText = computed(() => {
  if (appShellStore.serverConnState === "connected") return "已连接";
  if (appShellStore.serverConnState === "connecting") return "连接中";
  if (appShellStore.serverConnState === "failed") return "连接失败";
  return "未连接";
});
const connectionClass = computed(() => `is-${appShellStore.serverConnState}`);

function toggleApprovalMenu() {
  approvalMenuOpen.value = !approvalMenuOpen.value;
}

function closeApprovalMenu() {
  approvalMenuOpen.value = false;
}

function onToggleThreadPane() {
  appShellStore.toggleLeftSidebarVisible();
}

async function onToggleFilesPane() {
  if (!hasWorkspace.value || appShellStore.settingsOpen) return;
  if (filesPaneVisible.value) {
    const confirmed = await workspaceFilesStore.prepareToHidePane();
    if (!confirmed) return;
    appShellStore.setFilesSidebarVisible(false);
    return;
  }
  appShellStore.setFilesSidebarVisible(true);
}

function onOpenSettings() {
  appShellStore.openSettings("global");
}
</script>

<style scoped>
.topbar-right-stack {
  justify-self: end;
  display: inline-flex;
  align-items: center;
}

.topbar-controls--sleek {
  gap: 6px;
}

.topbar-mainview-switch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--topbar-control-border, var(--topbar-border));
  border-radius: 8px;
  background: var(--topbar-control-bg, var(--topbar-bg));
  -webkit-app-region: no-drag;
}

.topbar-mainview-btn {
  min-width: 62px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 12px;
  line-height: 1;
  padding: 0 10px;
}

.topbar-mainview-btn.is-active {
  border-color: color-mix(in srgb, var(--accent) 38%, var(--topbar-border) 62%);
  background: color-mix(in srgb, var(--topbar-active-bg, var(--accent)) 72%, transparent);
}

.topbar-connection {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 26px;
  padding: 0 8px;
  color: var(--text-muted);
  font-size: 12px;
  -webkit-app-region: no-drag;
}

.topbar-connection__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--text-muted);
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 12%, transparent);
}

.topbar-connection.is-connected .topbar-connection__dot {
  color: var(--success);
  background: var(--success);
}

.topbar-connection.is-connecting .topbar-connection__dot {
  color: var(--warning);
  background: var(--warning);
}

.topbar-connection.is-failed .topbar-connection__dot,
.topbar-connection.is-disconnected .topbar-connection__dot {
  color: var(--danger);
  background: var(--danger);
}

.topbar-control-divider {
  width: 1px;
  height: 18px;
  background: color-mix(in srgb, var(--topbar-border) 78%, transparent);
}
</style>
