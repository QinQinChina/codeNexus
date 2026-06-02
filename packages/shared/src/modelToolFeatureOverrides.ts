/**
 * 会话启动时按模型补充的 Codex 配置覆盖项。
 *
 * 这里目前统一关闭 Codex 原生 image_generation feature，让图片能力走应用内动态工具链。
 */
export type ThreadStartConfigOverrides = Record<string, boolean>;

/** 返回需要写入 thread_start.configOverrides 的最小覆盖集。 */
export function buildThreadStartConfigOverridesForModel(
  _model: unknown,
): ThreadStartConfigOverrides | null {
  return {
    "features.image_generation": false,
  };
}

/** 判断运行时实际应用的覆盖项是否满足当前模型要求。 */
export function hasThreadStartConfigOverridesForModel(
  applied: unknown,
  model: unknown,
): boolean {
  const required = buildThreadStartConfigOverridesForModel(model);
  if (!required) return true;
  if (!applied || typeof applied !== "object" || Array.isArray(applied))
    return false;
  const appliedRecord = applied as Record<string, unknown>;
  return Object.entries(required).every(
    ([key, value]) => appliedRecord[key] === value,
  );
}
