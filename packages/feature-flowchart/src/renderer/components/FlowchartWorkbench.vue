<template>
  <section
    class="flowchart-workbench"
    :class="{ 'is-connecting': connectionTool }"
    aria-label="AI flowchart workbench"
    @keydown="onWorkbenchKeydown"
  >
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
        <span>{{ t("flowchart.shapePresets") }}</span>
      </div>
      <div class="flowchart-shape-grid">
        <button
          v-for="preset in shapePresets"
          :key="preset.type"
          class="flowchart-palette-item"
          type="button"
          draggable="true"
          @dragstart="onPaletteDragStart($event, { kind: 'shape', type: preset.type })"
          @dragend="onPaletteDragEnd"
        >
          <component :is="preset.icon" aria-hidden="true" />
          <span>{{ preset.label }}</span>
        </button>
      </div>

      <div class="flowchart-section-head">
        <span>{{ t("flowchart.connectionPresets") }}</span>
      </div>
      <div class="flowchart-edge-grid">
        <button
          v-for="preset in edgePresets"
          :key="preset.kind"
          class="flowchart-palette-item"
          :class="{ 'is-active': isConnectionPresetActive(preset) }"
          type="button"
          draggable="true"
          @click="activateConnectionTool(preset)"
          @dragstart="onPaletteDragStart($event, { kind: 'edge', type: preset.kind })"
          @dragend="onPaletteDragEnd"
        >
          <component :is="preset.icon" aria-hidden="true" />
          <span>{{ preset.label }}</span>
        </button>
      </div>

      <div class="flowchart-section-head">
        <span>{{ t("flowchart.framePresets") }}</span>
      </div>
      <div class="flowchart-frame-grid">
        <button
          v-for="preset in framePresets"
          :key="preset.type"
          class="flowchart-palette-item"
          type="button"
          draggable="true"
          @dragstart="onPaletteDragStart($event, { kind: 'frame', type: preset.type })"
          @dragend="onPaletteDragEnd"
        >
          <component :is="preset.icon" aria-hidden="true" />
          <span>{{ preset.label }}</span>
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
          <button class="flowchart-text-btn" type="button" :disabled="gridLayoutTargetCount === 0" @click="layoutGrid">
            {{ t("flowchart.gridLayout") }}
          </button>
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

      <div
        ref="canvasRef"
        class="flowchart-canvas"
        :class="{ 'is-connecting': connectionTool }"
        @dragover.prevent
        @drop="onCanvasDrop"
      >
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
          @node-drag="onNodeDrag"
          @node-drag-stop="onNodeDragStop"
          @node-click="onNodeClick"
          @viewport-change-end="onViewportChangeEnd"
          @selection-change="syncFromVueFlow"
          @pane-click="onPaneClick"
        >
          <template #node-flowchart-shape="{ data }">
            <div
              class="flowchart-shape-node"
              :class="[
                `flowchart-shape-node--${data.nodeType}`,
                { 'is-empty': !data.label, 'is-connectable': data.connectable },
              ]"
            >
              <Handle v-if="data.connectable" type="target" :position="Position.Top" />
              <Handle v-if="data.connectable" type="source" :position="Position.Bottom" />
              <div class="flowchart-shape-node__surface">
                <span v-if="data.label" class="flowchart-shape-node__label">{{ data.label }}</span>
              </div>
            </div>
          </template>
          <Background
            id="flowchart-grid-major"
            variant="lines"
            color="var(--flowchart-grid-major)"
            :gap="100"
            :line-width="0.7"
          />
          <Background id="flowchart-grid-minor" variant="dots" color="var(--flowchart-grid)" :gap="20" :size="1.2" />
          <Controls />
          <MiniMap pannable zoomable />
        </VueFlow>
        <div v-if="connectionTool" class="flowchart-connect-hint" aria-live="polite">
          {{ connectionHintText }}
        </div>
        <div class="flowchart-guides" aria-hidden="true">
          <div
            v-for="guide in alignmentGuides.x"
            :key="`x-${guide.id}`"
            class="flowchart-guide flowchart-guide--x"
            :style="{ left: `${guide.screen}px` }"
          ></div>
          <div
            v-for="guide in alignmentGuides.y"
            :key="`y-${guide.id}`"
            class="flowchart-guide flowchart-guide--y"
            :style="{ top: `${guide.screen}px` }"
          ></div>
        </div>
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
          <template v-if="hasDimensionControls(selectedNode.type)">
            <label class="flowchart-field">
              <span>{{ t("flowchart.width") }}</span>
              <input
                v-model.number="selectedNodeDraft.width"
                class="flowchart-input"
                type="number"
                min="160"
                max="1800"
                step="20"
                @change="applySelectedNodeDraft"
              />
            </label>
            <label class="flowchart-field">
              <span>{{ t("flowchart.height") }}</span>
              <input
                v-model.number="selectedNodeDraft.height"
                class="flowchart-input"
                type="number"
                min="100"
                max="1200"
                step="20"
                @change="applySelectedNodeDraft"
              />
            </label>
            <label class="flowchart-field">
              <span>{{ t("flowchart.borderStyle") }}</span>
              <select v-model="selectedNodeDraft.borderStyle" class="flowchart-input" @change="applySelectedNodeDraft">
                <option value="solid">{{ t("flowchart.borderSolid") }}</option>
                <option value="dashed">{{ t("flowchart.borderDashed") }}</option>
              </select>
            </label>
          </template>
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
          <label class="flowchart-field">
            <span>{{ t("flowchart.edgePathType") }}</span>
            <select v-model="selectedEdgeDraft.type" class="flowchart-input" @change="applySelectedEdgeDraft">
              <option value="straight">{{ t("flowchart.edgeStraight") }}</option>
              <option value="smoothstep">{{ t("flowchart.edgeSmoothStep") }}</option>
            </select>
          </label>
          <label class="flowchart-switch flowchart-switch--field">
            <input v-model="selectedEdgeDraft.markerEnd" type="checkbox" @change="applySelectedEdgeDraft" />
            <span>{{ t("flowchart.edgeMarkerEnd") }}</span>
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
import {
  Handle,
  MarkerType,
  Position,
  VueFlow,
  useVueFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeDragEvent,
  type NodeMouseEvent,
} from "@vue-flow/core";
import { toSvg } from "html-to-image";
import {
  ArrowRight,
  ClipboardPaste,
  Circle,
  CornerDownRight,
  Copy,
  Database,
  Diamond,
  GitBranch,
  Minus,
  Network,
  Plus,
  RectangleHorizontal,
  Redo2,
  Rows3,
  SplitSquareHorizontal,
  Square,
  Trash2,
  Type,
  Undo2,
  UserRound,
  Workflow,
} from "lucide-vue-next";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
import "@vue-flow/minimap/dist/style.css";
import {
  createDefaultFlowchartDocument,
  normalizeFlowchartDocument,
  normalizeFlowchartEdgeType,
  type FlowchartDocument,
  type FlowchartEdge,
  type FlowchartEdgeType,
  type FlowchartNode,
  type FlowchartTemplateType,
} from "../../types";
import "./flowchart-workbench.css";

