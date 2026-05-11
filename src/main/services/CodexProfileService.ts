import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  buildCodexProviderProfile,
  createDefaultCodexProviderProfilesState,
  normalizeCodexProviderProfilesState,
  normalizeCodexProfileId,
  type CodexProviderProfile,
  type CodexProviderProfileInput,
  type CodexProviderProfilesState,
} from "../../shared/codexProfiles";

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class CodexProfileService {
  private writeQueue: Promise<CodexProviderProfilesState> = Promise.resolve(
    normalizeCodexProviderProfilesState(createDefaultCodexProviderProfilesState())
  );

  constructor(private readonly filePath: string) {}

  get path(): string {
    return this.filePath;
  }

  private async readStateFromDisk(): Promise<{ exists: boolean; state: CodexProviderProfilesState }> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return { exists: true, state: normalizeCodexProviderProfilesState(tryParseJson(raw)) };
    } catch {
      return { exists: false, state: createDefaultCodexProviderProfilesState() };
    }
  }

  async read(): Promise<{ exists: boolean; state: CodexProviderProfilesState }> {
    await this.writeQueue.catch(() => undefined);
    return this.readStateFromDisk();
  }

  private async writeState(next: CodexProviderProfilesState): Promise<CodexProviderProfilesState> {
    const normalized = normalizeCodexProviderProfilesState(next);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return normalized;
  }

  async upsert(input: CodexProviderProfileInput): Promise<CodexProviderProfilesState> {
    const task = this.writeQueue
      .catch(() => createDefaultCodexProviderProfilesState())
      .then(async () => {
        const current = await this.readStateFromDisk();
        const id = normalizeCodexProfileId(input.id);
        const existing = id ? current.state.profiles.find((profile) => profile.id === id) : undefined;
        const profile = buildCodexProviderProfile(input, existing);
        if (!profile.baseUrl) throw new Error("Codex profile baseUrl is required");
        const nextProfiles = current.state.profiles.filter((item) => item.id !== profile.id);
        nextProfiles.push(profile);
        return await this.writeState({
          version: 1,
          activeProfileId: current.state.activeProfileId,
          profiles: nextProfiles,
        });
      });
    this.writeQueue = task;
    return task;
  }

  async delete(idValue: string): Promise<CodexProviderProfilesState> {
    const id = normalizeCodexProfileId(idValue);
    const task = this.writeQueue
      .catch(() => createDefaultCodexProviderProfilesState())
      .then(async () => {
        const current = await this.readStateFromDisk();
        const nextProfiles = current.state.profiles.filter((item) => item.id !== id);
        return await this.writeState({
          version: 1,
          activeProfileId: current.state.activeProfileId === id ? null : current.state.activeProfileId,
          profiles: nextProfiles,
        });
      });
    this.writeQueue = task;
    return task;
  }

  async setActive(idValue: string | null): Promise<CodexProviderProfilesState> {
    const id = normalizeCodexProfileId(idValue);
    const task = this.writeQueue
      .catch(() => createDefaultCodexProviderProfilesState())
      .then(async () => {
        const current = await this.readStateFromDisk();
        const activeProfileId = id && current.state.profiles.some((profile) => profile.id === id) ? id : null;
        return await this.writeState({
          ...current.state,
          activeProfileId,
        });
      });
    this.writeQueue = task;
    return task;
  }

  findProfile(state: CodexProviderProfilesState, idValue: string): CodexProviderProfile | null {
    const id = normalizeCodexProfileId(idValue);
    return state.profiles.find((profile) => profile.id === id) ?? null;
  }
}
