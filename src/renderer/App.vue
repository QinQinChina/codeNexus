<template>
  <div class="app-shell">
    <TopBar key="topbar" />
    <main ref="mainRef" class="main" :class="mainClass" :style="mainStyle">
      <LeftSidebar v-if="showLeftSidebar" class="tasks-pane-host" />

      <SettingsPage v-if="settingsOpen" key="settings" id="center-content" />
      <ImageWorkbench v-else-if="mainView === 'image'" key="image" id="center-content" />
      <CenterPane v-else key="chat" />
      <div
        v-if="!settingsOpen && showEditorPane"
        class="center-workbench-sash"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整文件编辑器宽度"
        :aria-valuenow="String(Math.round(effectiveEditorWidthPx))"
        tabindex="0"
        @pointerdown="onEditorSashPointerDown"
        @keydown="onEditorSashKeydown"
      ></div>
      <WorkspaceEditorPane
        v-if="!settingsOpen && showEditorPane"
        class="workspace-editor-pane-host"
        :class="{ 'is-compact': isEditorCompact }"
      />
      <Transition name="side-pane-switch" mode="out-in">
        <DebugTimelineSidebar v-if="showDebugSidebar" key="debug" class="files-pane-host" />
        <ImageSettingsSidebar v-else-if="showImageSettingsSidebar" key="image-settings" class="files-pane-host" />
        <WorkspaceFilesSidebar v-else-if="showFilesSidebar" key="files" class="files-pane-host" />
      </Transition>

      <div
        v-if="!settingsOpen && showLeftSidebar"
        class="sash sash-left"
        :class="{ 'is-collapsed': isLeftSashCollapsed }"
        role="separator"
        aria-orientation="vertical"
        :aria-label="leftSashAriaLabel"
        :aria-valuenow="String(Math.round(effectiveLeftSidebarWidthPx))"
        tabindex="0"
        :style="leftSashStyle"
        @pointerdown="onLeftSashPointerDown"
        @keydown="onLeftSashKeyDown"
      ></div>
    </main>
    <BottomBar />
    <div class="app-overlays">
      <AppClosingOverlay v-if="showAppClosingOverlay" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import TopBar from "./components/layout/TopBar.vue";
import CenterPane from "./components/layout/CenterPane.vue";
import BottomBar from "./components/layout/BottomBar.vue";
import {
  AppClosingOverlay,
  DebugTimelineSidebar,
  ImageWorkbench,
  ImageSettingsSidebar,
  LeftSidebar,
  SettingsPage,
  WorkspaceEditorPane,
  WorkspaceFilesSidebar,
} from "./components/asyncViews";
import { codexDesktop } from "./api/codexDesktopClient";
import { useAppClosingStore } from "./stores/appClosing.store";
import { useAppShellStore } from "./stores/appShell.store";
import { useNotificationSoundStore } from "./stores/notificationSound.store";
import { useRuntimeStore } from "./stores/runtime.store";
import { useModelCatalogStore } from "./stores/modelCatalog.store";
import { useRemoteSyncStore } from "./stores/remoteSync.store";
import { useWorkspaceFilesStore } from "./stores/workspaceFiles.store";
import type { AppWindowState } from "../shared/ipc/contracts";
import {
  CENTER_BASE_MIN_WIDTH_PX,
  CENTER_EDITOR_HARD_MIN_WIDTH_PX,
  CENTER_EDITOR_SASH_WIDTH_PX,
  CENTER_EDITOR_SOFT_MIN_WIDTH_PX,
  CENTER_WITH_EDITOR_HARD_MIN_WIDTH_PX,
  CENTER_TIMELINE_HARD_MIN_WIDTH_PX,
  SIDEBAR_HARD_MIN_WIDTH_PX,
  resolveCenterWidths,
  resolveShellWidths,
} from "./domain/layoutWidthBudget";

const appShellStore = useAppShellStore();
const appClosingStore = useAppClosingStore();
const runtimeStore = useRuntimeStore();
const notificationSoundStore = useNotificationSoundStore();
const modelCatalogStore = useModelCatalogStore();
const remoteSyncStore = useRemoteSyncStore();
const workspaceFilesStore = useWorkspaceFilesStore();
appShellStore.initLocalSettings();
runtimeStore.initLocalDraftState();
notificationSoundStore.initLocalSettings();
modelCatalogStore.initLocalSettings();
appClosingStore.initBridge();
void notificationSoundStore.refreshAvailable();
void remoteSyncStore.initBridge();