type FlowchartToastKind = "info" | "success" | "warn" | "error";

type FlowchartDesktopApi = {
  app: {
    upsertFlowchartHistory(args: { document: FlowchartDocument }): Promise<{ items: FlowchartDocument[] }>;
    listFlowchartHistory(): Promise<{ items: FlowchartDocument[] }>;
    deleteFlowchartHistory(args: { id: string }): Promise<{ items: FlowchartDocument[] }>;
    runFlowchartAi(args: {
      operation: "generate" | "modify";
      templateType: FlowchartTemplateType;
      prompt: string;
      currentDocument?: FlowchartDocument | null;
    }): Promise<
      | {
          ok: true;
          document: FlowchartDocument;
          rawResponse: string;
          repaired: boolean;
          validationErrors: string[];
        }
      | {
          ok: false;
          errorMessage: string;
          rawResponse: string | null;
          repaired: boolean;
          validationErrors: string[];
        }
    >;
  };
};

const codexDesktop = (window as unknown as { codexDesktop: FlowchartDesktopApi }).codexDesktop;

function showFlowchartToast(options: { kind?: FlowchartToastKind; title?: string; message: string }) {
  window.dispatchEvent(new CustomEvent("codenexus:toast", { detail: options }));
}

function openFeatureSettings(tab: string) {
  window.dispatchEvent(new CustomEvent("codenexus:open-settings", { detail: { tab } }));
}

type VueFlowNodeData = {
  label: string;
  nodeType: string;
  style: FlowchartNode["style"];
  connectable: boolean;
};

type ClipboardState = {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
};

type FrameNodeType = "frame" | "lane-frame" | "system-frame" | "phase-frame";
type ShapeNodeType = "rectangle" | "rounded-rectangle" | "diamond" | "ellipse" | "text" | "database" | "actor";
type EdgePresetType = "straight-line" | "straight-arrow" | "smoothstep-arrow";

type PaletteDragState =
  | { kind: "shape"; type: ShapeNodeType }
  | { kind: "frame"; type: FrameNodeType }
  | { kind: "edge"; type: EdgePresetType };

type EdgePreset = {
  kind: EdgePresetType;
  type: FlowchartEdgeType;
  markerEnd: boolean;
  label: string;
  icon: unknown;
};

type ConnectionToolState = {
  preset: EdgePreset;
  stage: "select-source" | "select-target";
  sourceId: string | null;
  sourceLabel: string;
  chainedFromId: string | null;
};

type AlignmentGuide = {
  id: string;
  screen: number;
};

type NodeRect = {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
};

const FRAME_NODE_TYPES = new Set<string>(["frame", "lane-frame", "system-frame", "phase-frame"]);
const SHAPE_NODE_TYPES = new Set<string>([
  "rectangle",
  "rounded-rectangle",
  "diamond",
  "ellipse",
  "text",
  "database",
  "actor",
]);
const GRID_UNIT = 20;
const GRID_LAYOUT_CELL = { width: 220, height: 140 };
const ALIGNMENT_THRESHOLD_PX = 6;

const { t } = useI18n();
const { getViewport } = useVueFlow();
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
const alignmentGuides = ref<{ x: AlignmentGuide[]; y: AlignmentGuide[] }>({ x: [], y: [] });
const paletteDrag = ref<PaletteDragState | null>(null);
const connectionTool = ref<ConnectionToolState | null>(null);
const applying = ref(false);
const suppressDragSnap = ref(false);
let saveTimer: number | null = null;

