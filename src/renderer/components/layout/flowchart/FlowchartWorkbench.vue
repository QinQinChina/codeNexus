<template>
  <section class="flowchart-workbench" aria-label="AI flowchart workbench" @keydown="onWorkbenchKeydown">
    <aside class="flowchart-panel flowchart-panel--left app-scrollbar">
      <header class="flowchart-panel-head">
        <div>
          <div class="flowchart-kicker">{{ t("flowchart.templates") }}</div>
          <h2>{{ currentDocument.title }}</h2>
        </div>
        <button
          class="flowchart-icon-btn"
          type="button"
          title="New diagram"
          @click="createFromTemplate(selectedTemplate)"
        >
          <Plus aria-hidden="true" />
        </button>
      </header>

      <div class="flowchart-template-grid">
        <button
          v-for="template in templates"
          :key="template.type"
          class="flowchart-template"
          :class="{ 'is-active': selectedTemplate === template.type }"
          type="button"
          @click="createFromTemplate(template.type)"
        >
          <component :is="template.icon" aria-hidden="true" />
          <span>{{ template.label }}</span>
        </button>
      </div>

      <div class="flowchart-section-head">
        <span>{{ t("flowchart.history") }}</span>
        <button class="flowchart-text-btn" type="button" @click="refreshHistory">{{ t("common.refresh") }}</button>
      </div>
      <input v-model="historyQuery" class="flowchart-input" type="search" :placeholder="t('flowchart.searchHistory')" />
      <div class="flowchart-history-list">
        <button
          v-for="item in filteredHistory"
          :key="item.id"
          class="flowchart-history-item"
          :class="{ 'is-active': item.id === currentDocument.id }"
          type="button"
          @click="loadHistoryItem(item)"
        >
          <span class="flowchart-history-title">{{ item.title }}</span>
          <span class="flowchart-history-meta"
            >{{ templateLabel(item.templateType) }} · {{ formatTime(item.updatedAt) }}</span
          >
          <Trash2 class="flowchart-history-delete" aria-hidden="true" @click.stop="deleteHistoryItem(item.id)" />
        </button>
        <div v-if="filteredHistory.length === 0" class="flowchart-empty">{{ t("flowchart.emptyHistory") }}</div>
      </div>
    </aside>

    <main class="flowchart-canvas-shell">
      <div class="flowchart-canvas-toolbar">
        <div class="flowchart-tool-group">
          <button class="flowchart-icon-btn" type="button" title="Undo" :disabled="!canUndo" @click="undo">
            <Undo2 aria-hidden="true" />
          </button>
          <button class="flowchart-icon-btn" type="button" title="Redo" :disabled="!canRedo" @click="redo">
            <Redo2 aria-hidden="true" />
          </button>
        </div>
        <div class="flowchart-tool-group">
          <button
            class="flowchart-icon-btn"
            type="button"
            title="Copy"
            :disabled="selectedNodeIds.length === 0"
            @click="copySelection"
          >
            <Copy aria-hidden="true" />
          </button>
          <button
            class="flowchart-icon-btn"
            type="button"
            title="Paste"
            :disabled="clipboardNodes.length === 0"
            @click="pasteSelection"
          >
            <ClipboardPaste aria-hidden="true" />
          </button>
          <button
            class="flowchart-icon-btn"
            type="button"
            title="Delete"
            :disabled="selectionCount === 0"
            @click="deleteSelection"
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>
        <div class="flowchart-tool-group">
          <button
            class="flowchart-text-btn"
            type="button"
            :disabled="selectedNodeIds.length < 2"
            @click="alignSelected('left')"
          >
            {{ t("flowchart.alignLeft") }}
          </button>
          <button
            class="flowchart-text-btn"
            type="button"
            :disabled="selectedNodeIds.length < 2"
            @click="alignSelected('top')"
          >
            {{ t("flowchart.alignTop") }}
          </button>
          <button
            class="flowchart-text-btn"
            type="button"
            :disabled="selectedNodeIds.length < 3"
            @click="distributeSelected('x')"
          >
            {{ t("flowchart.distributeX") }}
          </button>
          <button
            class="flowchart-text-btn"
            type="button"
            :disabled="selectedNodeIds.length < 3"
            @click="distributeSelected('y')"
          >
            {{ t("flowchart.distributeY") }}
          </button>
        </div>
        <div class="flowchart-canvas-status">
          {{ currentDocument.nodes.length }} nodes · {{ currentDocument.edges.length }} edges
        </div>
      </div>

      <div ref="canvasRef" class="flowchart-canvas">
        <VueFlow
          v-model:nodes="vueNodes"
          v-model:edges="vueEdges"
          :snap-to-grid="snapToGrid"
          :snap-grid="[20, 20]"
          :default-viewport="currentDocument.viewport"
          :multi-selection-key-code="['Shift']"
          :selection-key-code="null"
          :delete-key-code="null"
          :nodes-draggable="true"
          :nodes-connectable="true"
          :elements-selectable="true"
          :select-nodes-on-drag="false"
          fit-view-on-init
          @connect="onConnect"
          @node-drag-start="pushUndoSnapshot"
          @node-drag-stop="syncFromVueFlow"
          @selection-change="syncFromVueFlow"
          @pane-click="syncFromVueFlow"
        >
          <Background pattern-color="var(--flowchart-grid)" :gap="20" />
          <Controls />
          <MiniMap pannable zoomable />
        </VueFlow>
      </div>
    </main>

    <aside class="flowchart-panel flowchart-panel--right app-scrollbar">
      <section class="flowchart-card">
        <header class="flowchart-section-head">
          <span>{{ t("flowchart.ai") }}</span>
          <button class="flowchart-text-btn" type="button" @click="openAiSettings">
            {{ t("flowchart.aiSettings") }}
          </button>
        </header>
        <textarea
          v-model="aiPrompt"
          class="flowchart-textarea"
          :placeholder="t('flowchart.aiPlaceholder')"
          :disabled="aiBusy"
        ></textarea>
        <div class="flowchart-inline">
          <select v-model="selectedTemplate" class="flowchart-input" :disabled="aiBusy">
            <option v-for="template in templates" :key="template.type" :value="template.type">
              {{ template.label }}
            </option>
          </select>
          <button
            class="flowchart-primary-btn"
            type="button"
            :disabled="aiBusy || !aiPrompt.trim()"
            @click="runAi('generate')"
          >
            {{ aiBusy ? t("flowchart.generating") : t("flowchart.generate") }}
          </button>
        </div>
        <button
          class="flowchart-secondary-btn"
          type="button"
          :disabled="aiBusy || !aiPrompt.trim()"
          @click="runAi('modify')"
        >
          {{ t("flowchart.modifyCurrent") }}
        </button>
        <pre v-if="aiError" class="flowchart-error">{{ aiError }}</pre>
      </section>

      <section class="flowchart-card">
        <header class="flowchart-section-head">
          <span>{{ t("flowchart.nodeProps") }}</span>
          <span class="flowchart-muted">{{ selectedNodeIds.length }}</span>
        </header>
        <template v-if="selectedNode">
          <label class="flowchart-field">
            <span>{{ t("flowchart.label") }}</span>
            <input
              v-model="selectedNodeDraft.label"
              class="flowchart-input"
              type="text"
              @change="applySelectedNodeDraft"
            />
          </label>
          <label class="flowchart-field">
            <span>{{ t("flowchart.type") }}</span>
            <input
              v-model="selectedNodeDraft.type"
              class="flowchart-input"
              type="text"
              @change="applySelectedNodeDraft"
            />
          </label>
          <label class="flowchart-field">
            <span>{{ t("flowchart.fill") }}</span>
            <input
              v-model="selectedNodeDraft.backgroundColor"
              class="flowchart-input"
              type="color"
              @change="applySelectedNodeDraft"
            />
          </label>
          <label class="flowchart-field">
            <span>{{ t("flowchart.border") }}</span>
            <input
              v-model="selectedNodeDraft.borderColor"
              class="flowchart-input"
              type="color"
              @change="applySelectedNodeDraft"
            />
          </label>
        </template>
        <div v-else class="flowchart-empty">{{ t("flowchart.noNodeSelected") }}</div>
      </section>

      <section class="flowchart-card">
        <header class="flowchart-section-head">
          <span>{{ t("flowchart.edgeProps") }}</span>
          <span class="flowchart-muted">{{ selectedEdgeIds.length }}</span>
        </header>
        <template v-if="selectedEdge">
          <label class="flowchart-field">
            <span>{{ t("flowchart.label") }}</span>
            <input
              v-model="selectedEdgeDraft.label"
              class="flowchart-input"
              type="text"
              @change="applySelectedEdgeDraft"
            />
          </label>
          <label class="flowchart-field">
            <span>{{ t("flowchart.stroke") }}</span>
            <input
              v-model="selectedEdgeDraft.stroke"
              class="flowchart-input"
              type="color"
              @change="applySelectedEdgeDraft"
            />
          </label>
        </template>
        <div v-else class="flowchart-empty">{{ t("flowchart.noEdgeSelected") }}</div>
      </section>

      <section class="flowchart-card">
        <header class="flowchart-section-head">
          <span>{{ t("flowchart.export") }}</span>
          <label class="flowchart-switch">
            <input v-model="snapToGrid" type="checkbox" />
            <span>{{ t("flowchart.snapGrid") }}</span>
          </label>
        </header>
        <button class="flowchart-secondary-btn" type="button" @click="exportJson">
          {{ t("flowchart.exportJson") }}
        </button>
        <button class="flowchart-secondary-btn" type="button" @click="exportSvg">{{ t("flowchart.exportSvg") }}</button>
      </section>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import { MarkerType, VueFlow, type Connection, type Edge, type Node } from "@vue-flow/core";
