import { defineAsyncComponent } from "vue";

export const DebugTimelineSidebar = defineAsyncComponent(
  () => import("./layout/DebugTimelineSidebar.vue")
);
export const AppClosingOverlay = defineAsyncComponent(
  () => import("./layout/AppClosingOverlay.vue")
);
export const LeftSidebar = defineAsyncComponent(() => import("./layout/LeftSidebar.vue"));
export const SettingsPage = defineAsyncComponent(() => import("./layout/SettingsPage.vue"));
export const WorkspaceEditorPane = defineAsyncComponent(() => import("./layout/WorkspaceEditorPane.vue"));
export const WorkspaceFilesSidebar = defineAsyncComponent(
  () => import("./layout/WorkspaceFilesSidebar.vue")
);
export const ComposerQueueList = defineAsyncComponent(() => import("./layout/ComposerQueueList.vue"));
export const ComposerSlashCommandList = defineAsyncComponent(
  () => import("./layout/ComposerSlashCommandList.vue")
);
export const PlanSummaryPanel = defineAsyncComponent(() => import("./layout/PlanSummaryPanel.vue"));
export const SkillsManagerOverlay = defineAsyncComponent(
  () => import("./layout/SkillsManagerOverlay.vue")
);
export const ChatPane = defineAsyncComponent(() => import("./layout/ChatPane.vue"));
