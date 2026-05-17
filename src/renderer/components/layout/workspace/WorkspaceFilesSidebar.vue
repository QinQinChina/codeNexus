<template>
  <aside class="sidebar sidebar-right workspace-files-sidebar">
    <div class="workspace-files-shell">
      <div class="workspace-files-body workspace-files-body--tree-only">
        <section class="workspace-files-section workspace-files-section--tree">
          <div
            ref="treeSurfaceRef"
            class="workspace-files-tree-surface app-scrollbar"
            role="tree"
            aria-label="工作区文件树"
          >
            <div v-if="!workspaceFilesStore.hasWorkspace" class="workspace-files-placeholder">
              先选择工作区后再浏览文件。
            </div>
            <div v-else-if="treeRows.length === 0" class="workspace-files-placeholder">工作区尚未加载。</div>
            <template v-else>
              <template v-for="row in treeRows" :key="row.key">
                <button
                  v-if="row.kind === 'entry'"
                  class="workspace-file-tree-row"
                  :class="treeRowClass(row)"
                  :style="treeRowStyle(row)"
                  type="button"
                  role="treeitem"
                  draggable="true"
                  :aria-level="row.depth + 1"
                  :aria-expanded="row.isDirectory ? String(row.isExpanded) : undefined"
                  :aria-selected="row.isActiveFile || row.isSelectedDirectory ? 'true' : 'false'"
                  :data-tree-path="row.path"
                  @click="onOpenTreeRow(row)"
                  @contextmenu="onTreeRowContextMenu(row, $event)"
                  @dragstart="onTreeRowDragStart(row, $event)"
                  @dragend="onTreeRowDragEnd"
                >
                  <ChevronRight
                    v-if="row.isDirectory"
                    class="workspace-file-tree-row__chevron"
                    :class="{ 'rotate-90': row.isExpanded }"
                    aria-hidden="true"
                  />
                  <span
                    v-else
                    class="workspace-file-tree-row__chevron workspace-file-tree-row__chevron--spacer"
                    aria-hidden="true"
                  ></span>
                  <WorkspaceTreeEntryIcon
                    :path="row.path"
                    :isDirectory="row.isDirectory"
                    :isExpanded="row.isExpanded"
                  />
                  <span class="workspace-file-tree-row__label">{{ row.label }}</span>
                  <span v-if="treeRowMetaText(row)" class="workspace-file-tree-row__meta">{{
                    treeRowMetaText(row)
                  }}</span>
                </button>

                <div
                  v-else
                  class="workspace-file-tree-message"
                  :class="{
                    'is-error': row.tone === 'error',
                    'is-dim': row.tone === 'dim',
                  }"
                  :style="treeMessageStyle(row)"
                >
                  {{ row.text }}
                </div>
              </template>
            </template>
          </div>
        </section>
      </div>
    </div>
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="workspace-file-context-menu"
        :style="contextMenuStyle"
        role="menu"
        aria-label="文件操作"
        @click.stop
        @contextmenu.prevent
      >
        <button
          class="workspace-file-context-menu__item is-danger"
          type="button"
          role="menuitem"
          :disabled="workspaceFilesStore.isFileDeleting(contextMenu.path)"
          @click="onDeleteContextFile"
        >
          <Trash2 class="workspace-file-context-menu__icon" aria-hidden="true" />
          <span>删除文件</span>
        </button>
      </div>
    </Teleport>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ChevronRight, Trash2 } from "lucide-vue-next";
import WorkspaceTreeEntryIcon from "./WorkspaceTreeEntryIcon.vue";
import { useWorkspaceFilesStore } from "../../../stores/workspaceFiles.store";
import { basenameFromPath } from "../../../domain/workspaceFiles";
import { normalizeAbsoluteFsPath } from "../../../domain/workspacePath";
import { writeWorkspaceFileDragData } from "../../../domain/workspaceFileDrag";

const workspaceFilesStore = useWorkspaceFilesStore();
const treeSurfaceRef = ref<HTMLElement | null>(null);
const draggingTreePath = ref("");
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  path: "",
});

type TreeRow =
  | {
      kind: "entry";
      key: string;
      path: string;
      label: string;
      depth: number;
      isDirectory: boolean;
      isExpanded: boolean;
      isLoading: boolean;
      isActiveFile: boolean;
      isSelectedDirectory: boolean;
    }
  | {
      kind: "message";
      key: string;
      path: string;
      depth: number;
      text: string;
      tone: "dim" | "error";
    };

const treeRows = computed<TreeRow[]>(() => {
  const workspace = normalizeAbsoluteFsPath(workspaceFilesStore.workspacePath);
  if (!workspace) return [];

  const rows: TreeRow[] = [];
  const appendDirectory = (path: string, label: string, depth: number) => {
    const normalizedPath = normalizeAbsoluteFsPath(path);
    const isExpanded = workspaceFilesStore.isDirectoryExpanded(normalizedPath);
    const isLoading = workspaceFilesStore.isDirectoryLoading(normalizedPath);
    const isSelectedDirectory = normalizeAbsoluteFsPath(workspaceFilesStore.directoryPath) === normalizedPath;
    rows.push({
      kind: "entry",
      key: `dir:${normalizedPath}`,
      path: normalizedPath,
      label,
      depth,
      isDirectory: true,
      isExpanded,
      isLoading,
      isActiveFile: false,
      isSelectedDirectory,
    });

    if (!isExpanded) return;

    const errorText = workspaceFilesStore.directoryErrorByPath(normalizedPath);
    if (errorText) {
      rows.push({
        kind: "message",
        key: `direrr:${normalizedPath}`,
        path: normalizedPath,
        depth: depth + 1,
        text: errorText,
        tone: "error",
      });
    }

    const entries = workspaceFilesStore.directoryEntriesByPath(normalizedPath);
    if (entries.length === 0 && !isLoading && !errorText) {
      rows.push({
        kind: "message",
        key: `dirempty:${normalizedPath}`,
        path: normalizedPath,
        depth: depth + 1,
        text: "空目录",
        tone: "dim",
      });
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory) {
        appendDirectory(entry.path, entry.fileName, depth + 1);
        continue;
      }
      rows.push({
        kind: "entry",
        key: `file:${entry.path}`,
        path: entry.path,
        label: entry.fileName,
        depth: depth + 1,
        isDirectory: false,
        isExpanded: false,
        isLoading: false,
        isActiveFile:
          normalizeAbsoluteFsPath(workspaceFilesStore.activeFilePath) === normalizeAbsoluteFsPath(entry.path),
        isSelectedDirectory: false,
      });
    }
  };

  appendDirectory(workspace, basenameFromPath(workspace) || workspace, 0);
  return rows;
});