import { toSvg } from "html-to-image";
import {
  ClipboardPaste,
  Copy,
  GitBranch,
  Network,
  Plus,
  Redo2,
  Rows3,
  SplitSquareHorizontal,
  Trash2,
  Undo2,
  Workflow,
} from "lucide-vue-next";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
import "@vue-flow/minimap/dist/style.css";
import {
  createDefaultFlowchartDocument,
  normalizeFlowchartDocument,
  type FlowchartDocument,
  type FlowchartEdge,
  type FlowchartNode,
  type FlowchartTemplateType,
} from "../../../../shared/flowchart";
import { codexDesktop } from "../../../api/codexDesktopClient";
import { useAppShellStore } from "../../../stores/appShell.store";
import { showToast } from "../../../ui/toast";
import "./flowchart-workbench.css";

type VueFlowNodeData = {
  label: string;
  nodeType: string;
  style: FlowchartNode["style"];
};

type ClipboardState = {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
};

const { t } = useI18n();
const appShellStore = useAppShellStore();
const canvasRef = ref<HTMLElement | null>(null);
const selectedTemplate = ref<FlowchartTemplateType>("basic");
const currentDocument = ref<FlowchartDocument>(createDefaultFlowchartDocument("basic"));
const historyItems = ref<FlowchartDocument[]>([]);
const historyQuery = ref("");
const aiPrompt = ref("");
const aiBusy = ref(false);
const aiError = ref("");
const snapToGrid = ref(true);
const vueNodes = ref<Array<Node<VueFlowNodeData>>>([]);
const vueEdges = ref<Edge[]>([]);
const undoStack = ref<FlowchartDocument[]>([]);
const redoStack = ref<FlowchartDocument[]>([]);
const clipboard = ref<ClipboardState>({ nodes: [], edges: [] });
const applying = ref(false);
let saveTimer: number | null = null;