const selectedNodeDraft = reactive({
  label: "",
  type: "",
  backgroundColor: "#f8fafc",
  borderColor: "#94a3b8",
  borderStyle: "solid",
  width: 240,
  height: 140,
});
const selectedEdgeDraft = reactive({
  label: "",
  stroke: "#64748b",
  type: "smoothstep" as FlowchartEdgeType,
  markerEnd: true,
});

const templates = computed(() => [
  { type: "basic" as const, label: t("flowchart.templateBasic"), icon: Workflow },
  { type: "swimlane" as const, label: t("flowchart.templateSwimlane"), icon: Rows3 },
  { type: "architecture" as const, label: t("flowchart.templateArchitecture"), icon: Network },
  { type: "org" as const, label: t("flowchart.templateOrg"), icon: SplitSquareHorizontal },
  { type: "sequence" as const, label: t("flowchart.templateSequence"), icon: GitBranch },
]);

const shapePresets = computed(() => [
  { type: "rectangle" as const, label: t("flowchart.shapeRectangle"), icon: Square },
  { type: "rounded-rectangle" as const, label: t("flowchart.shapeRoundedRectangle"), icon: RectangleHorizontal },
  { type: "diamond" as const, label: t("flowchart.shapeDiamond"), icon: Diamond },
  { type: "ellipse" as const, label: t("flowchart.shapeEllipse"), icon: Circle },
  { type: "text" as const, label: t("flowchart.shapeText"), icon: Type },
  { type: "database" as const, label: t("flowchart.shapeDatabase"), icon: Database },
  { type: "actor" as const, label: t("flowchart.shapeActor"), icon: UserRound },
]);

const edgePresets = computed<EdgePreset[]>(() => [
  { kind: "straight-line", type: "straight", markerEnd: false, label: t("flowchart.edgeLine"), icon: Minus },
  { kind: "straight-arrow", type: "straight", markerEnd: true, label: t("flowchart.edgeArrow"), icon: ArrowRight },
  {
    kind: "smoothstep-arrow",
    type: "smoothstep",
    markerEnd: true,
    label: t("flowchart.edgeSmoothArrow"),
    icon: CornerDownRight,
  },
]);

const framePresets = computed(() => [
  { type: "frame" as const, label: t("flowchart.frameContainer"), icon: Workflow },
  { type: "lane-frame" as const, label: t("flowchart.frameLane"), icon: Rows3 },
  { type: "system-frame" as const, label: t("flowchart.frameSystem"), icon: Network },
  { type: "phase-frame" as const, label: t("flowchart.framePhase"), icon: SplitSquareHorizontal },
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
const gridLayoutTargetCount = computed(() => {
  const selectedRegular = selectedNodeIds.value.filter((id) => {
    const node = currentDocument.value.nodes.find((item) => item.id === id);
    return node && !isFrameType(node.type);
  });
  if (selectedRegular.length > 0) return selectedRegular.length;
  return currentDocument.value.nodes.filter((node) => !isFrameType(node.type)).length;
});
const connectionHintText = computed(() => {
  const tool = connectionTool.value;
  if (!tool) return "";
  if (!tool.sourceId) return t("flowchart.connectingSelectSource", { label: tool.preset.label });
  return t("flowchart.connectingFrom", { label: tool.sourceLabel || tool.sourceId });
});

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
  selectedNodeDraft.borderStyle = String(node?.style?.borderStyle ?? "solid");
  const sizeFallback = node ? getNodeSize(node) : { width: 132, height: 48 };
  selectedNodeDraft.width = normalizeNodeDimension(node?.style?.width, sizeFallback.width, 160, 1800);
  selectedNodeDraft.height = normalizeNodeDimension(node?.style?.height, sizeFallback.height, 100, 1200);
});

