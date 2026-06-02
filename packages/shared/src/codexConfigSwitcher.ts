export type CodexConfigSwitcherMcpServers = Record<string, Record<string, unknown>>;

export type CodexConfigSwitcherSkillEntry = {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
};

export type CodexConfigSwitcherProfile = {
  id: string;
  name: string;
  mcpServers: CodexConfigSwitcherMcpServers;
  skillIds: string[];
  createdAt: number;
  updatedAt: number;
  lastActivatedAt?: number;
};

export type CodexConfigSwitcherBackup = {
  id: string;
  path: string;
  sourcePath: string;
  existed: boolean;
  createdAt: number;
  profileId?: string;
};

export type CodexConfigSwitcherCcswitchStatus = {
  detected: boolean;
  dataDir: string;
  databasePath: string;
  reasons: string[];
};

export type CodexConfigSwitcherState = {
  version: 1;
  activeProfileId: string | null;
  profiles: CodexConfigSwitcherProfile[];
  skills: CodexConfigSwitcherSkillEntry[];
  backups: CodexConfigSwitcherBackup[];
  lastAppliedHash?: string;
};

export type CodexConfigSwitcherSnapshot = {
  path: string;
  exists: boolean;
  codexConfigPath: string;
  backupDir: string;
  ccswitch: CodexConfigSwitcherCcswitchStatus;
  state: CodexConfigSwitcherState;
};

export type CodexConfigSwitcherMutationResult = {
  path: string;
  exists: true;
  codexConfigPath: string;
  backupDir: string;
  ccswitch: CodexConfigSwitcherCcswitchStatus;
  state: CodexConfigSwitcherState;
};

export type CodexConfigSwitcherActivateResult = CodexConfigSwitcherMutationResult & {
  backup: CodexConfigSwitcherBackup;
};

export type CodexConfigSwitcherImportArgs = {
  name?: string | null;
  mcpServers?: CodexConfigSwitcherMcpServers | null;
  skills?: CodexConfigSwitcherSkillEntry[] | null;
  enabledSkillIds?: string[] | null;
};

export function createDefaultCodexConfigSwitcherState(): CodexConfigSwitcherState {
  return {
    version: 1,
    activeProfileId: null,
    profiles: [],
    skills: [],
    backups: [],
  };
}

export function createDefaultCodexConfigSwitcherCcswitchStatus(): CodexConfigSwitcherCcswitchStatus {
  return {
    detected: false,
    dataDir: "",
    databasePath: "",
    reasons: [],
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeCodexConfigSwitcherMcpServers(value: unknown): CodexConfigSwitcherMcpServers {
  const record = toRecord(value);
  if (!record) return {};
  const out: CodexConfigSwitcherMcpServers = {};
  for (const [rawId, rawSpec] of Object.entries(record)) {
    const id = normalizeText(rawId);
    const spec = toRecord(rawSpec);
    if (!id || !spec) continue;
    out[id] = { ...spec };
  }
  return out;
}

export function normalizeCodexConfigSwitcherState(value: unknown): CodexConfigSwitcherState {
  const record = toRecord(value);
  if (!record) return createDefaultCodexConfigSwitcherState();
  const profilesRaw = Array.isArray(record.profiles) ? record.profiles : [];
  const profiles: CodexConfigSwitcherProfile[] = [];
  for (const item of profilesRaw) {
    const profile = toRecord(item);
    const id = normalizeText(profile?.id);
    if (!id) continue;
    const now = Date.now();
    profiles.push({
      id,
      name: normalizeText(profile?.name) || id,
      mcpServers: normalizeCodexConfigSwitcherMcpServers(profile?.mcpServers),
      skillIds: Array.isArray(profile?.skillIds) ? profile.skillIds.map(normalizeText).filter(Boolean) : [],
      createdAt: typeof profile?.createdAt === "number" ? profile.createdAt : now,
      updatedAt: typeof profile?.updatedAt === "number" ? profile.updatedAt : now,
      ...(typeof profile?.lastActivatedAt === "number" ? { lastActivatedAt: profile.lastActivatedAt } : {}),
    });
  }
  const skillsRaw = Array.isArray(record.skills) ? record.skills : [];
  const skills: CodexConfigSwitcherSkillEntry[] = [];
  for (const item of skillsRaw) {
    const skill = toRecord(item);
    const id = normalizeText(skill?.id);
    if (!id) continue;
    skills.push({
      id,
      name: normalizeText(skill?.name) || id,
      path: normalizeText(skill?.path),
      enabled: Boolean(skill?.enabled),
    });
  }
  const backupsRaw = Array.isArray(record.backups) ? record.backups : [];
  const backups: CodexConfigSwitcherBackup[] = [];
  for (const item of backupsRaw) {
    const backup = toRecord(item);
    const id = normalizeText(backup?.id);
    if (!id) continue;
    backups.push({
      id,
      path: normalizeText(backup?.path),
      sourcePath: normalizeText(backup?.sourcePath),
      existed: Boolean(backup?.existed),
      createdAt: typeof backup?.createdAt === "number" ? backup.createdAt : Date.now(),
      ...(normalizeText(backup?.profileId) ? { profileId: normalizeText(backup?.profileId) } : {}),
    });
  }
  const activeProfileId = normalizeText(record.activeProfileId);
  return {
    version: 1,
    activeProfileId:
      activeProfileId && profiles.some((profile) => profile.id === activeProfileId) ? activeProfileId : null,
    profiles,
    skills,
    backups,
    ...(normalizeText(record.lastAppliedHash) ? { lastAppliedHash: normalizeText(record.lastAppliedHash) } : {}),
  };
}

export function getActiveCodexConfigSwitcherProfile(
  state: CodexConfigSwitcherState
): CodexConfigSwitcherProfile | null {
  const activeId = normalizeText(state.activeProfileId);
  if (!activeId) return null;
  return state.profiles.find((profile) => profile.id === activeId) ?? null;
}