const selectedNodeDraft = reactive({
  label: "",
  type: "",
  backgroundColor: "#f8fafc",
  borderColor: "#94a3b8",
});
const selectedEdgeDraft = reactive({
  label: "",
  stroke: "#64748b",
});

const templates = computed(() => [
  { type: "basic" as const, label: t("flowchart.templateBasic"), icon: Workflow },
  { type: "swimlane" as const, label: t("flowchart.templateSwimlane"), icon: Rows3 },
  { type: "architecture" as const, label: t("flowchart.templateArchitecture"), icon: Network },
  { type: "org" as const, label: t("flowchart.templateOrg"), icon: SplitSquareHorizontal },
  { type: "sequence" as const, label: t("flowchart.templateSequence"), icon: GitBranch },
]);

const filteredHistory = computed(() => {
  const q = historyQuery.value.trim().toLowerCase();
  if (!q) return historyItems.value;
  return historyItems.value.filter((item) =>
    [item.title, item.prompt, item.templateType].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(q)
    )
  );
});

const selectedNodeIds = computed(() => vueNodes.value.filter((node) => node.selected).map((node) => node.id));
const selectedEdgeIds = computed(() => vueEdges.value.filter((edge) => edge.selected).map((edge) => edge.id));
const selectionCount = computed(() => selectedNodeIds.value.length + selectedEdgeIds.value.length);
const selectedNode = computed(
  () => currentDocument.value.nodes.find((node) => node.id === selectedNodeIds.value[0]) ?? null
);
const selectedEdge = computed(
  () => currentDocument.value.edges.find((edge) => edge.id === selectedEdgeIds.value[0]) ?? null
);
const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);
const clipboardNodes = computed(() => clipboard.value.nodes);

