<template>
  <div class="topbar-wrap">
    <header class="topbar">
      <div class="topbar-left row">
        <TopBarWorkspaceButton />
        <div class="topbar-menu-anchor topbar-menu-anchor--approval">
          <TopBarApprovalMenu :open="approvalMenuOpen" @toggle="toggleApprovalMenu" @close="closeApprovalMenu" />
        </div>
        <div class="topbar-mainview-switch" aria-label="主视图">
          <button
            class="topbar-mainview-btn"
            :class="{ 'is-active': appShellStore.mainView === 'chat' }"
            type="button"
            title="聊天"
            aria-label="聊天"
            @click="onSetMainView('chat')"
          >
            <MessageSquare class="topbar-mainview-icon" aria-hidden="true" />
            <span>聊天</span>
          </button>
          <button
            class="topbar-mainview-btn"
            :class="{ 'is-active': appShellStore.mainView === 'image' }"
            type="button"
            title="图片"
            aria-label="图片"
            @click="onSetMainView('image')"
          >
            <ImageIcon class="topbar-mainview-icon" aria-hidden="true" />
            <span>图片</span>
          </button>
        </div>
      </div>

      <TopBarPlanSummary />

      <div class="topbar-right-stack">
        <div class="row topbar-controls topbar-controls--sleek">
          <div class="control-group control-group-panes" aria-label="面板">
            <button
              id="btn-toggle-thread-pane"
              class="btn-icon"
              :class="{ 'is-active': appShellStore.leftSidebarVisible }"
              type="button"
              :disabled="appShellStore.settingsOpen"
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
import {
  Image as ImageIcon,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Settings,
} from "lucide-vue-next";
import TopBarWorkspaceButton from "./topbar/TopBarWorkspaceButton.vue";
import TopBarPlanSummary from "./topbar/TopBarPlanSummary.vue";
import TopBarThemeSwitch from "./topbar/TopBarThemeSwitch.vue";
import TopBarWindowControls from "./topbar/TopBarWindowControls.vue";
import { useAppShellStore } from "../../stores/appShell.store";
import { useRuntimeStore } from "../../stores/runtime.store";
import { useWorkspaceFilesStore } from "../../stores/workspaceFiles.store";
import "./topbar/topbar.css";
import type { MainView } from "../../../shared/localSettings";

const TopBarApprovalMenu = defineAsyncComponent(() => import("./topbar/TopBarApprovalMenu.vue"));

const appShellStore = useAppShellStore();
const runtimeStore = useRuntimeStore();
const workspaceFilesStore = useWorkspaceFilesStore();
const approvalMenuOpen = ref(false);

const hasWorkspace = computed(() => Boolean(String(runtimeStore.workspacePath ?? "").trim()));
const filesPaneVisible = computed(
  () =>
    hasWorkspace.value &&
    !appShellStore.settingsOpen &&
    appShellStore.mainView === "chat" &&
    appShellStore.filesSidebarVisible
);
const threadPaneTitle = computed(() => {
  if (appShellStore.settingsOpen) return "设置页中暂不显示线程面板";
  return appShellStore.leftSidebarVisible ? "关闭线程面板" : "打开线程面板";
});
const filesPaneTitle = computed(() => {
  if (!hasWorkspace.value) return "先选择工作区后再打开文件面板";
  if (appShellStore.settingsOpen) return "设置页中暂不显示文件面板";
  if (appShellStore.mainView !== "chat") return "图片视图中暂不显示文件面板";
  return filesPaneVisible.value ? "关闭文件面板" : "打开文件面板";
});

function toggleApprovalMenu() {
  approvalMenuOpen.value = !approvalMenuOpen.value;
}

function closeApprovalMenu() {
  approvalMenuOpen.value = false;
}

function onSetMainView(next: MainView) {
  if (next === "image") {
    appShellStore.openImageWorkbench();
    return;
  }
  appShellStore.setMainView(next);
  if (appShellStore.settingsOpen) appShellStore.closeSettings();
}

function onToggleThreadPane() {
  if (appShellStore.settingsOpen) return;
  appShellStore.toggleLeftSidebarVisible();
}

async function onToggleFilesPane() {
  if (!hasWorkspace.value || appShellStore.settingsOpen || appShellStore.mainView !== "chat") return;
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
