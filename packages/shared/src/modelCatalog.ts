export const BUILTIN_MODEL_IDS = [
  "gpt-5.5",
  "gpt-5.2",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
] as const;

export const DEFAULT_MODEL_NAME = BUILTIN_MODEL_IDS[0];

const BUILTIN_MODEL_ID_SET = new Set<string>(BUILTIN_MODEL_IDS);
const REMOVED_MODEL_ID_SET = new Set<string>(["gpt-5.2-codex"]);

export function normalizeModelId(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeModelIdList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of list) {
    const id = normalizeModelId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function normalizeCustomModelIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of list) {
    const id = normalizeModelId(item);
    if (!id || REMOVED_MODEL_ID_SET.has(id) || BUILTIN_MODEL_ID_SET.has(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function buildAvailableModelIds(customIds: readonly string[] | null | undefined): string[] {
  const ids: string[] = [...BUILTIN_MODEL_IDS];
  for (const item of normalizeCustomModelIds(customIds ?? [])) ids.push(item);
  return ids;
}

export function buildModelPickerOptions(args?: { customIds?: readonly string[] | null; current?: unknown }): string[] {
  const available = buildAvailableModelIds(args?.customIds);
  const current = normalizeModelId(args?.current);
  if (!current) return available;
  if (available.includes(current)) return available;
  return [current, ...available];
}