watch(
  [vueNodes, vueEdges],
  () => {
    if (applying.value) return;
    syncFromVueFlow();
  },
  { deep: true }
);

watch(selectedNode, (node) => {
  selectedNodeDraft.label = node?.label ?? "";
  selectedNodeDraft.type = node?.type ?? "";
  selectedNodeDraft.backgroundColor = String(node?.style?.backgroundColor ?? "#f8fafc");
  selectedNodeDraft.borderColor = String(node?.style?.borderColor ?? "#94a3b8");
});

watch(selectedEdge, (edge) => {
  selectedEdgeDraft.label = edge?.label ?? "";
  selectedEdgeDraft.stroke = String(edge?.style?.stroke ?? "#64748b");
});

void refreshHistory();
applyDocument(currentDocument.value, { pushUndo: false, save: false });

function templateLabel(type: FlowchartTemplateType) {
  return templates.value.find((item) => item.type === type)?.label ?? type;
}

function formatTime(value: number) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString();
}

function cloneDocument(doc: FlowchartDocument): FlowchartDocument {
  return JSON.parse(JSON.stringify(doc)) as FlowchartDocument;
}

function nodeStyle(node: FlowchartNode): Record<string, string> {
  const tone = String(node.style?.tone ?? "");
  const toneColor: Record<string, { bg: string; border: string; fg: string }> = {
    green: { bg: "#ecfdf5", border: "#10b981", fg: "#064e3b" },
    blue: { bg: "#eff6ff", border: "#3b82f6", fg: "#1e3a8a" },
    teal: { bg: "#f0fdfa", border: "#14b8a6", fg: "#134e4a" },
    orange: { bg: "#fff7ed", border: "#f97316", fg: "#7c2d12" },
    gray: { bg: "#f8fafc", border: "#94a3b8", fg: "#334155" },
  };
  const palette = toneColor[tone] ?? toneColor.gray;
  const isLane = node.type === "lane";
  return {
    minWidth: `${Number(node.style?.width ?? (isLane ? 820 : 132))}px`,
    minHeight: `${Number(node.style?.height ?? (isLane ? 110 : 48))}px`,
    padding: isLane ? "10px 14px" : "10px 12px",
    borderRadius: node.type === "start" || node.type === "end" ? "999px" : "8px",
    border: `1.5px solid ${String(node.style?.borderColor ?? palette.border)}`,
    background: String(node.style?.backgroundColor ?? palette.bg),
    color: String(node.style?.color ?? palette.fg),
    boxShadow: "0 8px 18px rgb(15 23 42 / 0.12)",
    fontWeight: "700",
  };
}

