import type { ReasoningEffort } from "../generated/codex-app-server/ReasoningEffort";

export type CodexProviderProfile = {
  id: string;
  name: string;
  modelProviderId: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  modelReasoningEffort: ReasoningEffort;
  modelContextWindow: number | null;
  modelAutoCompactTokenLimit: number | null;
  createdAt: number;
  updatedAt: number;
};

export type CodexProviderProfileInput = Partial<
  Pick<
    CodexProviderProfile,
    | "id"
    | "name"
    | "modelProviderId"
    | "model"
    | "baseUrl"
    | "apiKey"
    | "modelReasoningEffort"
    | "modelContextWindow"
    | "modelAutoCompactTokenLimit"
  >
>;

export type CodexProviderProfilesState = {
  version: 1;
  activeProfileId: string | null;
  profiles: CodexProviderProfile[];
};

export const DEFAULT_CODEX_PROFILE_MODEL = "gpt-5.4";
export const DEFAULT_CODEX_PROFILE_REASONING_EFFORT: ReasoningEffort = "high";

const VALID_REASONING_EFFORTS = new Set<ReasoningEffort>(["low", "medium", "high", "xhigh"]);

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNullablePositiveInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded > 0 ? rounded : null;
}

export function normalizeCodexProviderId(value: unknown, fallback = "custom"): string {
  const raw = normalizeText(value).toLowerCase();
  const cleaned = raw
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, 64);
  return cleaned || fallback;
}

export function normalizeCodexProfileId(value: unknown): string {
  return normalizeCodexProviderId(value, "");
}

export function normalizeCodexProfileName(value: unknown, fallback = "Custom Provider"): string {
  const text = normalizeText(value).slice(0, 80);
  return text || fallback;
}

export function normalizeCodexProfileModel(value: unknown): string {
  return normalizeText(value) || DEFAULT_CODEX_PROFILE_MODEL;
}

export function normalizeCodexProfileReasoningEffort(value: unknown): ReasoningEffort {
  const raw = normalizeText(value).toLowerCase() as ReasoningEffort;
  return VALID_REASONING_EFFORTS.has(raw) ? raw : DEFAULT_CODEX_PROFILE_REASONING_EFFORT;
}

export function createDefaultCodexProviderProfilesState(): CodexProviderProfilesState {
  return {
    version: 1,
    activeProfileId: null,
    profiles: [],
  };
}

export function normalizeCodexProviderProfile(value: unknown): CodexProviderProfile | null {
  const record = toRecord(value);
  if (!record) return null;
  const id = normalizeCodexProfileId(record.id);
  const modelProviderId = normalizeCodexProviderId(record.modelProviderId ?? id);
  const baseUrl = normalizeText(record.baseUrl);
  const apiKey = normalizeText(record.apiKey);
  if (!id || !modelProviderId || !baseUrl) return null;
  const createdAt = Number(record.createdAt);
  const updatedAt = Number(record.updatedAt);
  return {
    id,
    name: normalizeCodexProfileName(record.name, modelProviderId),
    modelProviderId,
    model: normalizeCodexProfileModel(record.model),
    baseUrl,
    apiKey,
    modelReasoningEffort: normalizeCodexProfileReasoningEffort(record.modelReasoningEffort),
    modelContextWindow: normalizeNullablePositiveInt(record.modelContextWindow),
    modelAutoCompactTokenLimit: normalizeNullablePositiveInt(record.modelAutoCompactTokenLimit),
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? Math.round(createdAt) : Date.now(),
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? Math.round(updatedAt) : Date.now(),
  };
}

export function normalizeCodexProviderProfilesState(value: unknown): CodexProviderProfilesState {
  const root = toRecord(value);
  const profilesRaw = Array.isArray(root?.profiles) ? root.profiles : [];
  const byId = new Map<string, CodexProviderProfile>();
  for (const item of profilesRaw) {
    const profile = normalizeCodexProviderProfile(item);
    if (!profile) continue;
    byId.set(profile.id, profile);
  }
  const profiles = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  const activeRaw = normalizeCodexProfileId(root?.activeProfileId);
  return {
    version: 1,
    activeProfileId: activeRaw && profiles.some((item) => item.id === activeRaw) ? activeRaw : null,
    profiles,
  };
}

export function buildCodexProviderProfile(input: CodexProviderProfileInput, existing?: CodexProviderProfile): CodexProviderProfile {
  const now = Date.now();
  const modelProviderId = normalizeCodexProviderId(input.modelProviderId ?? existing?.modelProviderId ?? input.name);
  const id = normalizeCodexProfileId(input.id ?? existing?.id ?? modelProviderId);
  return {
    id: id || modelProviderId,
    name: normalizeCodexProfileName(input.name ?? existing?.name, modelProviderId),
    modelProviderId,
    model: normalizeCodexProfileModel(input.model ?? existing?.model),
    baseUrl: normalizeText(input.baseUrl ?? existing?.baseUrl),
    apiKey: normalizeText(input.apiKey ?? existing?.apiKey),
    modelReasoningEffort: normalizeCodexProfileReasoningEffort(
      input.modelReasoningEffort ?? existing?.modelReasoningEffort
    ),
    modelContextWindow: normalizeNullablePositiveInt(input.modelContextWindow ?? existing?.modelContextWindow),
    modelAutoCompactTokenLimit: normalizeNullablePositiveInt(
      input.modelAutoCompactTokenLimit ?? existing?.modelAutoCompactTokenLimit
    ),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function maskCodexApiKey(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return "";
  if (text.length <= 10) return "********";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}
