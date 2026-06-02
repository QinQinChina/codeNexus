export type ThreadStartConfigOverrides = Record<string, boolean>;

export function buildThreadStartConfigOverridesForModel(_model: unknown): ThreadStartConfigOverrides | null {
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