function toVueNodes(doc: FlowchartDocument): Array<Node<VueFlowNodeData>> {
  return doc.nodes.map((node) => ({
    id: node.id,
    type: "default",
    label: node.label,
    position: { ...node.position },
    data: { label: node.label, nodeType: node.type, style: { ...node.style } },
    style: nodeStyle(node),
  }));
}

function toVueEdges(doc: FlowchartDocument): Edge[] {
  return doc.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: "smoothstep",
    markerEnd: MarkerType.ArrowClosed,
    style: {
      stroke: String(edge.style?.stroke ?? "#64748b"),
      strokeWidth: Number(edge.style?.strokeWidth ?? 2),
      strokeDasharray: edge.style?.dashed ? "6 4" : undefined,
    },
  }));
}

function fromVueFlow(): FlowchartDocument {
  const previous = currentDocument.value;
  const nodes = vueNodes.value.map((node) => {
    const existing = previous.nodes.find((item) => item.id === node.id);
    return {
      id: node.id,
      type: existing?.type ?? node.data?.nodeType ?? "default",
      label: String(node.label ?? node.data?.label ?? existing?.label ?? node.id),
      position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
      style: { ...(existing?.style ?? {}) },
    };
  });
  const edges = vueEdges.value.map((edge) => {
    const existing = previous.edges.find((item) => item.id === edge.id);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: String(edge.label ?? existing?.label ?? ""),
      style: {
        ...(existing?.style ?? {}),
        stroke: String((edge.style as any)?.stroke ?? existing?.style?.stroke ?? "#64748b"),
      },
    };
  });
  return normalizeFlowchartDocument(
    {
      ...previous,
      nodes,
      edges,
      updatedAt: Date.now(),
    },
    previous
  ).document;
}

function applyDocument(doc: FlowchartDocument, opts?: { pushUndo?: boolean; save?: boolean }) {
  const normalized = normalizeFlowchartDocument(doc).document;
  if (opts?.pushUndo) pushUndoSnapshot();
  applying.value = true;
  currentDocument.value = cloneDocument(normalized);
  selectedTemplate.value = normalized.templateType;
  vueNodes.value = toVueNodes(normalized);
  vueEdges.value = toVueEdges(normalized);
  void nextTick(() => {
    applying.value = false;
  });
  if (opts?.save ?? true) scheduleSave();
}

function syncFromVueFlow() {
  currentDocument.value = fromVueFlow();
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void saveCurrentDocument();
  }, 800);
}

async function saveCurrentDocument() {
  try {
    const result = await codexDesktop.app.upsertFlowchartHistory({ document: currentDocument.value });
    historyItems.value = result.items;
  } catch (error) {
    console.warn("[flowchart] save history failed", error);
  }
}

async function refreshHistory() {
  try {
    const result = await codexDesktop.app.listFlowchartHistory();
    historyItems.value = result.items;
  } catch (error: any) {
    showToast({ kind: "error", title: t("flowchart.historyLoadFailed"), message: String(error?.message ?? error) });
  }
}

function pushUndoSnapshot() {
  const last = undoStack.value[undoStack.value.length - 1];
  const current = cloneDocument(currentDocument.value);
  if (last && JSON.stringify(last) === JSON.stringify(current)) return;
  undoStack.value.push(current);
  if (undoStack.value.length > 80) undoStack.value.shift();
  redoStack.value = [];
}

function undo() {
  const previous = undoStack.value.pop();
  if (!previous) return;
  redoStack.value.push(cloneDocument(currentDocument.value));
  applyDocument(previous, { pushUndo: false, save: true });
}

function redo() {
  const next = redoStack.value.pop();
  if (!next) return;
  undoStack.value.push(cloneDocument(currentDocument.value));
  applyDocument(next, { pushUndo: false, save: true });
}

function createFromTemplate(type: FlowchartTemplateType) {
  applyDocument(createDefaultFlowchartDocument(type), { pushUndo: true, save: true });
}

