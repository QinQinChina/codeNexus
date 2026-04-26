import type {
  McpResourceContentState,
  McpResourceParameterEntry,
  McpResourceTemplateDraftState,
  McpServerState,
} from "../types";

export type McpResourceSourceTab = "resources" | "templates";

export type McpResourceTimelineContent = {
  uri: string;
  mimeType: string;
  kind: "text" | "blob";
  previewText: string;
  sizeBytes: number;
};

const SIMPLE_MCP_TEMPLATE_EXPR_RE = /\{([^{}]+)\}/g;

export function toMcpResourceSourceTab(value: unknown): McpResourceSourceTab {
  return String(value ?? "")
    .trim()
    .toLowerCase() === "templates"
    ? "templates"
    : "resources";
}

export function normalizeMcpResourceText(value: unknown): string {
  return String(value ?? "").trim();
}

export function analyzeMcpTemplateVariables(templateValue: unknown): string[] {
  const template = String(templateValue ?? "");
  const variables: string[] = [];
  let match: RegExpExecArray | null = null;
  SIMPLE_MCP_TEMPLATE_EXPR_RE.lastIndex = 0;
  while ((match = SIMPLE_MCP_TEMPLATE_EXPR_RE.exec(template)) !== null) {
    const expression = String(match[1] ?? "").trim();
    if (!expression) continue;
    const hasComplexSyntax =
      /^[+#./;?&]/.test(expression) || expression.includes(",") || expression.includes("*") || expression.includes(":");
    const candidateParts = (hasComplexSyntax ? expression.replace(/^[+#./;?&]/, "") : expression)
      .split(",")
      .map((item) => item.replace(/[:*].*$/, "").trim())
      .filter(Boolean);
    for (const part of candidateParts) {
      if (!/^[A-Za-z0-9_.-]+$/.test(part)) continue;
      if (!variables.includes(part)) variables.push(part);
    }
  }
  return variables;
}

export function buildResolvedMcpTemplateUri(templateValue: unknown, values: Record<string, string>): string {
  const template = String(templateValue ?? "");
  SIMPLE_MCP_TEMPLATE_EXPR_RE.lastIndex = 0;
  return template.replace(SIMPLE_MCP_TEMPLATE_EXPR_RE, (_, expr: string) => {
    const key = String(expr ?? "").trim();
    const value = normalizeMcpResourceText(values[key]);
    return value ? encodeURIComponent(value) : `{${key}}`;
  });
}

export function buildMcpResourceReadSummary(params: {
  serverKey: string;
  uri: string;
  sourceTab: McpResourceSourceTab;
  templateKey: string;
  servers: McpServerState[];
  getTemplateDraft: (templateKey: string) => McpResourceTemplateDraftState | undefined;
}): {
  resourceLabel: string;
  toolNames: string[];
  parameterEntries: McpResourceParameterEntry[];
} {
  const server = params.servers.find((item) => normalizeMcpResourceText(item?.id) === params.serverKey) ?? null;
  const toolNames = (server?.tools ?? [])
    .map((tool) => normalizeMcpResourceText(tool?.title) || normalizeMcpResourceText(tool?.name))
    .filter(Boolean);

  if (params.sourceTab === "templates") {
    const template =
      server?.resourceTemplates.find((item) => normalizeMcpResourceText(item?.uriTemplate) === params.templateKey) ??
      null;
    const resourceLabel =
      normalizeMcpResourceText(template?.title) ||
      normalizeMcpResourceText(template?.name) ||
      normalizeMcpResourceText(template?.uriTemplate) ||
      params.uri;
    const draft = params.templateKey
      ? (params.getTemplateDraft(params.templateKey) ?? { values: {}, manualUri: "" })
      : { values: {}, manualUri: "" };
    const templateValue = normalizeMcpResourceText(template?.uriTemplate) || params.templateKey;
    const variableNames = analyzeMcpTemplateVariables(templateValue);
    const parameterEntries: McpResourceParameterEntry[] = variableNames.map((name) => ({
      key: name,
      value: normalizeMcpResourceText(draft.values?.[name] ?? ""),
    }));
    const manualUri = normalizeMcpResourceText(draft.manualUri);
    const resolvedUri =
      manualUri || normalizeMcpResourceText(buildResolvedMcpTemplateUri(templateValue, draft.values ?? {}));
    if (manualUri) {
      parameterEntries.push({ key: "manualUri", value: manualUri });
    }
    if (resolvedUri && resolvedUri !== manualUri) {
      parameterEntries.push({ key: "resolvedUri", value: resolvedUri });
    }
    return { resourceLabel, toolNames, parameterEntries };
  }

  const resource = server?.resources.find((item) => normalizeMcpResourceText(item?.uri) === params.uri) ?? null;
  const resourceLabel =
    normalizeMcpResourceText(resource?.title) ||
    normalizeMcpResourceText(resource?.name) ||
    normalizeMcpResourceText(resource?.uri) ||
    params.uri;
  return {
    resourceLabel,
    toolNames,
    parameterEntries: [],
  };
}

export function estimateBase64ByteLength(base64: string): number {
  const raw = String(base64 ?? "").trim();
  if (!raw) return 0;
  const padding = raw.endsWith("==") ? 2 : raw.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((raw.length * 3) / 4) - padding);
}

export function summarizeTextPreview(value: unknown, maxChars = 220): string {
  const text =
    String(value ?? "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? String(value ?? "").trim();
  if (!text) return "";
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

export function toMcpResourceTimelineContents(contents: McpResourceContentState[]): McpResourceTimelineContent[] {
  return (contents ?? []).map((content) => {
    const uri = String(content?.uri ?? "").trim();
    const mimeType = String((content as { mimeType?: unknown }).mimeType ?? "").trim();
    if (typeof (content as { text?: unknown }).text === "string") {
      return {
        uri,
        mimeType,
        kind: "text",
        previewText: summarizeTextPreview((content as { text: string }).text),
        sizeBytes: Math.max(0, String((content as { text: string }).text ?? "").length),
      };
    }
    const blob = String((content as { blob?: unknown }).blob ?? "");
    return {
      uri,
      mimeType,
      kind: "blob",
      previewText: /^image\//i.test(mimeType) ? "图片内容" : "",
      sizeBytes: estimateBase64ByteLength(blob),
    };
  });
}

export function summarizeMcpResourceMimeTypes(contents: McpResourceTimelineContent[]): string {
  const counts = new Map<string, number>();
  for (const content of contents) {
    const key = content.mimeType || (content.kind === "text" ? "text/plain" : "application/octet-stream");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .slice(0, 3)
    .map(([mimeType, count]) => (count > 1 ? `${mimeType} ×${count}` : mimeType))
    .join(" ｜ ");
}