const treeRowClass = (row: Extract<TreeRow, { kind: "entry" }>) => {
  return {
    "is-root": row.depth === 0,
    "is-directory": row.isDirectory,
    "is-file": !row.isDirectory,
    "is-active-file": row.isActiveFile,
    "is-selected-directory": row.isSelectedDirectory,
    "is-deleting": workspaceFilesStore.isFileDeleting(row.path),
    "is-drag-source": draggingTreePath.value === normalizeAbsoluteFsPath(row.path),
  };
};

const contextMenuStyle = computed(() => ({
  left: `${contextMenu.value.x}px`,
  top: `${contextMenu.value.y}px`,
}));

const treeRowStyle = (row: Extract<TreeRow, { kind: "entry" }>) => {
  return {
    paddingLeft: `${10 + row.depth * 14}px`,
  };
};

const treeMessageStyle = (row: Extract<TreeRow, { kind: "message" }>) => {
  return {
    paddingLeft: `${24 + row.depth * 14}px`,
  };
};

const treeRowMetaText = (row: Extract<TreeRow, { kind: "entry" }>) => {
  if (workspaceFilesStore.isFileDeleting(row.path)) return "删除中";
  if (row.isLoading) return "加载中";
  return "";
};

const onOpenTreeRow = (row: Extract<TreeRow, { kind: "entry" }>) => {
  closeContextMenu();
  if (workspaceFilesStore.isFileDeleting(row.path)) return;
  if (row.isDirectory) {
    void workspaceFilesStore.toggleDirectoryExpanded(row.path);
    return;
  }
  void workspaceFilesStore.openFile(row.path);
};

const closeContextMenu = () => {
  if (!contextMenu.value.visible) return;
  contextMenu.value = {
    visible: false,
    x: 0,
    y: 0,
    path: "",
  };
};

const onTreeRowContextMenu = (row: Extract<TreeRow, { kind: "entry" }>, event: MouseEvent) => {
  if (row.isDirectory || workspaceFilesStore.isFileDeleting(row.path)) {
    closeContextMenu();
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const menuWidth = 176;
  const menuHeight = 44;
  const viewportPadding = 8;
  contextMenu.value = {
    visible: true,
    x: Math.max(viewportPadding, Math.min(event.clientX, window.innerWidth - menuWidth - viewportPadding)),
    y: Math.max(viewportPadding, Math.min(event.clientY, window.innerHeight - menuHeight - viewportPadding)),
    path: normalizeAbsoluteFsPath(row.path),
  };
};

const onDeleteContextFile = async () => {
  const path = normalizeAbsoluteFsPath(contextMenu.value.path);
  closeContextMenu();
  if (!path) return;
  await workspaceFilesStore.deleteWorkspaceFile(path);
};

const onTreeRowDragStart = (row: Extract<TreeRow, { kind: "entry" }>, event: DragEvent) => {
  closeContextMenu();
  if (workspaceFilesStore.isFileDeleting(row.path)) {
    event.preventDefault();
    return;
  }
  draggingTreePath.value = normalizeAbsoluteFsPath(row.path);
  writeWorkspaceFileDragData(event.dataTransfer, row.path, {
    kind: row.isDirectory ? "directory" : "file",
  });
};

const onTreeRowDragEnd = () => {
  draggingTreePath.value = "";
};

function scrollActiveRowIntoView() {
  const targetPath = normalizeAbsoluteFsPath(workspaceFilesStore.activeFilePath);
  const surface = treeSurfaceRef.value;
  if (!targetPath || !surface) return;
  const row = surface.querySelector<HTMLElement>(`[data-tree-path="${CSS.escape(targetPath)}"]`);
  row?.scrollIntoView({ block: "nearest" });
}

function onWindowPointerDown(event: PointerEvent) {
  const target = event.target;
  if (target instanceof Element && target.closest(".workspace-file-context-menu")) return;
  closeContextMenu();
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") closeContextMenu();
}

onMounted(() => {
  void workspaceFilesStore.ensureReady(false);
  window.addEventListener("pointerdown", onWindowPointerDown, true);
  window.addEventListener("keydown", onWindowKeydown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", onWindowPointerDown, true);
  window.removeEventListener("keydown", onWindowKeydown, true);
});

watch(
  () => [workspaceFilesStore.activeFilePath, treeRows.value.length, workspaceFilesStore.directoryPath] as const,
  () => {
    nextTick(() => {
      scrollActiveRowIntoView();
    });
  },
  { flush: "post" }
);
</script>
