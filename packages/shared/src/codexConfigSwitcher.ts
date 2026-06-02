/**
 * Codex 配置切换器的共享状态模型。
 *
 * 这里仅维护可序列化的数据形态与归一化规则；实际文件读写、备份和应用流程由主进程服务完成。
 */
export type CodexConfigSwitcherMcpServers = Record<
  string,
  Record<string, unknown>
>;

/** 单个配置档位：一组 MCP 服务配置，加上一组启用的 Codex skill。 */
export type CodexConfigSwitcherProfile = {
  id: string;
  name: string;
  mcpServers: CodexConfigSwitcherMcpServers;
  skillIds: string[];
  createdAt: number;
  updatedAt: number;
  lastActivatedAt?: number;
};

/** 从 skill 根目录扫描出的候选项，enabled 表示是否被当前配置切换器托管。 */
export type CodexConfigSwitcherSkillEntry = {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
};

/** 每次写入 Codex 配置前留下的备份索引，便于回滚和审计。 */
export type CodexConfigSwitcherBackup = {
  id: string;
  path: string;
  sourcePath: string;
  existed: boolean;
  createdAt: number;
  profileId?: string;
};

/** 对外暴露 ccswitch 兼容数据源的探测结果，不在 shared 层判断它是否可写。 */
export type CodexConfigSwitcherCcswitchStatus = {
  detected: boolean;
  dataDir: string;
  databasePath: string;
  reasons: string[];
};

/** 切换器自身的持久化状态，version 用于后续状态迁移。 */
export type CodexConfigSwitcherState = {
  version: 1;
  activeProfileId: string | null;
  profiles: CodexConfigSwitcherProfile[];
  skills: CodexConfigSwitcherSkillEntry[];
  backups: CodexConfigSwitcherBackup[];
  lastAppliedHash?: string;
};

/** 读取侧快照：同时返回状态文件位置、Codex 配置位置和外部 ccswitch 探测信息。 */
export type CodexConfigSwitcherSnapshot = {
  path: string;
  exists: boolean;
  codexConfigPath: string;
  backupDir: string;
  ccswitch: CodexConfigSwitcherCcswitchStatus;
  state: CodexConfigSwitcherState;
};

/** 写入侧结果：能返回该类型表示状态文件已经存在并完成持久化。 */
export type CodexConfigSwitcherMutationResult = {
  path: string;
  exists: true;
  codexConfigPath: string;
  backupDir: string;
  ccswitch: CodexConfigSwitcherCcswitchStatus;
  state: CodexConfigSwitcherState;
};

/** 激活档位会额外返回本次写入前创建的备份记录。 */
export type CodexConfigSwitcherActivateResult =
  CodexConfigSwitcherMutationResult & {
    backup: CodexConfigSwitcherBackup;
  };

/** 从外部配置导入时允许传入部分字段，缺省项由服务层补齐。 */
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
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

/**
 * 归一化 MCP 服务集合时只过滤空 ID 和非对象配置，具体协议合法性留给更下游的 MCP 校验。
 */
export function normalizeCodexConfigSwitcherMcpServers(
  value: unknown,
): CodexConfigSwitcherMcpServers {
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

/**
 * 从持久化内容恢复切换器状态。
 *
 * 无效条目会被丢弃；activeProfileId 只有在对应 profile 仍存在时才会保留。
 */
export function normalizeCodexConfigSwitcherState(
  value: unknown,
): CodexConfigSwitcherState {
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
      skillIds: Array.isArray(profile?.skillIds)
        ? profile.skillIds.map(normalizeText).filter(Boolean)
        : [],
      createdAt:
        typeof profile?.createdAt === "number" ? profile.createdAt : now,
      updatedAt:
        typeof profile?.updatedAt === "number" ? profile.updatedAt : now,
      ...(typeof profile?.lastActivatedAt === "number"
        ? { lastActivatedAt: profile.lastActivatedAt }
        : {}),
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
      createdAt:
        typeof backup?.createdAt === "number" ? backup.createdAt : Date.now(),
      ...(normalizeText(backup?.profileId)
        ? { profileId: normalizeText(backup?.profileId) }
        : {}),
    });
  }
  const activeProfileId = normalizeText(record.activeProfileId);
  return {
    version: 1,
    activeProfileId:
      activeProfileId &&
      profiles.some((profile) => profile.id === activeProfileId)
        ? activeProfileId
        : null,
    profiles,
    skills,
    backups,
    ...(normalizeText(record.lastAppliedHash)
      ? { lastAppliedHash: normalizeText(record.lastAppliedHash) }
      : {}),
  };
}

/** 读取当前激活档位时不抛错；状态不完整会回落为空。 */
export function getActiveCodexConfigSwitcherProfile(
  state: CodexConfigSwitcherState,
): CodexConfigSwitcherProfile | null {
  const activeId = normalizeText(state.activeProfileId);
  if (!activeId) return null;
  return state.profiles.find((profile) => profile.id === activeId) ?? null;
}