watch(selectedEdge, (edge) => {
  selectedEdgeDraft.label = edge?.label ?? "";
  selectedEdgeDraft.stroke = String(edge?.style?.stroke ?? "#64748b");
  selectedEdgeDraft.type = normalizeFlowchartEdgeType(edge?.type);
  selectedEdgeDraft.markerEnd = edge?.markerEnd !== false;
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

function isFrameType(value: unknown): value is FrameNodeType {
  return FRAME_NODE_TYPES.has(String(value ?? ""));
}

function isShapeType(value: unknown): value is ShapeNodeType {
  return SHAPE_NODE_TYPES.has(String(value ?? ""));
}

function hasDimensionControls(value: unknown): boolean {
  return isFrameType(value) || isShapeType(value);
}

function isConnectableNodeType(value: unknown): boolean {
  return !isFrameType(value) && String(value ?? "") !== "text";
}

function shapeDefaults(type: ShapeNodeType): {
  width: number;
  height: number;
  backgroundColor: string;
  borderColor: string;
} {
  const base = {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  };
  if (type === "text") {
    return { width: 180, height: 48, backgroundColor: "transparent", borderColor: "transparent" };
  }
  if (type === "diamond") return { ...base, width: 132, height: 132 };
  if (type === "ellipse") return { ...base, width: 150, height: 86 };
  if (type === "database") return { ...base, width: 150, height: 96 };
  if (type === "actor") return { ...base, width: 120, height: 120 };
  if (type === "rounded-rectangle") return { ...base, width: 170, height: 82 };
  return { ...base, width: 160, height: 82 };
}

function normalizeNodeDimension(value: unknown, fallback: number, min = 40, max = 1800): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function snapToGridValue(value: number): number {
  return Math.round(value / GRID_UNIT) * GRID_UNIT;
}

function getCurrentViewport(): FlowchartViewport {
  const viewport = getViewport();
  return {
    x: Math.round(viewport.x),
    y: Math.round(viewport.y),
    zoom: Number(viewport.zoom.toFixed(3)),
  };
}

function getNodeSize(node: FlowchartNode): { width: number; height: number } {
  const isFrame = isFrameType(node.type);
  const isLane = node.type === "lane";
  const shape = isShapeType(node.type) ? shapeDefaults(node.type) : null;
  return {
    width: normalizeNodeDimension(node.style?.width, isFrame ? 520 : isLane ? 860 : (shape?.width ?? 132), 80, 1800),
    height: normalizeNodeDimension(node.style?.height, isFrame ? 320 : isLane ? 110 : (shape?.height ?? 48), 40, 1200),
  };
}

function getAbsolutePosition(node: FlowchartNode, nodes = currentDocument.value.nodes): { x: number; y: number } {
  if (!node.parentId) return { ...node.position };
  const parent = nodes.find((item) => item.id === node.parentId);
  if (!parent) return { ...node.position };
  const parentPosition = getAbsolutePosition(parent, nodes);
  return {
    x: parentPosition.x + node.position.x,
    y: parentPosition.y + node.position.y,
  };
}

function getNodeRect(node: FlowchartNode, nodes = currentDocument.value.nodes): NodeRect {
  const position = getAbsolutePosition(node, nodes);
  const size = getNodeSize(node);
  return {
    id: node.id,
    parentId: node.parentId ?? null,
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  };
}

function pointInRect(point: { x: number; y: number }, rect: NodeRect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
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
  const isFrame = isFrameType(node.type);
  const size = getNodeSize(node);
  if (isFrame) {
    return {
      width: `${size.width}px`,
      height: `${size.height}px`,
      minWidth: `${size.width}px`,
      minHeight: `${size.height}px`,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "flex-start",
      padding: "12px 14px",
      borderRadius: "8px",
      border: `1.5px ${String(node.style?.borderStyle ?? "solid")} ${String(
        node.style?.borderColor ?? "var(--border)"
      )}`,
      background: String(node.style?.backgroundColor ?? "color-mix(in srgb, var(--surface-2) 24%, transparent)"),
      color: String(node.style?.color ?? "var(--text-muted)"),
      boxShadow: "inset 0 0 0 1px color-mix(in srgb, white 4%, transparent)",
      fontWeight: "750",
    };
  }
  const shape = isShapeType(node.type) ? shapeDefaults(node.type) : null;
  const backgroundColor = String(node.style?.backgroundColor ?? shape?.backgroundColor ?? palette.bg);
  const borderColor = String(node.style?.borderColor ?? shape?.borderColor ?? palette.border);
  const nodeType = String(node.type ?? "");
  return {
    width: `${size.width}px`,
    height: `${size.height}px`,
    minWidth: `${size.width}px`,
    minHeight: `${size.height}px`,
    "--flowchart-node-bg": backgroundColor,
    "--flowchart-node-border": borderColor,
    "--flowchart-node-border-style": String(node.style?.borderStyle ?? "solid"),
    "--flowchart-node-color": String(node.style?.color ?? palette.fg),
    "--flowchart-node-radius": nodeType === "start" || nodeType === "end" || nodeType === "ellipse" ? "999px" : "8px",
  };
}

function toVueNodes(doc: FlowchartDocument): Array<Node<VueFlowNodeData>> {
  return [...doc.nodes]
    .sort((a, b) => Number(isFrameType(b.type)) - Number(isFrameType(a.type)))
    .map((node) => ({
      id: node.id,
      type: isFrameType(node.type) ? "default" : "flowchart-shape",
      label: node.label,
      position: { ...node.position },
      parentNode: node.parentId || undefined,
      data: {
        label: node.label,
        nodeType: node.type,
        style: { ...node.style },
        connectable: isConnectableNodeType(node.type),
      },
      style: nodeStyle(node),
      class: {
        "flowchart-frame-node": isFrameType(node.type),
        [`flowchart-frame-node--${node.type}`]: isFrameType(node.type),
        "flowchart-shape-node-shell": !isFrameType(node.type),
        [`flowchart-shape-node-shell--${node.type}`]: !isFrameType(node.type),
      },
      connectable: isConnectableNodeType(node.type),
      zIndex: isFrameType(node.type) ? 0 : 10,
    }));
}

function toVueEdges(doc: FlowchartDocument): Edge[] {
  return doc.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: normalizeFlowchartEdgeType(edge.type),
    markerEnd: edge.markerEnd === false ? undefined : MarkerType.ArrowClosed,
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
      parentId: String((node as any).parentNode ?? existing?.parentId ?? "").trim() || null,
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
      type: normalizeFlowchartEdgeType(edge.type ?? existing?.type),
      markerEnd: edge.markerEnd ? true : false,
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
      viewport: getCurrentViewport(),
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

function onViewportChangeEnd(viewport: FlowchartViewport) {
  currentDocument.value = {
    ...currentDocument.value,
    viewport: {
      x: Math.round(viewport.x),
      y: Math.round(viewport.y),
      zoom: Number(viewport.zoom.toFixed(3)),
    },
    updatedAt: Date.now(),
  };
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
    showFlowchartToast({ kind: "error", title: t("flowchart.historyLoadFailed"), message: String(error?.message ?? error) });
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

function selectOnlyNode(nodeId: string) {
  void nextTick(() => {
    vueNodes.value = vueNodes.value.map((node) => ({ ...node, selected: node.id === nodeId }));
    vueEdges.value = vueEdges.value.map((edge) => ({ ...edge, selected: false }));
  });
}

function flowPositionFromClientPoint(clientX: number, clientY: number, size: { width: number; height: number }) {
  const canvasRect = canvasRef.value?.getBoundingClientRect();
  const viewport = getViewport();
  if (!canvasRect) return { x: 120, y: 120 };
  return {
    x: snapToGridValue((clientX - canvasRect.left - viewport.x) / viewport.zoom - size.width / 2),
    y: snapToGridValue((clientY - canvasRect.top - viewport.y) / viewport.zoom - size.height / 2),
  };
}

function onPaletteDragStart(event: DragEvent, state: PaletteDragState) {
  paletteDrag.value = state;
  event.dataTransfer?.setData("application/x-flowchart-palette", JSON.stringify(state));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
}

function onPaletteDragEnd() {
  paletteDrag.value = null;
}

function readPaletteDragState(event: DragEvent): PaletteDragState | null {
  if (paletteDrag.value) return paletteDrag.value;
  const raw = event.dataTransfer?.getData("application/x-flowchart-palette");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PaletteDragState;
    if (parsed.kind === "shape" && isShapeType(parsed.type)) return parsed;
    if (parsed.kind === "frame" && isFrameType(parsed.type)) return parsed;
    if (parsed.kind === "edge" && edgePresets.value.some((item) => item.kind === parsed.type)) return parsed;
  } catch {
    return null;
  }
  return null;
}

function insertShape(type: ShapeNodeType, position: { x: number; y: number }) {
  const defaults = shapeDefaults(type);
  const node: FlowchartNode = {
    id: `${type}-${Date.now()}`,
    type,
    label: "",
    parentId: null,
    position,
    style: {
      width: defaults.width,
      height: defaults.height,
      backgroundColor: defaults.backgroundColor,
      borderColor: defaults.borderColor,
      borderStyle: "solid",
    },
  };
  const nextDoc = normalizeFrameMembership({
    ...currentDocument.value,
    nodes: [...currentDocument.value.nodes, node],
    updatedAt: Date.now(),
  });
  applyDocument(nextDoc, { pushUndo: true, save: true });
  selectOnlyNode(node.id);
}

function findEdgePreset(type: EdgePresetType): EdgePreset | null {
  return edgePresets.value.find((item) => item.kind === type) ?? null;
}

function isConnectionPresetActive(preset: EdgePreset): boolean {
  return connectionTool.value?.preset.kind === preset.kind;
}

function activateConnectionTool(preset: EdgePreset) {
  connectionTool.value = {
    preset,
    stage: "select-source",
    sourceId: null,
    sourceLabel: "",
    chainedFromId: null,
  };
  vueNodes.value = vueNodes.value.map((node) => ({ ...node, selected: false }));
  vueEdges.value = vueEdges.value.map((edge) => ({ ...edge, selected: false }));
}

function setConnectionSource(source: FlowchartNode, previousSourceId: string | null) {
  connectionTool.value = {
    ...(connectionTool.value as ConnectionToolState),
    stage: "select-target",
    sourceId: source.id,
    sourceLabel: source.label || source.id,
    chainedFromId: previousSourceId,
  };
  selectOnlyNode(source.id);
}

function cancelConnectionTool() {
  connectionTool.value = null;
}

function showInvalidConnectionNode() {
  showFlowchartToast({ kind: "warn", title: t("flowchart.cannotConnectTitle"), message: t("flowchart.cannotConnectNode") });
}

function createEdgeFromPreset(
  sourceId: string,
  targetId: string,
  preset: EdgePreset,
  opts?: { selectCreatedEdge?: boolean }
) {
  pushUndoSnapshot();
  const edge: FlowchartEdge = {
    id: `edge-${sourceId}-${targetId}-${Date.now()}`,
    source: sourceId,
    target: targetId,
    label: "",
    type: preset.type,
    markerEnd: preset.markerEnd,
    style: { stroke: "#64748b", strokeWidth: 2 },
  };
  applyDocument(
    {
      ...currentDocument.value,
      edges: [...currentDocument.value.edges, edge],
      updatedAt: Date.now(),
    },
    { pushUndo: false, save: true }
  );
  if (opts?.selectCreatedEdge ?? true) {
    void nextTick(() => {
      vueEdges.value = vueEdges.value.map((item) => ({ ...item, selected: item.id === edge.id }));
      vueNodes.value = vueNodes.value.map((node) => ({ ...node, selected: false }));
    });
  }
}

function handleConnectionToolNodeClick(nodeId: string) {
  const tool = connectionTool.value;
  if (!tool) return false;
  const node = currentDocument.value.nodes.find((item) => item.id === nodeId);
  if (!node || !isConnectableNodeType(node.type)) {
    showInvalidConnectionNode();
    return true;
  }
  if (!tool.sourceId) {
    setConnectionSource(node, null);
    return true;
  }
  if (nodeId === tool.sourceId) {
    showFlowchartToast({ kind: "warn", title: t("flowchart.cannotConnectTitle"), message: t("flowchart.cannotConnectSelf") });
    return true;
  }
  createEdgeFromPreset(tool.sourceId, nodeId, tool.preset, { selectCreatedEdge: false });
  setConnectionSource(node, tool.sourceId);
  return true;
}

function onCanvasDrop(event: DragEvent) {
  const state = readPaletteDragState(event);
  paletteDrag.value = null;
  if (!state) return;
  event.preventDefault();
  if (state.kind === "shape") {
    const defaults = shapeDefaults(state.type);
    insertShape(state.type, flowPositionFromClientPoint(event.clientX, event.clientY, defaults));
    return;
  }
  if (state.kind === "frame") {
    const defaults = frameDefaults(state.type);
    insertFrame(state.type, flowPositionFromClientPoint(event.clientX, event.clientY, defaults));
    return;
  }
  const preset = findEdgePreset(state.type);
  if (preset) activateConnectionTool(preset);
}

function frameDefaults(type: FrameNodeType): { label: string; width: number; height: number; borderStyle: string } {
  return {
    frame: { label: t("flowchart.frameContainer"), width: 520, height: 320, borderStyle: "solid" },
    "lane-frame": { label: t("flowchart.frameLane"), width: 860, height: 160, borderStyle: "solid" },
    "system-frame": { label: t("flowchart.frameSystem"), width: 640, height: 360, borderStyle: "dashed" },
    "phase-frame": { label: t("flowchart.framePhase"), width: 460, height: 220, borderStyle: "dashed" },
  }[type];
}

function insertFrame(type: FrameNodeType, explicitPosition?: { x: number; y: number }) {
  const preset = frameDefaults(type);
  const canvasRect = canvasRef.value?.getBoundingClientRect();
  const viewport = getViewport();
  const fallbackIndex = currentDocument.value.nodes.filter((node) => isFrameType(node.type)).length + 1;
  const position =
    explicitPosition ??
    ({
      x: snapToGridValue(
        canvasRect
          ? (canvasRect.width / 2 - viewport.x) / viewport.zoom - preset.width / 2
          : 120 + (fallbackIndex % 3) * 80
      ),
      y: snapToGridValue(
        canvasRect
          ? (canvasRect.height / 2 - viewport.y) / viewport.zoom - preset.height / 2
          : 80 + (fallbackIndex % 3) * 60
      ),
    } as const);
  const frame: FlowchartNode = {
    id: `${type}-${Date.now()}`,
    type,
    label: preset.label,
    parentId: null,
    position,
    style: {
      width: preset.width,
      height: preset.height,
      borderStyle: preset.borderStyle,
      backgroundColor: "color-mix(in srgb, var(--surface-2) 24%, transparent)",
      borderColor: "color-mix(in srgb, var(--accent) 42%, var(--border) 58%)",
    },
  };
  applyDocument(
    {
      ...currentDocument.value,
      nodes: [frame, ...currentDocument.value.nodes],
      updatedAt: Date.now(),
    },
    { pushUndo: true, save: true }
  );
  selectOnlyNode(frame.id);
}

function targetNodesForGridLayout(): FlowchartNode[] {
  const selected = new Set(selectedNodeIds.value);
  const selectedRegular = currentDocument.value.nodes.filter(
    (node) => selected.has(node.id) && !isFrameType(node.type)
  );
  if (selectedRegular.length > 0) return selectedRegular;
  return currentDocument.value.nodes.filter((node) => !isFrameType(node.type));
}

function layoutGrid() {
  const targets = targetNodesForGridLayout();
  if (targets.length === 0) return;
  pushUndoSnapshot();
  const ordered = [...targets].sort((a, b) => {
    const ar = getNodeRect(a);
    const br = getNodeRect(b);
    return ar.y === br.y ? ar.x - br.x : ar.y - br.y;
  });
  const parentIds = new Set(ordered.map((node) => node.parentId ?? null));
  const commonParentId = parentIds.size === 1 ? (ordered[0].parentId ?? null) : null;
  const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));
  const rects = ordered.map((node) => getNodeRect(node));
  const origin =
    commonParentId && currentDocument.value.nodes.some((node) => node.id === commonParentId)
      ? { x: 40, y: 60 }
      : {
          x: snapToGridValue(Math.min(...rects.map((rect) => rect.x))),
          y: snapToGridValue(Math.min(...rects.map((rect) => rect.y))),
        };
  const nextById = new Map<string, FlowchartNode>();
  ordered.forEach((node, index) => {
    const nextPosition = {
      x: snapToGridValue(origin.x + (index % columns) * GRID_LAYOUT_CELL.width),
      y: snapToGridValue(origin.y + Math.floor(index / columns) * GRID_LAYOUT_CELL.height),
    };
    nextById.set(node.id, {
      ...node,
      parentId: commonParentId,
      position: nextPosition,
    });
  });
  const nextDoc = normalizeFrameMembership({
    ...currentDocument.value,
    nodes: currentDocument.value.nodes.map((node) => nextById.get(node.id) ?? node),
    updatedAt: Date.now(),
  });
  applyDocument(nextDoc, { pushUndo: false, save: true });
}

function normalizeFrameMembership(doc: FlowchartDocument): FlowchartDocument {
  const nodes = doc.nodes.map((node) => ({ ...node, position: { ...node.position }, style: { ...node.style } }));
  const frames = nodes.filter((node) => isFrameType(node.type));
  const frameRects = frames.map((node) => ({ node, rect: getNodeRect(node, nodes) }));
  const nextNodes = nodes.map((node) => {
    const absoluteRect = getNodeRect(node, nodes);
    if (isFrameType(node.type)) {
      return { ...node, parentId: null };
    }
    const center = {
      x: absoluteRect.x + absoluteRect.width / 2,
      y: absoluteRect.y + absoluteRect.height / 2,
    };
    const targetFrame = [...frameRects].reverse().find((item) => pointInRect(center, item.rect))?.node ?? null;
    if (!targetFrame) {
      return {
        ...node,
        parentId: null,
        position: { x: snapToGridValue(absoluteRect.x), y: snapToGridValue(absoluteRect.y) },
      };
    }
    const framePosition = getAbsolutePosition(targetFrame, nodes);
    return {
      ...node,
      parentId: targetFrame.id,
      position: {
        x: snapToGridValue(absoluteRect.x - framePosition.x),
        y: snapToGridValue(absoluteRect.y - framePosition.y),
      },
    };
  });
  return {
    ...doc,
    nodes: nextNodes,
    updatedAt: Date.now(),
  };
}

function onConnect(connection: Connection) {
  if (!connection.source || !connection.target) return;
  const source = currentDocument.value.nodes.find((node) => node.id === connection.source);
  const target = currentDocument.value.nodes.find((node) => node.id === connection.target);
  if (!isConnectableNodeType(source?.type) || !isConnectableNodeType(target?.type)) return;
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
  const current = fromVueFlow();
  const removedFrames = new Set(
    current.nodes.filter((node) => nodeIds.has(node.id) && isFrameType(node.type)).map((node) => node.id)
  );
  const currentNodes = current.nodes;
  const nextNodes = currentNodes
    .filter((node) => !nodeIds.has(node.id))
    .map((node) => {
      if (!node.parentId || !removedFrames.has(node.parentId)) return node;
      const rect = getNodeRect(node, currentNodes);
      return {
        ...node,
        parentId: null,
        position: { x: rect.x, y: rect.y },
      };
    });
  applyDocument(
    {
      ...current,
      nodes: nextNodes,
      edges: current.edges.filter(
        (edge) => !edgeIds.has(edge.id) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target)
      ),
      updatedAt: Date.now(),
    },
    { pushUndo: false, save: true }
  );
}