const settingsOpen = computed(() => appShellStore.settingsOpen);
const showAppClosingOverlay = computed(() => appClosingStore.visible);
const mainView = computed(() => appShellStore.mainView);
const showLeftSidebar = computed(() => !settingsOpen.value && appShellStore.leftSidebarVisible);
const showDebugSidebar = computed(
  () => !settingsOpen.value && mainView.value === "chat" && runtimeStore.timelineDebugEnabled
);
const showImageSettingsSidebar = computed(() => !settingsOpen.value && mainView.value === "image");
const showFilesSidebar = computed(() => {
  return (
    !settingsOpen.value &&
    mainView.value === "chat" &&
    Boolean(String(runtimeStore.workspacePath ?? "").trim()) &&
    appShellStore.filesSidebarVisible &&
    !showDebugSidebar.value
  );
});

let stopWindowStateListener: (() => void) | null = null;
const applyWindowStateToDocument = (state: AppWindowState) => {
  const windowMode = state.isFullScreen ? "fullscreen" : state.isMaximized ? "maximized" : "normal";
  try {
    document.documentElement.dataset.window = windowMode;
  } catch {}
};

onMounted(() => {
  void (async () => {
    try {
      const state = await codexDesktop.window.getState();
      applyWindowStateToDocument(state);
    } catch {}
  })();

  try {
    stopWindowStateListener = codexDesktop.window.onState((payload) => {
      applyWindowStateToDocument(payload);
    });
  } catch {}
});

watch(
  () => appClosingStore.phase,
  (phase, previousPhase) => {
    if (phase !== "preparing" || previousPhase === "preparing") return;
    appShellStore.closeOnboardingTour();
    void runtimeStore.flushPendingComposeStateSaves().catch((error) => {
      console.warn("[App] flush pending compose state saves failed", error);
    });
  }
);

const SASH_HIT_WIDTH_PX = 10;
const KEYBOARD_RESIZE_STEP_PX = 16;
const SIDEBAR_RENDER_THRESHOLD_PX = 24;
const CENTER_EDITOR_KEYBOARD_STEP_PX = 20;

const mainRef = ref<HTMLElement | null>(null);
const editorResizeState = ref<{
  startClientX: number;
  startWidthPx: number;
  previewWidthPx: number;
} | null>(null);

const leftResizeState = ref<{
  startClientX: number;
  startWidthPx: number;
  previewWidthPx: number;
} | null>(null);

const requestedLeftSidebarWidthPx = computed(() => {
  if (leftResizeState.value) return leftResizeState.value.previewWidthPx;
  return appShellStore.leftSidebarWidthPx;
});

const requestedFilesSidebarWidthPx = computed(() => {
  return appShellStore.filesSidebarWidthPx;
});

const showEditorPane = computed(
  () => !settingsOpen.value && mainView.value === "chat" && workspaceFilesStore.hasOpenTabs
);

const centerHardMinWidthPx = computed(() => {
  return showEditorPane.value ? CENTER_WITH_EDITOR_HARD_MIN_WIDTH_PX : CENTER_BASE_MIN_WIDTH_PX;
});

const resolvedShellWidths = computed(() => {
  return resolveShellWidths({
    containerWidth: getMainWidthPx(),
    leftVisible: showLeftSidebar.value,
    filesVisible: showFilesSidebar.value || showDebugSidebar.value || showImageSettingsSidebar.value,
    rightVisible: false,
    leftPreferredWidth: requestedLeftSidebarWidthPx.value,
    filesPreferredWidth: showImageSettingsSidebar.value ? 344 : requestedFilesSidebarWidthPx.value,
    rightPreferredWidth: 0,
    centerHardMinWidth: centerHardMinWidthPx.value,
    prioritySide: "left",
  });
});

const effectiveLeftSidebarWidthPx = computed(() => {
  return resolvedShellWidths.value.leftWidth;
});

const effectiveFilesSidebarWidthPx = computed(() => {
  return resolvedShellWidths.value.filesWidth;
});

const resolvedCenterWidths = computed(() => {
  return resolveCenterWidths({
    containerWidth: resolvedShellWidths.value.centerWidth,
    editorVisible: showEditorPane.value,
    editorPreferredWidth: editorResizeState.value?.previewWidthPx ?? appShellStore.centerEditorWidthPx,
  });
});

