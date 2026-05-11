import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createDefaultCodexSkillRootsState,
  normalizeCodexSkillRoots,
  normalizeCodexSkillRootsState,
  type CodexSkillRootsState,
} from "../../shared/codexSkillRoots";

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeWorkspacePath(value: unknown): string {
  return String(value ?? "").trim();
}

export class CodexSkillRootsService {
  private writeQueue: Promise<CodexSkillRootsState> = Promise.resolve(
    normalizeCodexSkillRootsState(createDefaultCodexSkillRootsState())
  );

  constructor(private readonly filePath: string) {}

  get path(): string {
    return this.filePath;
  }

  private async readStateFromDisk(): Promise<{ exists: boolean; state: CodexSkillRootsState }> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return { exists: true, state: normalizeCodexSkillRootsState(tryParseJson(raw)) };
    } catch {
      return { exists: false, state: createDefaultCodexSkillRootsState() };
    }
  }

  async read(): Promise<{ exists: boolean; state: CodexSkillRootsState }> {
    await this.writeQueue.catch(() => undefined);
    return this.readStateFromDisk();
  }

  private async writeState(next: CodexSkillRootsState): Promise<CodexSkillRootsState> {
    const normalized = normalizeCodexSkillRootsState(next);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return normalized;
  }

  async setRootsForWorkspace(workspacePathValue: string, rootsValue: unknown): Promise<CodexSkillRootsState> {
    const workspacePath = normalizeWorkspacePath(workspacePathValue);
    if (!workspacePath) throw new Error("workspacePath is required");
    const roots = normalizeCodexSkillRoots(rootsValue);
    const task = this.writeQueue
      .catch(() => createDefaultCodexSkillRootsState())
      .then(async () => {
        const current = await this.readStateFromDisk();
        const rootsByWorkspace = { ...current.state.rootsByWorkspace };
        if (roots.length > 0) rootsByWorkspace[workspacePath] = roots;
        else delete rootsByWorkspace[workspacePath];
        return await this.writeState({
          version: 1,
          rootsByWorkspace,
        });
      });
    this.writeQueue = task;
    return task;
  }
}