function loadHistoryItem(item: FlowchartDocument) {
  applyDocument(item, { pushUndo: true, save: false });
}

async function deleteHistoryItem(id: string) {
  const result = await codexDesktop.app.deleteFlowchartHistory({ id });
  historyItems.value = result.items;
  if (currentDocument.value.id === id) createFromTemplate("basic");
}

function onConnect(connection: Connection) {
  if (!connection.source || !connection.target) return;
  pushUndoSnapshot();
  const id = `edge-${connection.source}-${connection.target}-${Date.now()}`;
  vueEdges.value = [
    ...vueEdges.value,
    {
      id,
      source: connection.source,
      target: connection.target,
      label: "",
      type: "smoothstep",
      markerEnd: MarkerType.ArrowClosed,
      style: { stroke: "#64748b", strokeWidth: 2 },
    },
  ];
  syncFromVueFlow();
}

function deleteSelection() {
  if (selectionCount.value === 0) return;
  pushUndoSnapshot();
  const nodeIds = new Set(selectedNodeIds.value);
  const edgeIds = new Set(selectedEdgeIds.value);
  vueNodes.value = vueNodes.value.filter((node) => !nodeIds.has(node.id));
  vueEdges.value = vueEdges.value.filter(
    (edge) => !edgeIds.has(edge.id) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target)
  );
  syncFromVueFlow();
}

function copySelection() {
  const nodeIds = new Set(selectedNodeIds.value);
  clipboard.value = {
    nodes: currentDocument.value.nodes
      .filter((node) => nodeIds.has(node.id))
      .map((node) => cloneDocument({ ...currentDocument.value, nodes: [node], edges: [] }).nodes[0]),
    edges: currentDocument.value.edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => ({ ...edge, style: { ...edge.style } })),
  };
}

function pasteSelection() {
  if (clipboard.value.nodes.length === 0) return;
  pushUndoSnapshot();
  const idMap = new Map<string, string>();
  const now = Date.now();
  const pastedNodes = clipboard.value.nodes.map((node, index) => {
    const id = `${node.id}-copy-${now}-${index}`;
    idMap.set(node.id, id);
    return {
      ...node,
      id,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      style: { ...node.style },
    };
  });
  const pastedEdges = clipboard.value.edges
    .map((edge, index) => {
      const source = idMap.get(edge.source);
      const target = idMap.get(edge.target);
      if (!source || !target) return null;
      return { ...edge, id: `${edge.id}-copy-${now}-${index}`, source, target, style: { ...edge.style } };
    })
    .filter((edge): edge is FlowchartEdge => Boolean(edge));
  applyDocument(
    {
      ...currentDocument.value,
      nodes: [...currentDocument.value.nodes, ...pastedNodes],
      edges: [...currentDocument.value.edges, ...pastedEdges],
      updatedAt: Date.now(),
    },
    { pushUndo: false, save: true }
  );
  vueNodes.value = vueNodes.value.map((node) => ({ ...node, selected: idMap.has(node.id.replace(/-copy-.+$/, "")) }));
}

function alignSelected(axis: "left" | "top") {
  if (selectedNodeIds.value.length < 2) return;
  pushUndoSnapshot();
  const selected = vueNodes.value.filter((node) => selectedNodeIds.value.includes(node.id));
  const value =
    axis === "left"
      ? Math.min(...selected.map((node) => node.position.x))
      : Math.min(...selected.map((node) => node.position.y));
  vueNodes.value = vueNodes.value.map((node) =>
    selectedNodeIds.value.includes(node.id)
      ? { ...node, position: axis === "left" ? { ...node.position, x: value } : { ...node.position, y: value } }
      : node
  );
  syncFromVueFlow();
}

