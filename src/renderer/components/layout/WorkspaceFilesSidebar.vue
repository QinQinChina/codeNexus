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
                  :draggable="!row.isDirectory"
                  :aria-level="row.depth + 1"
                  :aria-expanded="row.isDirectory ? String(row.isExpanded) : undefined"
                  :aria-selected="row.isActiveFile || row.isSelectedDirectory ? 'true' : 'false'"
                  :title="row.isDirectory ? row.path : `${row.path}\n拖到聊天输入框可选择文件`"
                  :data-tree-path="row.path"
                  @click="onOpenTreeRow(row)"
                  @dragstart="onTreeRowDragStart(row, $event)"
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
                    :theme="appShellStore.workspaceFileIconTheme"
                  />
                  <span class="workspace-file-tree-row__label">{{ row.label }}</span>
                  <span v-if="row.isLoading" class="workspace-file-tree-row__meta">加载中</span>
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
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { ChevronRight } from "lucide-vue-next";
import WorkspaceTreeEntryIcon from "./WorkspaceTreeEntryIcon.vue";
import { useAppShellStore } from "../../stores/appShell.store";
import { useWorkspaceFilesStore } from "../../stores/workspaceFiles.store";
import { basenameFromPath } from "../../domain/workspaceFiles";
import { normalizeAbsoluteFsPath } from "../../domain/workspacePath";
import { writeWorkspaceFileDragData } from "../../domain/workspaceFileDrag";

const appShellStore = useAppShellStore();
const workspaceFilesStore = useWorkspaceFilesStore();
const treeSurfaceRef = ref<HTMLElement | null>(null);

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
  };
};

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

const onOpenTreeRow = (row: Extract<TreeRow, { kind: "entry" }>) => {
  if (row.isDirectory) {
    void workspaceFilesStore.toggleDirectoryExpanded(row.path);
    return;
  }
  void workspaceFilesStore.openFile(row.path);
};

const onTreeRowDragStart = (row: Extract<TreeRow, { kind: "entry" }>, event: DragEvent) => {
  if (row.isDirectory) {
    event.preventDefault();
    return;
  }
  writeWorkspaceFileDragData(event.dataTransfer, row.path);
};

function scrollActiveRowIntoView() {
  const targetPath = normalizeAbsoluteFsPath(workspaceFilesStore.activeFilePath);
  const surface = treeSurfaceRef.value;
  if (!targetPath || !surface) return;
  const row = surface.querySelector<HTMLElement>(`[data-tree-path="${CSS.escape(targetPath)}"]`);
  row?.scrollIntoView({ block: "nearest" });
}

onMounted(() => {
  void workspaceFilesStore.ensureReady(false);
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
