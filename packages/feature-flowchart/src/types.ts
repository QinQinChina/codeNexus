export type FlowchartTemplateType = "basic" | "swimlane" | "architecture" | "org" | "sequence";

export type FlowchartPosition = {
  x: number;
  y: number;
};

export type FlowchartViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type FlowchartStyle = Record<string, string | number | boolean | null>;
export type FlowchartEdgeType = "straight" | "smoothstep";

export type FlowchartNode = {
  id: string;
  type: string;
  label: string;
  parentId?: string | null;
  position: FlowchartPosition;
  style: FlowchartStyle;
};

export type FlowchartEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  type?: FlowchartEdgeType;
  markerEnd?: boolean;
  style: FlowchartStyle;
};

export type FlowchartDocument = {
  id: string;
  title: string;
  templateType: FlowchartTemplateType;
  prompt: string;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  viewport: FlowchartViewport;
  createdAt: number;
  updatedAt: number;
};

export type FlowchartValidationResult = {
  document: FlowchartDocument;
  errors: string[];
};

export type FlowchartHistoryListResult = {
  items: FlowchartDocument[];
};

export type FlowchartHistoryUpsertResult = {
  ok: true;
  item: FlowchartDocument;
  items: FlowchartDocument[];
};

export type FlowchartHistoryDeleteResult = {
  ok: true;
  deleted: boolean;
  items: FlowchartDocument[];
};

export type FlowchartAiRunArgs = {
  operation: "generate" | "modify";
  templateType: FlowchartTemplateType;
  prompt: string;
  currentDocument?: FlowchartDocument | null;
};

export type FlowchartAiRunResult =
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
    };

export const FLOWCHART_TEMPLATE_TYPES: FlowchartTemplateType[] = [
  "basic",
  "swimlane",
  "architecture",
  "org",
  "sequence",
];

export const DEFAULT_FLOWCHART_TEMPLATE_TYPE: FlowchartTemplateType = "basic";
export const DEFAULT_FLOWCHART_AI_MODEL = "gpt-4o-mini";
export const DEFAULT_FLOWCHART_AI_TIMEOUT_MS = 60_000;
export const MIN_FLOWCHART_AI_TIMEOUT_MS = 10_000;
export const MAX_FLOWCHART_AI_TIMEOUT_MS = 300_000;

