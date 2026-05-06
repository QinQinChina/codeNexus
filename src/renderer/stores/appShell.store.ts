// UI 壳层 Store：管理侧栏开合、布局偏好等应用外壳状态。
import { defineStore } from "pinia";
import type { ServerConnState } from "../domain/types";
import { getCachedUserLocalSettings, patchUserLocalSettings } from "../domain/localSettings";
import {
  DEFAULT_UI_WORKSPACE_FILE_ICON_THEME,
  normalizeUiWorkspaceFileIconTheme,
  type AssistantFinalMessageFormat,
  type AssistantPlanMessageFormat,
  type UiWorkspaceFileIconTheme,
  type MainView,
} from "../../shared/localSettings";

export type IntegrationsDrawerTab = "skills" | "mcp";
export type SettingsTab = "global" | "sound" | "env" | "integrations" | "remote" | "update";
export type SettingsIntegrationsTab = "skills" | "mcp";

const DEFAULT_LEFT_SIDEBAR_WIDTH_PX = 320;
const DEFAULT_FILES_SIDEBAR_WIDTH_PX = 300;
const DEFAULT_CENTER_EDITOR_WIDTH_PX = 460;
export const MIN_SIDEBAR_WIDTH_PX = 240;
export const MIN_CENTER_EDITOR_WIDTH_PX = 320;
const DEFAULT_MAIN_VIEW: MainView = "chat";
const DEFAULT_ASSISTANT_FINAL_MESSAGE_FORMAT: AssistantFinalMessageFormat = "markdown";
const DEFAULT_ASSISTANT_PLAN_MESSAGE_FORMAT: AssistantPlanMessageFormat = "markdown";

function clampSidebarWidthPx(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(MIN_SIDEBAR_WIDTH_PX, Math.round(n));
}

function clampCenterEditorWidthPx(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(MIN_CENTER_EDITOR_WIDTH_PX, Math.round(n));
}

function normalizeThreadWorkspaceGroupKey(value: unknown): string {
  return String(value ?? "").trim();
}

function cloneThreadWorkspaceGroupsCollapsedState(value: unknown): Record<string, boolean> {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const next: Record<string, boolean> = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = normalizeThreadWorkspaceGroupKey(rawKey);
    if (!key || rawValue !== true) continue;
    next[key] = true;
  }
  return next;
}