function copySelection() {
  const nodeIds = new Set(selectedNodeIds.value);
  clipboard.value = {
    nodes: currentDocument.value.nodes
      .filter((node) => nodeIds.has(node.id))
      .map((node) => {
        const copied = cloneDocument({ ...currentDocument.value, nodes: [node], edges: [] }).nodes[0];
        if (!copied.parentId || nodeIds.has(copied.parentId)) return copied;
        const rect = getNodeRect(copied);
        return { ...copied, parentId: null, position: { x: rect.x, y: rect.y } };
      }),
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
      parentId: null,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      style: { ...node.style },
    };
  });
  for (const node of pastedNodes) {
    const original = clipboard.value.nodes.find((item) => idMap.get(item.id) === node.id);
    node.parentId = original?.parentId ? (idMap.get(original.parentId) ?? null) : null;
  }
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
  const pastedIds = new Set(pastedNodes.map((node) => node.id));
  vueNodes.value = vueNodes.value.map((node) => ({ ...node, selected: pastedIds.has(node.id) }));
}

function getNodeElement(nodeId: string): HTMLElement | null {
  const root = canvasRef.value;
  if (!root) return null;
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(".vue-flow__node"));
  return nodes.find((node) => node.dataset.id === nodeId || node.getAttribute("data-id") === nodeId) ?? null;
}