const effectiveEditorWidthPx = computed(() => {
  return resolvedCenterWidths.value.editorWidth;
});

const isLeftSashCollapsed = computed(() => {
  return effectiveLeftSidebarWidthPx.value < SIDEBAR_RENDER_THRESHOLD_PX;
});

const isEditorCompact = computed(() => {
  return showEditorPane.value && effectiveEditorWidthPx.value < CENTER_EDITOR_SOFT_MIN_WIDTH_PX;
});

watch(
  showEditorPane,
  (visible) => {
    if (visible) return;
    editorResizeState.value = null;
    teardownEditorResizeListeners();
  },
  { flush: "post" }
);

const leftSashAriaLabel = computed(() => {
  return isLeftSashCollapsed.value ? "从左侧边缘拉出导航面板" : "调整左侧导航面板宽度";
});

const mainClass = computed(() => ({
  "has-editor": !settingsOpen.value && showEditorPane.value,
  "has-files-sidebar": showFilesSidebar.value || showDebugSidebar.value || showImageSettingsSidebar.value,
  "has-image-sidebar": showImageSettingsSidebar.value,
  "has-settings": settingsOpen.value,
}));

const mainStyle = computed(
  () =>
    ({
      "--left-sidebar-w": `${Math.max(0, Math.round(effectiveLeftSidebarWidthPx.value))}px`,
      "--files-sidebar-w": `${Math.max(0, Math.round(effectiveFilesSidebarWidthPx.value))}px`,
      "--center-editor-w": `${Math.max(0, Math.round(effectiveEditorWidthPx.value))}px`,
      "--sash-hit-w": `${SASH_HIT_WIDTH_PX}px`,
      "--center-editor-sash-w": `${CENTER_EDITOR_SASH_WIDTH_PX}px`,
    }) as Record<string, string>
);

const leftSashStyle = computed(
  () =>
    ({
      left: `${isLeftSashCollapsed.value ? 0 : Math.max(0, Math.round(effectiveLeftSidebarWidthPx.value))}px`,
    }) as Record<string, string>
);

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const getMainWidthPx = () => mainRef.value?.getBoundingClientRect().width ?? window.innerWidth;

const clampEditorPreferredWidthPx = (value: number) => {
  const totalWidth = resolvedShellWidths.value.centerWidth;
  const maxWidth = Math.max(
    CENTER_EDITOR_HARD_MIN_WIDTH_PX,
    totalWidth - CENTER_EDITOR_SASH_WIDTH_PX - CENTER_TIMELINE_HARD_MIN_WIDTH_PX
  );
  return Math.max(CENTER_EDITOR_HARD_MIN_WIDTH_PX, Math.min(Math.round(value), maxWidth));
};

const setEditorResizeGlobalStyles = (enabled: boolean) => {
  try {
    document.body.style.cursor = enabled ? "col-resize" : "";
    document.body.style.userSelect = enabled ? "none" : "";
    document.body.classList.toggle("is-resizing", enabled);
  } catch {}
};

const teardownEditorResizeListeners = () => {
  window.removeEventListener("pointermove", onEditorSashPointerMove);
  window.removeEventListener("pointerup", onEditorSashPointerUp);
  window.removeEventListener("pointercancel", onEditorSashPointerUp);
  setEditorResizeGlobalStyles(false);
};

const normalizeVisibleSidebarPreviewWidthPx = (rawNext: number, maxWidthPx: number) => {
  const rounded = Math.round(rawNext);
  if (maxWidthPx < SIDEBAR_HARD_MIN_WIDTH_PX) return SIDEBAR_HARD_MIN_WIDTH_PX;
  return clamp(rounded, SIDEBAR_HARD_MIN_WIDTH_PX, maxWidthPx);
};

const getMaxLeftSidebarWidthPx = () => {
  const mainWidth = getMainWidthPx();
  const rightWidth = showImageSettingsSidebar.value ? 344 : requestedFilesSidebarWidthPx.value;
  const reservedWidth =
    centerHardMinWidthPx.value +
    (showFilesSidebar.value || showDebugSidebar.value || showImageSettingsSidebar.value ? rightWidth : 0);
  const max = mainWidth - reservedWidth;
  return Math.max(0, Math.floor(max));
};

