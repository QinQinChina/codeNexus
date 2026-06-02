import {
  DEFAULT_FLOWCHART_AI_MODEL,
  DEFAULT_FLOWCHART_AI_TIMEOUT_MS,
  MAX_FLOWCHART_AI_TIMEOUT_MS,
  MIN_FLOWCHART_AI_TIMEOUT_MS,
} from "./types";

export type LocalFlowchartAiSettings = {
  enabled: boolean;
  baseUrl: string | null;
  apiKey: string | null;
  model: string;
  timeoutMs: number;
};

export {
  DEFAULT_FLOWCHART_AI_MODEL,
  DEFAULT_FLOWCHART_AI_TIMEOUT_MS,
  MAX_FLOWCHART_AI_TIMEOUT_MS,
  MIN_FLOWCHART_AI_TIMEOUT_MS,
};

export const DEFAULT_LOCAL_FLOWCHART_AI_SETTINGS: LocalFlowchartAiSettings = {
  enabled: false,
  baseUrl: null,
  apiKey: null,
  model: DEFAULT_FLOWCHART_AI_MODEL,
  timeoutMs: DEFAULT_FLOWCHART_AI_TIMEOUT_MS,
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function toFlowchartNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

export function normalizeFlowchartHttpBaseUrl(value: unknown): string | null {
  const text = toFlowchartNullableText(value);
  if (!text) return null;
  const trimmed = text.replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export function clampFlowchartInteger(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function normalizeFlowchartAiSettings(value: unknown): LocalFlowchartAiSettings {
  const record = toRecord(value);
  return {
    enabled:
      typeof record?.enabled === "boolean" ? record.enabled : DEFAULT_LOCAL_FLOWCHART_AI_SETTINGS.enabled,
    baseUrl: normalizeFlowchartHttpBaseUrl(record?.baseUrl),
    apiKey: toFlowchartNullableText(record?.apiKey),
    model: toFlowchartNullableText(record?.model) ?? DEFAULT_FLOWCHART_AI_MODEL,
    timeoutMs: clampFlowchartInteger(
      record?.timeoutMs,
      DEFAULT_FLOWCHART_AI_TIMEOUT_MS,
      MIN_FLOWCHART_AI_TIMEOUT_MS,
      MAX_FLOWCHART_AI_TIMEOUT_MS
    ),
  };
}

export function cloneFlowchartAiSettings(value: unknown): LocalFlowchartAiSettings {
  return normalizeFlowchartAiSettings(value);
}

export function resolveFlowchartAiEndpointPreview(baseUrlValue: unknown): string {
  const baseUrl = normalizeFlowchartHttpBaseUrl(baseUrlValue);
  if (!baseUrl) return "-";
  if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl;
  if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}