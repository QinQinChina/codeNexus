import { codexDesktop } from "../../api/codexDesktopClient";
import { normalizeSkillsErrors, normalizeSkillsListResult, summarizeSkillsListResult } from "../serverInterop";
import type { SkillState } from "../types";

type SkillsRuntimeDeps = {
  requireActiveWorkspaceServerId: () => string;
  getServerIdForWorkspace: (workspacePath: string) => string;
  getWorkspacePath: () => string;
};

export type SkillsListSnapshot = {
  entries: SkillState[];
  errors: string[];
  summary: string;
};

export type SkillsRuntime = {
  requestSkillsList: (forceReload: boolean) => Promise<SkillsListSnapshot>;
  writeSkillConfig: (skillPath: string, enabled: boolean) => Promise<void>;
};

export function createSkillsRuntime(deps: SkillsRuntimeDeps): SkillsRuntime {
  const requestSkillsList = async (forceReload: boolean): Promise<SkillsListSnapshot> => {
    const workspace = deps.getWorkspacePath();
    const serverId = deps.getServerIdForWorkspace(workspace);
    if (!serverId) return { entries: [], errors: [], summary: "shape=none skills=0" };
    const cwd = String(workspace ?? "").trim();
    const { result } = await codexDesktop.codexServer.rpc({
      serverId,
      method: "skills/list",
      params: { cwds: cwd ? [cwd] : [], forceReload },
    });
    return {
      entries: normalizeSkillsListResult(result),
      errors: normalizeSkillsErrors(result),
      summary: summarizeSkillsListResult(result),
    };
  };

  const writeSkillConfig = async (skillPath: string, enabled: boolean): Promise<void> => {
    const serverId = deps.requireActiveWorkspaceServerId();
    const path = String(skillPath ?? "").trim();
    if (!path) throw new Error("missing skill path");
    await codexDesktop.codexServer.rpc({
      serverId,
      method: "skills/config/write",
      params: { path, enabled },
    });
  };

  return {
    requestSkillsList,
    writeSkillConfig,
  };
}