function distributeSelected(axis: "x" | "y") {
  if (selectedNodeIds.value.length < 3) return;
  pushUndoSnapshot();
  const sorted = vueNodes.value
    .filter((node) => selectedNodeIds.value.includes(node.id))
    .sort((a, b) => (axis === "x" ? a.position.x - b.position.x : a.position.y - b.position.y));
  const first = axis === "x" ? sorted[0].position.x : sorted[0].position.y;
  const last = axis === "x" ? sorted[sorted.length - 1].position.x : sorted[sorted.length - 1].position.y;
  const step = (last - first) / (sorted.length - 1);
  const positions = new Map(sorted.map((node, index) => [node.id, first + step * index]));
  vueNodes.value = vueNodes.value.map((node) => {
    const value = positions.get(node.id);
    if (value === undefined) return node;
    return { ...node, position: axis === "x" ? { ...node.position, x: value } : { ...node.position, y: value } };
  });
  syncFromVueFlow();
}

function applySelectedNodeDraft() {
  const node = selectedNode.value;
  if (!node) return;
  pushUndoSnapshot();
  applyDocument(
    {
      ...currentDocument.value,
      nodes: currentDocument.value.nodes.map((item) =>
        item.id === node.id
          ? {
              ...item,
              type: selectedNodeDraft.type.trim() || item.type,
              label: selectedNodeDraft.label.trim() || item.label,
              style: {
                ...item.style,
                backgroundColor: selectedNodeDraft.backgroundColor,
                borderColor: selectedNodeDraft.borderColor,
              },
            }
          : item
      ),
      updatedAt: Date.now(),
    },
    { pushUndo: false, save: true }
  );
}

function applySelectedEdgeDraft() {
  const edge = selectedEdge.value;
  if (!edge) return;
  pushUndoSnapshot();
  applyDocument(
    {
      ...currentDocument.value,
      edges: currentDocument.value.edges.map((item) =>
        item.id === edge.id
          ? {
              ...item,
              label: selectedEdgeDraft.label.trim(),
              style: { ...item.style, stroke: selectedEdgeDraft.stroke },
            }
          : item
      ),
      updatedAt: Date.now(),
    },
    { pushUndo: false, save: true }
  );
}

async function runAi(operation: "generate" | "modify") {
  aiBusy.value = true;
  aiError.value = "";
  try {
    const result = await codexDesktop.app.runFlowchartAi({
      operation,
      templateType: selectedTemplate.value,
      prompt: aiPrompt.value,
      currentDocument: operation === "modify" ? currentDocument.value : null,
    });
    if (!result.ok) {
      aiError.value = [result.errorMessage, ...result.validationErrors, result.rawResponse ?? ""]
        .filter(Boolean)
        .join("\n\n");
      return;
    }
    applyDocument(result.document, { pushUndo: true, save: true });
    showToast({
      kind: "success",
      title: t("flowchart.aiSuccess"),
      message: result.repaired ? t("flowchart.aiRepaired") : t("flowchart.aiGenerated"),
    });
  } catch (error: any) {
    aiError.value = String(error?.message ?? error);
  } finally {
    aiBusy.value = false;
  }
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  downloadText(
    `${currentDocument.value.title || "flowchart"}.json`,
    `${JSON.stringify(currentDocument.value, null, 2)}\n`,
    "application/json"
  );
}

async function exportSvg() {
  const target = canvasRef.value?.querySelector(".vue-flow") as HTMLElement | null;
  if (!target) return;
  const dataUrl = await toSvg(target, {
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--surface-1") || "#ffffff",
    filter: (node) => !(node instanceof HTMLElement && node.classList.contains("vue-flow__minimap")),
  });
  const svgText = decodeURIComponent(String(dataUrl).replace(/^data:image\/svg\+xml;charset=utf-8,/, ""));
  downloadText(`${currentDocument.value.title || "flowchart"}.svg`, svgText, "image/svg+xml");
}

function openAiSettings() {
  appShellStore.openSettings("flowchart");
}

function onWorkbenchKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.shiftKey ? redo() : undo();
    event.preventDefault();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    redo();
    event.preventDefault();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
    copySelection();
    event.preventDefault();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
    pasteSelection();
    event.preventDefault();
    return;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    deleteSelection();
    event.preventDefault();
  }
}
</script>
