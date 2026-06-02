/**
 * 每个 workspace 绑定的 Codex skill 根目录列表。
 *
 * shared 层只保存路径集合；目录扫描、权限检查和 skill 元信息读取在主进程完成。
 */
export type CodexSkillRootsState = {
  version: 1;
  rootsByWorkspace: Record<string, string[]>;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** 单个 skill 根目录只做字符串清理，路径合法性由读取目录的一侧判断。 */
export function normalizeCodexSkillRoot(value: unknown): string {
  return normalizeText(value);
}

/** 同一个 workspace 下的 skill 根目录按大小写不敏感规则去重。 */
export function normalizeCodexSkillRoots(values: unknown): string[] {
  const source = Array.isArray(values) ? values : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of source) {
    const root = normalizeCodexSkillRoot(item);
    if (!root) continue;
    const key = root.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(root);
  }
  return out;
}

/** 空状态表示当前 workspace 尚未绑定任何额外 skill 根目录。 */
export function createDefaultCodexSkillRootsState(): CodexSkillRootsState {
  return {
    version: 1,
    rootsByWorkspace: {},
  };
}

/** 从持久化内容恢复 workspace 到 skill 根目录的映射，空 workspace 和空路径会被移除。 */
export function normalizeCodexSkillRootsState(
  value: unknown,
): CodexSkillRootsState {
  const root = toRecord(value);
  const rawByWorkspace = toRecord(root?.rootsByWorkspace);
  const rootsByWorkspace: Record<string, string[]> = {};
  for (const [rawWorkspace, rawRoots] of Object.entries(rawByWorkspace ?? {})) {
    const workspace = normalizeText(rawWorkspace);
    if (!workspace) continue;
    const roots = normalizeCodexSkillRoots(rawRoots);
    if (roots.length > 0) rootsByWorkspace[workspace] = roots;
  }
  return { version: 1, rootsByWorkspace };
}

/** 读取某个 workspace 的 roots 时再次归一化，防止调用侧传入手工构造的脏状态。 */
export function getCodexSkillRootsForWorkspace(
  state: CodexSkillRootsState,
  workspacePath: unknown,
): string[] {
  const workspace = normalizeText(workspacePath);
  if (!workspace) return [];
  return normalizeCodexSkillRoots(state.rootsByWorkspace[workspace]);
}