function readGuideScreenPosition(nodeId: string, axis: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") {
  const element = getNodeElement(nodeId);
  const canvas = canvasRef.value;
  if (!element || !canvas) return null;
  const rect = element.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  if (axis === "left") return rect.left - canvasRect.left;
  if (axis === "centerX") return rect.left - canvasRect.left + rect.width / 2;
  if (axis === "right") return rect.right - canvasRect.left;
  if (axis === "top") return rect.top - canvasRect.top;
  if (axis === "centerY") return rect.top - canvasRect.top + rect.height / 2;
  return rect.bottom - canvasRect.top;
}

function applyDragSnap(draggedIds: Set<string>, delta: { x: number; y: number }) {
  if (suppressDragSnap.value || (Math.abs(delta.x) < 0.1 && Math.abs(delta.y) < 0.1)) return;
  suppressDragSnap.value = true;
  vueNodes.value = vueNodes.value.map((node) =>
    draggedIds.has(node.id)
      ? {
          ...node,
          position: {
            x: node.position.x + delta.x,
            y: node.position.y + delta.y,
          },
        }
      : node
  );
  void nextTick(() => {
    suppressDragSnap.value = false;
  });
}

function onNodeDrag(event: NodeDragEvent) {
  if (suppressDragSnap.value) return;
  const current = fromVueFlow();
  const draggedIds = new Set(event.nodes.map((node) => node.id));
  const primary = current.nodes.find((node) => node.id === event.node.id);
  if (!primary) return;
  const primaryRect = getNodeRect(primary, current.nodes);
  const draggedFrameIds = new Set(
    current.nodes.filter((node) => draggedIds.has(node.id) && isFrameType(node.type)).map((node) => node.id)
  );
  const candidates = current.nodes.filter(
    (node) => !draggedIds.has(node.id) && (!node.parentId || !draggedFrameIds.has(node.parentId))
  );
  const primaryX = [
    { axis: "left" as const, value: primaryRect.x },
    { axis: "centerX" as const, value: primaryRect.x + primaryRect.width / 2 },
    { axis: "right" as const, value: primaryRect.x + primaryRect.width },
  ];
  const primaryY = [
    { axis: "top" as const, value: primaryRect.y },
    { axis: "centerY" as const, value: primaryRect.y + primaryRect.height / 2 },
    { axis: "bottom" as const, value: primaryRect.y + primaryRect.height },
  ];
  let bestX: { delta: number; nodeId: string; axis: "left" | "centerX" | "right"; distance: number } | null = null;
  let bestY: { delta: number; nodeId: string; axis: "top" | "centerY" | "bottom"; distance: number } | null = null;
  for (const candidate of candidates) {
    const rect = getNodeRect(candidate, current.nodes);
    const candidateX = [
      { axis: "left" as const, value: rect.x },
      { axis: "centerX" as const, value: rect.x + rect.width / 2 },
      { axis: "right" as const, value: rect.x + rect.width },
    ];
    const candidateY = [
      { axis: "top" as const, value: rect.y },
      { axis: "centerY" as const, value: rect.y + rect.height / 2 },
      { axis: "bottom" as const, value: rect.y + rect.height },
    ];
    for (const target of candidateX) {
      for (const source of primaryX) {
        const delta = target.value - source.value;
        const distance = Math.abs(delta);
        if (distance <= ALIGNMENT_THRESHOLD_PX && (!bestX || distance < bestX.distance)) {
          bestX = { delta, nodeId: candidate.id, axis: target.axis, distance };
        }
      }
    }
    for (const target of candidateY) {
      for (const source of primaryY) {
        const delta = target.value - source.value;
        const distance = Math.abs(delta);
        if (distance <= ALIGNMENT_THRESHOLD_PX && (!bestY || distance < bestY.distance)) {
          bestY = { delta, nodeId: candidate.id, axis: target.axis, distance };
        }
      }
    }
  }
  const xScreen = bestX ? readGuideScreenPosition(bestX.nodeId, bestX.axis) : null;
  const yScreen = bestY ? readGuideScreenPosition(bestY.nodeId, bestY.axis) : null;
  alignmentGuides.value = {
    x: xScreen == null ? [] : [{ id: `${bestX?.nodeId}-${bestX?.axis}`, screen: xScreen }],
    y: yScreen == null ? [] : [{ id: `${bestY?.nodeId}-${bestY?.axis}`, screen: yScreen }],
  };
  applyDragSnap(draggedIds, { x: bestX?.delta ?? 0, y: bestY?.delta ?? 0 });
}

