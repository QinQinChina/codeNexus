import { defineAsyncComponent } from "vue";

export const DebugTimelineSidebar = defineAsyncComponent(() => import("./layout/debug/DebugTimelineSidebar.vue"));
export const AppClosingOverlay = defineAsyncComponent(() => import("./layout/overlays/AppClosingOverlay.vue"));
export const GoalShutdownCountdownOverlay = defineAsyncComponent(
  () => import("./layout/overlays/GoalShutdownCountdownOverlay.vue")
);
export const LeftSidebar = defineAsyncComponent(() => import("./layout/LeftSidebar.vue"));
export const ImageWorkbench = defineAsyncComponent(
  () => import("@codenexus/feature-imagegen/renderer/components/ImageWorkbench")
);
export const FlowchartWorkbench = defineAsyncComponent(
  () => import("@codenexus/feature-flowchart/renderer/components/FlowchartWorkbench")
);
export const PaperWorkbench = defineAsyncComponent(() => import("@codenexus/feature-paper/components/PaperWorkbench"));
export const ImageWorkspaceSidebar = defineAsyncComponent(
  () => import("@codenexus/feature-imagegen/renderer/components/ImageWorkspaceSidebar")
);
export const ImageSettingsSidebar = defineAsyncComponent(
  () => import("@codenexus/feature-imagegen/renderer/components/ImageSettingsSidebar")
);
export const PaperWorkspaceSidebar = defineAsyncComponent(
  () => import("@codenexus/feature-paper/components/PaperWorkspaceSidebar")
);
export const PaperSettingsSidebar = defineAsyncComponent(
  () => import("@codenexus/feature-paper/components/PaperSettingsSidebar")
);
export const SettingsPage = defineAsyncComponent(() => import("./layout/SettingsPage.vue"));
export const WorkspaceEditorPane = defineAsyncComponent(() => import("./layout/workspace/WorkspaceEditorPane.vue"));
export const WorkspaceFilesSidebar = defineAsyncComponent(() => import("./layout/workspace/WorkspaceFilesSidebar.vue"));
export const ComposerQueueList = defineAsyncComponent(() => import("./layout/composer/ComposerQueueList.vue"));
export const ComposerSlashCommandList = defineAsyncComponent(
  () => import("./layout/composer/ComposerSlashCommandList.vue")
);
export const SkillsManagerOverlay = defineAsyncComponent(() => import("./layout/skills/SkillsManagerOverlay.vue"));
export const ChatPane = defineAsyncComponent(() => import("./layout/chat/ChatPane.vue"));
