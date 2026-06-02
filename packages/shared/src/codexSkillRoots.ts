export type CodexSkillRootsState = {
  version: 1;
  rootsByWorkspace: Record<string, string[]>;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function normalizeCodexSkillRoot(value: unknown): string {
  return normalizeText(value);
}

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

export function createDefaultCodexSkillRootsState(): CodexSkillRootsState {
  return {
    version: 1,
    rootsByWorkspace: {},
  };
}

export function normalizeCodexSkillRootsState(value: unknown): CodexSkillRootsState {
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

export function getCodexSkillRootsForWorkspace(state: CodexSkillRootsState, workspacePath: unknown): string[] {
  const workspace = normalizeText(workspacePath);
  if (!workspace) return [];
  return normalizeCodexSkillRoots(state.rootsByWorkspace[workspace]);
}