export const useAppShellStore = defineStore("appShell", {
  state: () => ({
    serverConnState: "disconnected" as ServerConnState,
    serverError: "" as string,
    mainView: DEFAULT_MAIN_VIEW as MainView,
    globalConfigDrawerOpen: false,
    envSetupDrawerOpen: false,
    integrationsDrawerOpen: false,
    integrationsDrawerTab: "skills" as IntegrationsDrawerTab,
    updateDrawerOpen: false,

    settingsOpen: false,
    settingsActiveTab: "global" as SettingsTab,
    settingsIntegrationsTab: "skills" as SettingsIntegrationsTab,
    leftSidebarVisible: true,
    leftSidebarWidthPx: DEFAULT_LEFT_SIDEBAR_WIDTH_PX,
    filesSidebarVisible: true,
    filesSidebarWidthPx: DEFAULT_FILES_SIDEBAR_WIDTH_PX,
    centerEditorWidthPx: DEFAULT_CENTER_EDITOR_WIDTH_PX,
    workspaceFileIconTheme: DEFAULT_UI_WORKSPACE_FILE_ICON_THEME as UiWorkspaceFileIconTheme,
    assistantFinalMessageFormat: DEFAULT_ASSISTANT_FINAL_MESSAGE_FORMAT as AssistantFinalMessageFormat,
    assistantPlanMessageFormat: DEFAULT_ASSISTANT_PLAN_MESSAGE_FORMAT as AssistantPlanMessageFormat,
    threadWorkspaceGroupsCollapsed: {} as Record<string, boolean>,
  }),
  actions: {
    // 统一维护服务连接状态与错误文案。
    setServerConnState(next: ServerConnState, error = "") {
      this.serverConnState = next;
      this.serverError = error;
    },
    // 从本地缓存恢复布局偏好。
    initLocalSettings() {
      const cached = getCachedUserLocalSettings();
      this.mainView = cached.settings.ui.mainView;
      this.assistantFinalMessageFormat = cached.settings.ui.assistantFinalMessageFormat;
      this.assistantPlanMessageFormat = cached.settings.ui.assistantPlanMessageFormat;
      this.workspaceFileIconTheme = normalizeUiWorkspaceFileIconTheme(cached.settings.ui.workspaceFileIconTheme);
      this.leftSidebarVisible = cached.settings.ui.leftSidebarVisible;
      this.leftSidebarWidthPx = clampSidebarWidthPx(
        cached.settings.ui.leftSidebarWidthPx,
        DEFAULT_LEFT_SIDEBAR_WIDTH_PX
      );
      this.filesSidebarVisible = cached.settings.ui.filesSidebarVisible;
      this.filesSidebarWidthPx = clampSidebarWidthPx(
        cached.settings.ui.filesSidebarWidthPx,
        DEFAULT_FILES_SIDEBAR_WIDTH_PX
      );
      this.centerEditorWidthPx = clampCenterEditorWidthPx(
        cached.settings.ui.centerEditorWidthPx,
        DEFAULT_CENTER_EDITOR_WIDTH_PX
      );
      this.threadWorkspaceGroupsCollapsed = cloneThreadWorkspaceGroupsCollapsedState(
        cached.settings.ui.threadWorkspaceGroupsCollapsed
      );
      if (!cached.exists) {
        void patchUserLocalSettings({
          ui: {
            mainView: this.mainView,
            leftSidebarVisible: this.leftSidebarVisible,
            leftSidebarWidthPx: this.leftSidebarWidthPx,
            filesSidebarVisible: this.filesSidebarVisible,
            filesSidebarWidthPx: this.filesSidebarWidthPx,
            centerEditorWidthPx: this.centerEditorWidthPx,
            workspaceFileIconTheme: this.workspaceFileIconTheme,
            assistantFinalMessageFormat: this.assistantFinalMessageFormat,
            assistantPlanMessageFormat: this.assistantPlanMessageFormat,
            threadWorkspaceGroupsCollapsed: { ...this.threadWorkspaceGroupsCollapsed },
          },
        });
      }
    },
    setMainView(next: MainView, opts?: { save?: boolean }) {
      const shouldSave = opts?.save ?? true;
      const normalized: MainView = "chat";
      this.mainView = normalized;
      if (!shouldSave) return;
      void patchUserLocalSettings({ ui: { mainView: normalized } });
    },
    setAssistantFinalMessageFormat(next: AssistantFinalMessageFormat, opts?: { save?: boolean }) {
      const shouldSave = opts?.save ?? true;
      const normalized: AssistantFinalMessageFormat = next === "structured-json-v1" ? "structured-json-v1" : "markdown";
      this.assistantFinalMessageFormat = normalized;
      if (!shouldSave) return;
      void patchUserLocalSettings({ ui: { assistantFinalMessageFormat: normalized } });
    },
    setAssistantPlanMessageFormat(next: AssistantPlanMessageFormat, opts?: { save?: boolean }) {
      const shouldSave = opts?.save ?? true;
      const normalized: AssistantPlanMessageFormat = next === "plan-card-v1" ? "plan-card-v1" : "markdown";
      this.assistantPlanMessageFormat = normalized;
      if (!shouldSave) return;
      void patchUserLocalSettings({ ui: { assistantPlanMessageFormat: normalized } });
    },
    setWorkspaceFileIconTheme(next: unknown, opts?: { save?: boolean }) {
      const shouldSave = opts?.save ?? true;
      const normalized = normalizeUiWorkspaceFileIconTheme(next);
      this.workspaceFileIconTheme = normalized;
      if (!shouldSave) return;
      void patchUserLocalSettings({ ui: { workspaceFileIconTheme: normalized } });
    },
    setGlobalConfigDrawerOpen(next: boolean) {
      this.globalConfigDrawerOpen = Boolean(next);
    },
    toggleGlobalConfigDrawerOpen() {
      this.setGlobalConfigDrawerOpen(!this.globalConfigDrawerOpen);
    },
    openSettings(tab?: SettingsTab, opts?: { integrationsTab?: SettingsIntegrationsTab }) {
      if (tab) this.settingsActiveTab = tab;
      if (opts?.integrationsTab) this.settingsIntegrationsTab = opts.integrationsTab;
      this.settingsOpen = true;
      // 进入设置页后，关闭旧的抽屉状态，避免出现“状态为 open 但 UI 不显示”的混乱。
      this.globalConfigDrawerOpen = false;
      this.envSetupDrawerOpen = false;
      this.integrationsDrawerOpen = false;
      this.updateDrawerOpen = false;
    },
    closeSettings() {
      this.settingsOpen = false;
    },
    setSettingsTab(tab: SettingsTab) {
      this.settingsActiveTab = tab;
    },
    setSettingsIntegrationsTab(tab: SettingsIntegrationsTab) {
      this.settingsIntegrationsTab = tab;
    },
    setEnvSetupDrawerOpen(next: boolean) {
      this.envSetupDrawerOpen = Boolean(next);
    },
    toggleEnvSetupDrawerOpen() {
      this.setEnvSetupDrawerOpen(!this.envSetupDrawerOpen);
    },
    setIntegrationsDrawerTab(next: IntegrationsDrawerTab) {
      this.integrationsDrawerTab = next === "mcp" ? "mcp" : "skills";
    },
    openIntegrationsDrawer(tab?: IntegrationsDrawerTab) {
      if (tab) this.setIntegrationsDrawerTab(tab);
      this.integrationsDrawerOpen = true;
    },
    setIntegrationsDrawerOpen(next: boolean, opts?: { tab?: IntegrationsDrawerTab }) {
      if (next && opts?.tab) this.setIntegrationsDrawerTab(opts.tab);
      this.integrationsDrawerOpen = Boolean(next);
    },
    toggleIntegrationsDrawerOpen(tab?: IntegrationsDrawerTab) {
      if (this.integrationsDrawerOpen) {
        this.setIntegrationsDrawerOpen(false);
        return;
      }
      this.openIntegrationsDrawer(tab);
    },
    setUpdateDrawerOpen(next: boolean) {
      this.updateDrawerOpen = Boolean(next);
    },
    toggleUpdateDrawerOpen() {
      this.setUpdateDrawerOpen(!this.updateDrawerOpen);
    },
    setLeftSidebarWidthPx(next: number, opts?: { save?: boolean }) {
      const shouldSave = opts?.save ?? true;
      const clamped = clampSidebarWidthPx(next, DEFAULT_LEFT_SIDEBAR_WIDTH_PX);
      this.leftSidebarWidthPx = clamped;
      if (!shouldSave) return;
      void patchUserLocalSettings({ ui: { leftSidebarWidthPx: clamped } });
    },
    setLeftSidebarVisible(next: boolean, opts?: { save?: boolean }) {
      const shouldSave = opts?.save ?? true;
      const normalized = Boolean(next);
      this.leftSidebarVisible = normalized;
      if (!shouldSave) return;
      void patchUserLocalSettings({ ui: { leftSidebarVisible: normalized } });
    },
    toggleLeftSidebarVisible(opts?: { save?: boolean }) {
      this.setLeftSidebarVisible(!this.leftSidebarVisible, opts);
    },
    setFilesSidebarVisible(next: boolean, opts?: { save?: boolean }) {
      const shouldSave = opts?.save ?? true;
      const normalized = Boolean(next);
      this.filesSidebarVisible = normalized;
      if (!shouldSave) return;
      void patchUserLocalSettings({ ui: { filesSidebarVisible: normalized } });
    },
    toggleFilesSidebarVisible(opts?: { save?: boolean }) {
      this.setFilesSidebarVisible(!this.filesSidebarVisible, opts);
    },
    setFilesSidebarWidthPx(next: number, opts?: { save?: boolean }) {
      const shouldSave = opts?.save ?? true;
      const clamped = clampSidebarWidthPx(next, DEFAULT_FILES_SIDEBAR_WIDTH_PX);
      this.filesSidebarWidthPx = clamped;
      if (!shouldSave) return;
      void patchUserLocalSettings({ ui: { filesSidebarWidthPx: clamped } });
    },
    setCenterEditorWidthPx(next: number, opts?: { save?: boolean }) {
      const shouldSave = opts?.save ?? true;
      const clamped = clampCenterEditorWidthPx(next, DEFAULT_CENTER_EDITOR_WIDTH_PX);
      this.centerEditorWidthPx = clamped;
      if (!shouldSave) return;
      void patchUserLocalSettings({ ui: { centerEditorWidthPx: clamped } });
    },
    isThreadWorkspaceGroupCollapsed(groupKeyValue: string): boolean {
      const key = normalizeThreadWorkspaceGroupKey(groupKeyValue);
      return Boolean(key && this.threadWorkspaceGroupsCollapsed[key]);
    },
    setThreadWorkspaceGroupCollapsed(groupKeyValue: string, collapsed: boolean, opts?: { save?: boolean }) {
      const key = normalizeThreadWorkspaceGroupKey(groupKeyValue);
      if (!key) return;
      const shouldSave = opts?.save ?? true;
      const next = { ...this.threadWorkspaceGroupsCollapsed };
      if (collapsed) next[key] = true;
      else delete next[key];
      this.threadWorkspaceGroupsCollapsed = cloneThreadWorkspaceGroupsCollapsedState(next);
      if (!shouldSave) return;
      void patchUserLocalSettings({
        ui: {
          threadWorkspaceGroupsCollapsed: { ...this.threadWorkspaceGroupsCollapsed },
        },
      });
    },
    toggleThreadWorkspaceGroupCollapsed(groupKeyValue: string, opts?: { save?: boolean }) {
      this.setThreadWorkspaceGroupCollapsed(groupKeyValue, !this.isThreadWorkspaceGroupCollapsed(groupKeyValue), opts);
    },
    ensureThreadWorkspaceGroupExpanded(groupKeyValue: string, opts?: { save?: boolean }) {
      if (!this.isThreadWorkspaceGroupCollapsed(groupKeyValue)) return;
      this.setThreadWorkspaceGroupCollapsed(groupKeyValue, false, opts);
    },
  },
});