function onNodeDragStop() {
  alignmentGuides.value = { x: [], y: [] };
  const nextDoc = normalizeFrameMembership(fromVueFlow());
  applyDocument(nextDoc, { pushUndo: false, save: true });
}

function onNodeClick(event: NodeMouseEvent) {
  if (handleConnectionToolNodeClick(event.node.id)) {
    event.event.preventDefault();
  }
}

function onPaneClick() {
  if (connectionTool.value) {
    cancelConnectionTool();
    return;
  }
  syncFromVueFlow();
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
              label: selectedNodeDraft.label.trim(),
              style: {
                ...item.style,
                backgroundColor: selectedNodeDraft.backgroundColor,
                borderColor: selectedNodeDraft.borderColor,
                borderStyle: selectedNodeDraft.borderStyle === "dashed" ? "dashed" : "solid",
                ...(hasDimensionControls(item.type)
                  ? {
                      width: normalizeNodeDimension(selectedNodeDraft.width, getNodeSize(item).width, 160, 1800),
                      height: normalizeNodeDimension(selectedNodeDraft.height, getNodeSize(item).height, 100, 1200),
                    }
                  : {}),
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
              type: normalizeFlowchartEdgeType(selectedEdgeDraft.type),
              markerEnd: selectedEdgeDraft.markerEnd,
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
    showFlowchartToast({
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
  openFeatureSettings("flowchart");
}

function onWorkbenchKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
  if (event.key === "Escape" && connectionTool.value) {
    cancelConnectionTool();
    event.preventDefault();
    return;
  }
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