const setResizeGlobalStyles = (enabled: boolean) => {
  try {
    document.body.style.cursor = enabled ? "col-resize" : "";
    document.body.style.userSelect = enabled ? "none" : "";
    document.body.classList.toggle("is-resizing", enabled);
  } catch {}
};

const teardownResizeListeners = () => {
  window.removeEventListener("pointermove", onLeftSashPointerMove);
  window.removeEventListener("pointerup", onLeftSashPointerUp);
  window.removeEventListener("pointercancel", onLeftSashPointerUp);
  setResizeGlobalStyles(false);
};

const onLeftSashPointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return;

  const startWidthPx = effectiveLeftSidebarWidthPx.value;
  leftResizeState.value = { startClientX: event.clientX, startWidthPx, previewWidthPx: startWidthPx };

  setResizeGlobalStyles(true);
  try {
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  } catch {}

  window.addEventListener("pointermove", onLeftSashPointerMove);
  window.addEventListener("pointerup", onLeftSashPointerUp);
  window.addEventListener("pointercancel", onLeftSashPointerUp);
  event.preventDefault();
};

const onLeftSashPointerMove = (event: PointerEvent) => {
  const state = leftResizeState.value;
  if (!state) return;
  const deltaX = event.clientX - state.startClientX;
  const rawNext = state.startWidthPx + deltaX;
  const max = getMaxLeftSidebarWidthPx();
  state.previewWidthPx = normalizeVisibleSidebarPreviewWidthPx(rawNext, max);
};

const commitLeftSidebarWidth = (widthPx: number) => {
  const rounded = Math.max(0, Math.round(widthPx));
  const nextWidth = Math.max(SIDEBAR_HARD_MIN_WIDTH_PX, rounded);
  appShellStore.setLeftSidebarWidthPx(nextWidth, { save: true });
};

const onLeftSashPointerUp = () => {
  const state = leftResizeState.value;
  leftResizeState.value = null;
  teardownResizeListeners();
  if (!state) return;
  commitLeftSidebarWidth(state.previewWidthPx);
};

const onLeftSashKeyDown = (event: KeyboardEvent) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const dir = event.key === "ArrowRight" ? 1 : -1;
  const max = getMaxLeftSidebarWidthPx();
  const next = clamp(effectiveLeftSidebarWidthPx.value + dir * KEYBOARD_RESIZE_STEP_PX, SIDEBAR_HARD_MIN_WIDTH_PX, max);
  commitLeftSidebarWidth(next);
  event.preventDefault();
};

const onEditorSashPointerDown = (event: PointerEvent) => {
  if (!showEditorPane.value || event.button !== 0) return;
  editorResizeState.value = {
    startClientX: event.clientX,
    startWidthPx: effectiveEditorWidthPx.value,
    previewWidthPx: effectiveEditorWidthPx.value,
  };

  setEditorResizeGlobalStyles(true);
  try {
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  } catch {}

  window.addEventListener("pointermove", onEditorSashPointerMove);
  window.addEventListener("pointerup", onEditorSashPointerUp);
  window.addEventListener("pointercancel", onEditorSashPointerUp);
  event.preventDefault();
};

const onEditorSashPointerMove = (event: PointerEvent) => {
  const state = editorResizeState.value;
  if (!state) return;
  const deltaX = state.startClientX - event.clientX;
  state.previewWidthPx = clampEditorPreferredWidthPx(state.startWidthPx + deltaX);
};

const onEditorSashPointerUp = () => {
  const state = editorResizeState.value;
  editorResizeState.value = null;
  teardownEditorResizeListeners();
  if (!state) return;
  appShellStore.setCenterEditorWidthPx(clampEditorPreferredWidthPx(state.previewWidthPx), { save: true });
};

const onEditorSashKeydown = (event: KeyboardEvent) => {
  if (!showEditorPane.value) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const delta = event.key === "ArrowLeft" ? CENTER_EDITOR_KEYBOARD_STEP_PX : -CENTER_EDITOR_KEYBOARD_STEP_PX;
  appShellStore.setCenterEditorWidthPx(clampEditorPreferredWidthPx(effectiveEditorWidthPx.value + delta), {
    save: true,
  });
  event.preventDefault();
};

onBeforeUnmount(() => {
  try {
    stopWindowStateListener?.();
  } catch {}
  stopWindowStateListener = null;

  teardownResizeListeners();
  teardownEditorResizeListeners();
});
</script>
