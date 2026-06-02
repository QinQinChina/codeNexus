export type LocalImageGenerationSettings = {
  enabled: boolean;
  baseUrl: string | null;
  apiKey: string | null;
  model: string;
  defaultSize: string;
  defaultQuality: string;
  outputFormat: string;
  defaultBackground: string;
  defaultModeration: string;
  outputCompression: number;
  timeoutMs: number;
  maxImages: number;
};

export const DEFAULT_IMAGE_GENERATION_MODEL = "gpt-image-2";
export const DEFAULT_IMAGE_GENERATION_SIZE = "1024x1024";
export const DEFAULT_IMAGE_GENERATION_QUALITY = "auto";
export const DEFAULT_IMAGE_GENERATION_OUTPUT_FORMAT = "png";
export const DEFAULT_IMAGE_GENERATION_BACKGROUND = "auto";
export const DEFAULT_IMAGE_GENERATION_MODERATION = "auto";
export const DEFAULT_IMAGE_GENERATION_OUTPUT_COMPRESSION = 100;
export const MIN_IMAGE_GENERATION_OUTPUT_COMPRESSION = 0;
export const MAX_IMAGE_GENERATION_OUTPUT_COMPRESSION = 100;
export const DEFAULT_IMAGE_GENERATION_TIMEOUT_MS = 120_000;
export const MIN_IMAGE_GENERATION_TIMEOUT_MS = 10_000;
export const MAX_IMAGE_GENERATION_TIMEOUT_MS = 600_000;
export const DEFAULT_IMAGE_GENERATION_MAX_IMAGES = 1;
export const MIN_IMAGE_GENERATION_MAX_IMAGES = 1;
export const MAX_IMAGE_GENERATION_MAX_IMAGES = 4;

export const DEFAULT_LOCAL_IMAGE_GENERATION_SETTINGS: LocalImageGenerationSettings = {
  enabled: false,
  baseUrl: null,
  apiKey: null,
  model: DEFAULT_IMAGE_GENERATION_MODEL,
  defaultSize: DEFAULT_IMAGE_GENERATION_SIZE,
  defaultQuality: DEFAULT_IMAGE_GENERATION_QUALITY,
  outputFormat: DEFAULT_IMAGE_GENERATION_OUTPUT_FORMAT,
  defaultBackground: DEFAULT_IMAGE_GENERATION_BACKGROUND,
  defaultModeration: DEFAULT_IMAGE_GENERATION_MODERATION,
  outputCompression: DEFAULT_IMAGE_GENERATION_OUTPUT_COMPRESSION,
  timeoutMs: DEFAULT_IMAGE_GENERATION_TIMEOUT_MS,
  maxImages: DEFAULT_IMAGE_GENERATION_MAX_IMAGES,
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function toImagegenNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

export function normalizeImagegenHttpBaseUrl(value: unknown): string | null {
  const text = toImagegenNullableText(value);
  if (!text) return null;
  const trimmed = text.replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export function normalizeImagegenOutputFormat(value: unknown): string {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (text === "jpg") return "jpeg";
  if (text === "jpeg" || text === "webp" || text === "png") return text;
  return DEFAULT_IMAGE_GENERATION_OUTPUT_FORMAT;
}

export function normalizeImagegenBackground(value: unknown): string {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (text === "transparent" || text === "opaque" || text === "auto") return text;
  return DEFAULT_IMAGE_GENERATION_BACKGROUND;
}

export function normalizeImagegenModeration(value: unknown): string {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (text === "low" || text === "auto") return text;
  return DEFAULT_IMAGE_GENERATION_MODERATION;
}

export function clampImagegenInteger(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function normalizeImageGenerationSettings(value: unknown): LocalImageGenerationSettings {
  const record = toRecord(value);
  return {
    enabled:
      typeof record?.enabled === "boolean"
        ? record.enabled
        : DEFAULT_LOCAL_IMAGE_GENERATION_SETTINGS.enabled,
    baseUrl: normalizeImagegenHttpBaseUrl(record?.baseUrl),
    apiKey: toImagegenNullableText(record?.apiKey),
    model: toImagegenNullableText(record?.model) ?? DEFAULT_IMAGE_GENERATION_MODEL,
    defaultSize: toImagegenNullableText(record?.defaultSize) ?? DEFAULT_IMAGE_GENERATION_SIZE,
    defaultQuality: toImagegenNullableText(record?.defaultQuality) ?? DEFAULT_IMAGE_GENERATION_QUALITY,
    outputFormat: normalizeImagegenOutputFormat(record?.outputFormat),
    defaultBackground: normalizeImagegenBackground(record?.defaultBackground),
    defaultModeration: normalizeImagegenModeration(record?.defaultModeration),
    outputCompression: clampImagegenInteger(
      record?.outputCompression,
      DEFAULT_IMAGE_GENERATION_OUTPUT_COMPRESSION,
      MIN_IMAGE_GENERATION_OUTPUT_COMPRESSION,
      MAX_IMAGE_GENERATION_OUTPUT_COMPRESSION
    ),
    timeoutMs: clampImagegenInteger(
      record?.timeoutMs,
      DEFAULT_IMAGE_GENERATION_TIMEOUT_MS,
      MIN_IMAGE_GENERATION_TIMEOUT_MS,
      MAX_IMAGE_GENERATION_TIMEOUT_MS
    ),
    maxImages: clampImagegenInteger(
      record?.maxImages,
      DEFAULT_IMAGE_GENERATION_MAX_IMAGES,
      MIN_IMAGE_GENERATION_MAX_IMAGES,
      MAX_IMAGE_GENERATION_MAX_IMAGES
    ),
  };
}

export function cloneImageGenerationSettings(value: unknown): LocalImageGenerationSettings {
  return normalizeImageGenerationSettings(value);
}

export function resolveImageGenerationEndpointPreview(
  baseUrlValue: unknown,
  kind: "generations" | "edits"
): string {
  const baseUrl = normalizeImagegenHttpBaseUrl(baseUrlValue);
  if (!baseUrl) return "-";
  if (/\/images\/(generations|edits)$/i.test(baseUrl)) {
    return baseUrl.replace(/\/images\/(generations|edits)$/i, `/images/${kind}`);
  }
  if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/images/${kind}`;
  return `${baseUrl}/v1/images/${kind}`;
}