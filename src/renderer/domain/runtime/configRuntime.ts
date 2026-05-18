import { codexDesktop } from "../../api/codexDesktopClient";
import type { ConfigWriteChange } from "../serverInterop";
import type { ConfigReadParams } from "../../../generated/codex-app-server/v2/ConfigReadParams";
import type { ConfigReadResponse } from "../../../generated/codex-app-server/v2/ConfigReadResponse";
import type { ConfigRequirementsReadResponse } from "../../../generated/codex-app-server/v2/ConfigRequirementsReadResponse";
import type { JsonValue } from "../../../generated/codex-app-server/serde_json/JsonValue";

type ConfigRuntimeDeps = {
  requireActiveWorkspaceServerId: () => string;
  getWorkspacePath: () => string;
  onBatchWriteUnavailable?: () => void;
};

export type ConfigRuntime = {
  requestConfigRead: () => Promise<ConfigReadResponse>;
  requestConfigRequirementsRead: () => Promise<ConfigRequirementsReadResponse>;
  requestConfigBatchWrite: (changes: ConfigWriteChange[], filePath?: string | null) => Promise<void>;
};

type JsonRpcErrorLike = {
  code: number;
  message: string;
};

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error ?? "unknown error");
}

function parseJsonRpcError(error: unknown): JsonRpcErrorLike | null {
  const raw = readErrorMessage(error).trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const code = typeof parsed.code === "number" ? parsed.code : null;
    const message = typeof parsed.message === "string" ? parsed.message : "";
    if (code == null) return null;
    return { code, message };
  } catch {
    return null;
  }
}

function normalizeConfigWriteChanges(changes: ConfigWriteChange[]) {
  return changes
    .map((change) => ({
      keyPath: String(change.keyPath ?? "").trim(),
      value: change.value === undefined ? null : change.value,
    }))
    .filter((change) => Boolean(change.keyPath));
}

export function createConfigRuntime(deps: ConfigRuntimeDeps): ConfigRuntime {
  const requestConfigRead = async (): Promise<ConfigReadResponse> => {
    const serverId = deps.requireActiveWorkspaceServerId();
    const cwd = String(deps.getWorkspacePath() ?? "").trim();
    const params: ConfigReadParams = { includeLayers: true, ...(cwd ? { cwd } : {}) };
    const res = await codexDesktop.codexServer.rpc({
      serverId,
      method: "config/read",
      params,
    });
    return res.result;
  };

  const requestConfigRequirementsRead = async (): Promise<ConfigRequirementsReadResponse> => {
    const serverId = deps.requireActiveWorkspaceServerId();
    const res = await codexDesktop.codexServer.rpc({
      serverId,
      method: "configRequirements/read",
    });
    return res.result;
  };

  const requestConfigBatchWrite = async (changes: ConfigWriteChange[], filePath?: string | null): Promise<void> => {
    const serverId = deps.requireActiveWorkspaceServerId();
    const normalized = normalizeConfigWriteChanges(changes);
    const targetFilePath = String(filePath ?? "").trim() || null;
    if (normalized.length === 0) return;

    const valueWrite = async (keyPath: string, value: unknown) => {
      await codexDesktop.codexServer.rpc({
        serverId,
        method: "config/value/write",
        params: { keyPath, value: value as JsonValue, mergeStrategy: "replace", filePath: targetFilePath },
      });
    };

    try {
      await codexDesktop.codexServer.rpc({
        serverId,
        method: "config/batchWrite",
        params: {
          edits: normalized.map((change) => ({
            keyPath: change.keyPath,
            value: change.value as JsonValue,
            mergeStrategy: "replace" as const,
          })),
          filePath: targetFilePath,
        },
      });
    } catch (error) {
      const rpcErr = parseJsonRpcError(error);
      if (rpcErr?.code === -32601) {
        deps.onBatchWriteUnavailable?.();
        for (const change of normalized) {
          await valueWrite(change.keyPath, change.value);
        }
        return;
      }
      throw error;
    }
  };

  return {
    requestConfigRead,
    requestConfigRequirementsRead,
    requestConfigBatchWrite,
  };
}
