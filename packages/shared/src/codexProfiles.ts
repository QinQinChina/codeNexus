import type { ReasoningEffort } from "@codenexus/generated/codex-app-server/ReasoningEffort";

/**
 * Codex provider profile 的共享数据模型。
 *
 * 该结构同时描述 UI 表单、持久化状态和主进程写入 Codex auth/config 文件所需的材料。
 */
export type CodexProviderProfile = {
  id: string;
  name: string;
  providerKind: CodexProviderKind;
  modelProviderId: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  authFilePath: string;
  configFilePath: string;
  authFileContent: string;
  configFileContent: string;
  modelReasoningEffort: ReasoningEffort;
  modelContextWindow: number | null;
  modelAutoCompactTokenLimit: number | null;
  order: number;
  lastTestedAt: number | null;
  lastTestStatus: "ok" | "error" | null;
  lastTestMessage: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CodexProviderKind = "openai-responses" | "deepseek-chat";

/** 创建或更新 profile 时的输入形态，未传字段会从 existing 或默认值继承。 */
export type CodexProviderProfileInput = Partial<
  Pick<
    CodexProviderProfile,
    | "id"
    | "name"
    | "providerKind"
    | "modelProviderId"
    | "model"
    | "baseUrl"
    | "apiKey"
    | "authFilePath"
    | "configFilePath"
    | "authFileContent"
    | "configFileContent"
    | "modelReasoningEffort"
    | "modelContextWindow"
    | "modelAutoCompactTokenLimit"
    | "order"
    | "lastTestedAt"
    | "lastTestStatus"
    | "lastTestMessage"
  >
>;

export type CodexProviderProfilesState = {
  version: 1;
  activeProfileId: string | null;
  profiles: CodexProviderProfile[];
};

/** 新建 provider profile 时的保守默认值，避免空模型或空 reasoning effort 写入 Codex 配置。 */
export const DEFAULT_CODEX_PROFILE_MODEL = "gpt-5.4";
export const DEFAULT_CODEX_PROFILE_REASONING_EFFORT: ReasoningEffort = "high";
export const DEFAULT_CODEX_PROVIDER_KIND: CodexProviderKind =
  "openai-responses";
export const DEFAULT_CODEX_AUTH_FILE_PATH = "";
export const DEFAULT_CODEX_CONFIG_FILE_PATH = "";

const VALID_REASONING_EFFORTS = new Set<ReasoningEffort>([
  "low",
  "medium",
  "high",
  "xhigh",
]);

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

function normalizeNullableTimestamp(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function normalizeOrder(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function normalizeLastTestStatus(value: unknown): "ok" | "error" | null {
  return value === "ok" || value === "error" ? value : null;
}

export function normalizeCodexProviderKind(value: unknown): CodexProviderKind {
  return value === "deepseek-chat"
    ? "deepseek-chat"
    : DEFAULT_CODEX_PROVIDER_KIND;
}

/** provider id 需要稳定且可作为文件/配置键使用，因此统一转成小写安全字符。 */
export function normalizeCodexProviderId(
  value: unknown,
  fallback = "custom",
): string {
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

export function normalizeCodexProfileName(
  value: unknown,
  fallback = "Custom Provider",
): string {
  const text = normalizeText(value).slice(0, 80);
  return text || fallback;
}

export function normalizeCodexProfileModel(value: unknown): string {
  return normalizeText(value) || DEFAULT_CODEX_PROFILE_MODEL;
}

export function normalizeCodexProfileReasoningEffort(
  value: unknown,
): ReasoningEffort {
  const raw = normalizeText(value).toLowerCase() as ReasoningEffort;
  return VALID_REASONING_EFFORTS.has(raw)
    ? raw
    : DEFAULT_CODEX_PROFILE_REASONING_EFFORT;
}

export function createDefaultCodexProviderProfilesState(): CodexProviderProfilesState {
  return {
    version: 1,
    activeProfileId: null,
    profiles: [],
  };
}

/** 从持久化内容恢复单个 profile，缺少关键连接信息时直接丢弃。 */
export function normalizeCodexProviderProfile(
  value: unknown,
): CodexProviderProfile | null {
  const record = toRecord(value);
  if (!record) return null;
  const id = normalizeCodexProfileId(record.id);
  const modelProviderId = normalizeCodexProviderId(
    record.modelProviderId ?? id,
  );
  const baseUrl = normalizeText(record.baseUrl);
  const apiKey = normalizeText(record.apiKey);
  if (!id || !modelProviderId || !baseUrl) return null;
  const createdAt = Number(record.createdAt);
  const updatedAt = Number(record.updatedAt);
  return {
    id,
    name: normalizeCodexProfileName(record.name, modelProviderId),
    providerKind: normalizeCodexProviderKind(record.providerKind),
    modelProviderId,
    model: normalizeCodexProfileModel(record.model),
    baseUrl,
    apiKey,
    authFilePath:
      normalizeText(record.authFilePath) || DEFAULT_CODEX_AUTH_FILE_PATH,
    configFilePath:
      normalizeText(record.configFilePath) || DEFAULT_CODEX_CONFIG_FILE_PATH,
    authFileContent: String(record.authFileContent ?? ""),
    configFileContent: String(record.configFileContent ?? ""),
    modelReasoningEffort: normalizeCodexProfileReasoningEffort(
      record.modelReasoningEffort,
    ),
    modelContextWindow: normalizeNullablePositiveInt(record.modelContextWindow),
    modelAutoCompactTokenLimit: normalizeNullablePositiveInt(
      record.modelAutoCompactTokenLimit,
    ),
    order: normalizeOrder(record.order),
    lastTestedAt: normalizeNullableTimestamp(record.lastTestedAt),
    lastTestStatus: normalizeLastTestStatus(record.lastTestStatus),
    lastTestMessage:
      normalizeText(record.lastTestMessage).slice(0, 500) || null,
    createdAt:
      Number.isFinite(createdAt) && createdAt > 0
        ? Math.round(createdAt)
        : Date.now(),
    updatedAt:
      Number.isFinite(updatedAt) && updatedAt > 0
        ? Math.round(updatedAt)
        : Date.now(),
  };
}

/** profile 列表按 id 去重，并保证 activeProfileId 指向仍然存在的 profile。 */
export function normalizeCodexProviderProfilesState(
  value: unknown,
): CodexProviderProfilesState {
  const root = toRecord(value);
  const profilesRaw = Array.isArray(root?.profiles) ? root.profiles : [];
  const byId = new Map<string, CodexProviderProfile>();
  for (const item of profilesRaw) {
    const profile = normalizeCodexProviderProfile(item);
    if (!profile) continue;
    byId.set(profile.id, profile);
  }
  const profiles = [...byId.values()].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name),
  );
  const activeRaw = normalizeCodexProfileId(root?.activeProfileId);
  return {
    version: 1,
    activeProfileId:
      activeRaw && profiles.some((item) => item.id === activeRaw)
        ? activeRaw
        : null,
    profiles,
  };
}

/** 创建或更新 profile 时保留原 createdAt，只刷新 updatedAt。 */
export function buildCodexProviderProfile(
  input: CodexProviderProfileInput,
  existing?: CodexProviderProfile,
): CodexProviderProfile {
  const now = Date.now();
  const modelProviderId = normalizeCodexProviderId(
    input.modelProviderId ?? existing?.modelProviderId ?? input.name,
  );
  const id = normalizeCodexProfileId(
    input.id ?? existing?.id ?? modelProviderId,
  );
  return {
    id: id || modelProviderId,
    name: normalizeCodexProfileName(
      input.name ?? existing?.name,
      modelProviderId,
    ),
    providerKind: normalizeCodexProviderKind(
      input.providerKind ?? existing?.providerKind,
    ),
    modelProviderId,
    model: normalizeCodexProfileModel(input.model ?? existing?.model),
    baseUrl: normalizeText(input.baseUrl ?? existing?.baseUrl),
    apiKey: normalizeText(input.apiKey ?? existing?.apiKey),
    authFilePath:
      normalizeText(input.authFilePath ?? existing?.authFilePath) ||
      DEFAULT_CODEX_AUTH_FILE_PATH,
    configFilePath:
      normalizeText(input.configFilePath ?? existing?.configFilePath) ||
      DEFAULT_CODEX_CONFIG_FILE_PATH,
    authFileContent: String(
      input.authFileContent ?? existing?.authFileContent ?? "",
    ),
    configFileContent: String(
      input.configFileContent ?? existing?.configFileContent ?? "",
    ),
    modelReasoningEffort: normalizeCodexProfileReasoningEffort(
      input.modelReasoningEffort ?? existing?.modelReasoningEffort,
    ),
    modelContextWindow: normalizeNullablePositiveInt(
      input.modelContextWindow ?? existing?.modelContextWindow,
    ),
    modelAutoCompactTokenLimit: normalizeNullablePositiveInt(
      input.modelAutoCompactTokenLimit ?? existing?.modelAutoCompactTokenLimit,
    ),
    order: normalizeOrder(input.order ?? existing?.order),
    lastTestedAt: normalizeNullableTimestamp(
      input.lastTestedAt ?? existing?.lastTestedAt,
    ),
    lastTestStatus: normalizeLastTestStatus(
      input.lastTestStatus ?? existing?.lastTestStatus,
    ),
    lastTestMessage:
      normalizeText(input.lastTestMessage ?? existing?.lastTestMessage).slice(
        0,
        500,
      ) || null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

/** API key 只在 UI 展示时脱敏；真实值仍由 profile 状态保存。 */
export function maskCodexApiKey(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return "";
  if (text.length <= 10) return "********";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}
