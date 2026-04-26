export type ThreadStartConfigOverrides = Record<string, boolean>;

const IMAGE_GENERATION_UNSUPPORTED_MODEL_IDS = new Set(["gpt-5.3-codex-spark"]);

export function buildThreadStartConfigOverridesForModel(model: unknown): ThreadStartConfigOverrides | null {
  const modelId = String(model ?? "").trim();
  if (!IMAGE_GENERATION_UNSUPPORTED_MODEL_IDS.has(modelId)) return null;
  return {
    "features.image_generation": false,
  };
}

export function hasThreadStartConfigOverridesForModel(applied: unknown, model: unknown): boolean {
  const required = buildThreadStartConfigOverridesForModel(model);
  if (!required) return true;
  if (!applied || typeof applied !== "object" || Array.isArray(applied)) return false;
  const appliedRecord = applied as Record<string, unknown>;
  return Object.entries(required).every(([key, value]) => appliedRecord[key] === value);
}