const POSITION_MIN = -2400;
const POSITION_MAX = 4800;

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toNonEmptyString(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function toStringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function toTimestamp(value: unknown, fallback = Date.now()): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

function toNumberInRange(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function normalizeFlowchartTemplateType(value: unknown): FlowchartTemplateType {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return FLOWCHART_TEMPLATE_TYPES.includes(raw as FlowchartTemplateType)
    ? (raw as FlowchartTemplateType)
    : DEFAULT_FLOWCHART_TEMPLATE_TYPE;
}

export function normalizeFlowchartEdgeType(value: unknown): FlowchartEdgeType {
  return toStringValue(value).toLowerCase() === "straight" ? "straight" : "smoothstep";
}

function normalizeStyle(value: unknown): FlowchartStyle {
  const record = toRecord(value);
  const style: FlowchartStyle = {};
  for (const [rawKey, rawValue] of Object.entries(record ?? {})) {
    const key = String(rawKey ?? "").trim();
    if (!key) continue;
    if (
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      rawValue === null
    ) {
      style[key] = rawValue;
    }
  }
  return style;
}

function nextGridPosition(index: number): FlowchartPosition {
  return {
    x: 80 + (index % 4) * 220,
    y: 80 + Math.floor(index / 4) * 140,
  };
}

function normalizeNode(value: unknown, index: number, seenIds: Set<string>, errors: string[]): FlowchartNode | null {
  const record = toRecord(value);
  if (!record) {
    errors.push(`nodes[${index}] is not an object`);
    return null;
  }
  const rawId = toStringValue(record.id) || `node-${index + 1}`;
  let id = rawId.replace(/\s+/g, "-");
  if (seenIds.has(id)) {
    const base = id || "node";
    let suffix = 2;
    while (seenIds.has(`${base}-${suffix}`)) suffix += 1;
    id = `${base}-${suffix}`;
    errors.push(`duplicate node id "${rawId}" renamed to "${id}"`);
  }
  seenIds.add(id);

  const positionRecord = toRecord(record.position);
  const fallback = nextGridPosition(index);
  if (!positionRecord) errors.push(`node "${id}" missing position; default grid position applied`);
  const x = toNumberInRange(positionRecord?.x, fallback.x, POSITION_MIN, POSITION_MAX);
  const y = toNumberInRange(positionRecord?.y, fallback.y, POSITION_MIN, POSITION_MAX);
  if (positionRecord && (x !== Number(positionRecord.x) || y !== Number(positionRecord.y))) {
    errors.push(`node "${id}" position clamped into safe canvas bounds`);
  }

  return {
    id,
    type: toNonEmptyString(record.type, "default"),
    label: hasOwn(record, "label") ? toStringValue(record.label) : id,
    parentId: toStringValue(record.parentId) || null,
    position: { x, y },
    style: normalizeStyle(record.style),
  };
}

function normalizeEdge(
  value: unknown,
  index: number,
  nodeIds: Set<string>,
  seenIds: Set<string>,
  errors: string[]
): FlowchartEdge | null {
  const record = toRecord(value);
  if (!record) {
    errors.push(`edges[${index}] is not an object`);
    return null;
  }
  const source = toStringValue(record.source);
  const target = toStringValue(record.target);
  if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) {
    errors.push(`edge "${toStringValue(record.id) || index + 1}" references missing source or target`);
    return null;
  }
  const rawId = toStringValue(record.id) || `edge-${source}-${target}-${index + 1}`;
  let id = rawId.replace(/\s+/g, "-");
  if (seenIds.has(id)) {
    const base = id || "edge";
    let suffix = 2;
    while (seenIds.has(`${base}-${suffix}`)) suffix += 1;
    id = `${base}-${suffix}`;
    errors.push(`duplicate edge id "${rawId}" renamed to "${id}"`);
  }
  seenIds.add(id);
  return {
    id,
    source,
    target,
    label: toStringValue(record.label),
    type: normalizeFlowchartEdgeType(record.type),
    markerEnd: record.markerEnd === false ? false : true,
    style: normalizeStyle(record.style),
  };
}

export function normalizeFlowchartDocument(
  value: unknown,
  fallback?: Partial<FlowchartDocument>
): FlowchartValidationResult {
  const root = toRecord(value);
  const now = Date.now();
  const errors: string[] = [];
  if (!root) errors.push("document root is not an object");

  const nodeIds = new Set<string>();
  const nodesSource = Array.isArray(root?.nodes) ? root.nodes : (fallback?.nodes ?? []);
  if (!Array.isArray(root?.nodes)) errors.push("nodes must be an array");
  const nodes = nodesSource
    .map((node, index) => normalizeNode(node, index, nodeIds, errors))
    .filter((node): node is FlowchartNode => Boolean(node));
  for (const node of nodes) {
    if (!node.parentId) continue;
    if (node.parentId === node.id || !nodeIds.has(node.parentId)) {
      errors.push(`node "${node.id}" references missing parent "${node.parentId}"`);
      node.parentId = null;
    }
  }

  const edgeIds = new Set<string>();
  const edgesSource = Array.isArray(root?.edges) ? root.edges : (fallback?.edges ?? []);
  if (!Array.isArray(root?.edges)) errors.push("edges must be an array");
  const edges = edgesSource
    .map((edge, index) => normalizeEdge(edge, index, nodeIds, edgeIds, errors))
    .filter((edge): edge is FlowchartEdge => Boolean(edge));

  if (nodes.length === 0) errors.push("document must contain at least one node");

  const viewportRecord = toRecord(root?.viewport);
  const viewport = {
    x: toNumberInRange(viewportRecord?.x, fallback?.viewport?.x ?? 0, -10_000, 10_000),
    y: toNumberInRange(viewportRecord?.y, fallback?.viewport?.y ?? 0, -10_000, 10_000),
    zoom: toNumberInRange(viewportRecord?.zoom, fallback?.viewport?.zoom ?? 1, 0.2, 2.5),
  };

  return {
    document: {
      id: toNonEmptyString(root?.id, fallback?.id ?? `flowchart-${now}`),
      title: toNonEmptyString(root?.title, fallback?.title ?? "Untitled flowchart"),
      templateType: normalizeFlowchartTemplateType(root?.templateType ?? fallback?.templateType),
      prompt: toStringValue(root?.prompt ?? fallback?.prompt),
      nodes,
      edges,
      viewport,
      createdAt: toTimestamp(root?.createdAt, fallback?.createdAt ?? now),
      updatedAt: toTimestamp(root?.updatedAt, now),
    },
    errors,
  };
}

export function createDefaultFlowchartDocument(
  templateType: FlowchartTemplateType = DEFAULT_FLOWCHART_TEMPLATE_TYPE,
  prompt = ""
): FlowchartDocument {
  const now = Date.now();
  const presets: Record<FlowchartTemplateType, Pick<FlowchartDocument, "title" | "nodes" | "edges">> = {
    basic: {
      title: "Basic Flow",
      nodes: [
        { id: "start", type: "start", label: "Start", position: { x: 80, y: 160 }, style: { tone: "green" } },
        { id: "process", type: "process", label: "Process", position: { x: 330, y: 160 }, style: { tone: "blue" } },
        { id: "end", type: "end", label: "End", position: { x: 580, y: 160 }, style: { tone: "gray" } },
      ],
      edges: [
        { id: "start-process", source: "start", target: "process", label: "", style: {} },
        { id: "process-end", source: "process", target: "end", label: "", style: {} },
      ],
    },
    swimlane: {
      title: "Swimlane Flow",
      nodes: [
        { id: "lane-a", type: "lane", label: "Requester", position: { x: 40, y: 40 }, style: { width: 860 } },
        { id: "lane-b", type: "lane", label: "Approver", position: { x: 40, y: 220 }, style: { width: 860 } },
        { id: "submit", type: "process", label: "Submit request", position: { x: 180, y: 110 }, style: {} },
        { id: "review", type: "decision", label: "Review", position: { x: 450, y: 290 }, style: {} },
      ],
      edges: [{ id: "submit-review", source: "submit", target: "review", label: "", style: {} }],
    },
    architecture: {
      title: "System Architecture",
      nodes: [
        { id: "client", type: "system", label: "Client", position: { x: 80, y: 120 }, style: { tone: "blue" } },
        { id: "api", type: "system", label: "API Gateway", position: { x: 330, y: 120 }, style: { tone: "teal" } },
        { id: "service", type: "system", label: "Service", position: { x: 580, y: 80 }, style: { tone: "orange" } },
        { id: "db", type: "database", label: "Database", position: { x: 580, y: 220 }, style: { tone: "gray" } },
      ],
      edges: [
        { id: "client-api", source: "client", target: "api", label: "HTTPS", style: {} },
        { id: "api-service", source: "api", target: "service", label: "RPC", style: {} },
        { id: "service-db", source: "service", target: "db", label: "SQL", style: {} },
      ],
    },
    org: {
      title: "Organization Chart",
      nodes: [
        { id: "ceo", type: "person", label: "CEO", position: { x: 360, y: 40 }, style: {} },
        { id: "product", type: "person", label: "Product", position: { x: 190, y: 190 }, style: {} },
        { id: "engineering", type: "person", label: "Engineering", position: { x: 530, y: 190 }, style: {} },
      ],
      edges: [
        { id: "ceo-product", source: "ceo", target: "product", label: "", style: {} },
        { id: "ceo-engineering", source: "ceo", target: "engineering", label: "", style: {} },
      ],
    },
    sequence: {
      title: "Sequence Diagram",
      nodes: [
        { id: "user", type: "actor", label: "User", position: { x: 100, y: 80 }, style: {} },
        { id: "frontend", type: "lifeline", label: "Frontend", position: { x: 360, y: 80 }, style: {} },
        { id: "backend", type: "lifeline", label: "Backend", position: { x: 620, y: 80 }, style: {} },
      ],
      edges: [
        { id: "user-frontend", source: "user", target: "frontend", label: "Request", style: { dashed: false } },
        { id: "frontend-backend", source: "frontend", target: "backend", label: "API call", style: { dashed: false } },
      ],
    },
  };
  const preset = presets[templateType] ?? presets.basic;
  return {
    id: `flowchart-${now}`,
    title: preset.title,
    templateType,
    prompt,
    nodes: preset.nodes.map((node) => ({ ...node, position: { ...node.position }, style: { ...node.style } })),
    edges: preset.edges.map((edge) => ({ ...edge, style: { ...edge.style } })),
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: now,
    updatedAt: now,
  };
}
