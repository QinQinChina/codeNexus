import type { useCodexConfigSwitcherStore } from "../../stores/codexConfigSwitcher.store";
import type { useMcpStore } from "../../stores/mcp.store";
import { normalizeMcpServersFromConfig } from "../serverInterop";
import type { McpServerState } from "../types";
import type { McpStatusState } from "./mcpRuntime";
import { codexMcpServerSpecToConfigValue, parseCodexMcpJsonImport } from "@codenexus/shared/codexMcp";
import type { CodexConfigSwitcherProfile, CodexConfigSwitcherState } from "@codenexus/shared/codexConfigSwitcher";
import type { ConfigReadResponse } from "@codenexus/generated/codex-app-server/v2/ConfigReadResponse";

type McpStore = ReturnType<typeof useMcpStore>;
type CodexConfigSwitcherStore = ReturnType<typeof useCodexConfigSwitcherStore>;
type RuntimeEventLevel = "info" | "warn" | "error";
type ToastKind = "info" | "success" | "warn" | "error";

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;
type PushEvent = (method: string, paramsText: string, opts?: { threadId?: string; level?: RuntimeEventLevel }) => void;
type ShowToast = (options: { kind?: ToastKind; title?: string; message: string }) => void;

type McpSnapshot = {
  servers: McpServerState[];
  statusText: string;
};

export type McpManagementRuntimeDeps = {
  appTimelineId: string;
  mcpStore: McpStore;
  codexConfigSwitcherStore: CodexConfigSwitcherStore;
  mcpStatusRefreshDebounceMs: number;
  getWorkspacePath: () => string;
  getServerIdForWorkspace: (workspacePath: string) => string;
  requestConfigRead: () => Promise<ConfigReadResponse>;
  requestMcpStatusList: () => Promise<McpStatusState[]>;
  requestReloadMcpConfig: () => Promise<void>;
  requestStartMcpOAuthLogin: (serverKey: string) => Promise<string>;
  openExternalUrl: (url: string) => Promise<void>;
  getRequiredActiveSwitcherProfile: () => CodexConfigSwitcherProfile;
  writeCodexConfigSwitcherState: (state: CodexConfigSwitcherState) => Promise<void>;
  syncSwitcherProfileToCodex: (profile: CodexConfigSwitcherProfile) => Promise<void>;
  upsertActiveSwitcherMcpServers: (servers: Record<string, Record<string, unknown>>) => Promise<void>;
  saveMcpSnapshot: (workspacePath: string, snapshot: McpSnapshot) => void;
  invalidateMcpSnapshot: (workspacePath?: string) => void;
  pushEvent: PushEvent;
  translate: TranslateFn;
  showToast: ShowToast;
};

export type McpManagementRuntime = {
  refreshMcp: () => Promise<void>;
  scheduleMcpStatusRefresh: (workspacePath: string) => void;
  applyMcpStartupStatusNotification: (args: { workspace: string; name: string; status: string; error: string }) => void;
  reloadMcpConfig: () => Promise<void>;
  toggleMcpEnabled: (serverKey: string, enabled: boolean) => Promise<void>;
  deleteMcpServer: (serverId: string) => Promise<void>;
  importMcpServersFromJson: (text: string) => Promise<{ imported: number; errors: string[] }>;
  startMcpOAuthLogin: (serverKey: string) => Promise<void>;
  dispose: () => void;
};

function normalizeWorkspacePath(value: unknown): string {
  return String(value ?? "").trim();
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error ?? "");
}

export function createMcpManagementRuntime(deps: McpManagementRuntimeDeps): McpManagementRuntime {
  const {
    appTimelineId,
    mcpStore,
    codexConfigSwitcherStore,
    mcpStatusRefreshDebounceMs,
    getWorkspacePath,
    getServerIdForWorkspace,
    requestConfigRead,
    requestMcpStatusList,
    requestReloadMcpConfig,
    requestStartMcpOAuthLogin,
    openExternalUrl,
    getRequiredActiveSwitcherProfile,
    writeCodexConfigSwitcherState,
    syncSwitcherProfileToCodex,
    upsertActiveSwitcherMcpServers,
    saveMcpSnapshot,
    invalidateMcpSnapshot,
    pushEvent,
    translate,
    showToast,
  } = deps;

  const mcpStatusRefreshTimersByWorkspace = new Map<string, ReturnType<typeof setTimeout>>();
  const mcpStartupFailureToastKeys = new Set<string>();

  const refreshMcp = async () => {
    const workspace = normalizeWorkspacePath(getWorkspacePath());
    if (!getServerIdForWorkspace(workspace)) {
      mcpStore.resetState(translate("runtime.noService"));
      return;
    }
    const hasVisibleData = mcpStore.loadState === "ready" && mcpStore.servers.length > 0;
    if (!hasVisibleData) {
      mcpStore.setLoadState("loading");
      mcpStore.setStatusText(translate("runtime.loading"));
    }
    try {
      const configResult = await requestConfigRead();
      const configServers = normalizeMcpServersFromConfig(configResult);
      const statuses = await requestMcpStatusList();
      const statusById = new Map(statuses.map((status) => [status.id, status]));
      const merged: McpServerState[] = [];
      for (const server of configServers) {
        const status = statusById.get(server.id);
        merged.push({
          id: server.id,
          enabled: server.enabled,
          state: !server.enabled ? "disabled" : (status?.state ?? "unknown"),
          type: server.type,
          url: server.url,
          command: server.command,
          args: server.args,
          env: server.env,
          cwd: server.cwd,
          headers: server.headers,
          authenticated: status?.authenticated,
          authStatus: status?.authStatus,
          message: status?.message,
          tools: status?.tools ?? [],
          resources: status?.resources ?? [],
          resourceTemplates: status?.resourceTemplates ?? [],
        });
      }
      for (const status of statuses) {
        if (merged.some((server) => server.id === status.id)) continue;
        merged.push({
          id: status.id,
          enabled: true,
          state: status.state,
          authenticated: status.authenticated,
          authStatus: status.authStatus,
          message: status.message,
          tools: status.tools ?? [],
          resources: status.resources ?? [],
          resourceTemplates: status.resourceTemplates ?? [],
        });
      }
      merged.sort((a, b) => a.id.localeCompare(b.id));
      mcpStore.setServers(merged);
      mcpStore.setLoadState("ready");
      const statusText =
        merged.length === 0
          ? translate("integrations.noMcpConfig")
          : translate("runtime.mcpServerCount", { count: merged.length });
      mcpStore.setStatusText(statusText);
      saveMcpSnapshot(workspace, {
        servers: merged,
        statusText,
      });
    } catch (error: unknown) {
      const msg = readErrorMessage(error);
      if (hasVisibleData) {
        mcpStore.setLoadState("ready");
      } else {
        mcpStore.setLoadState("error", msg);
        mcpStore.setStatusText(translate("runtime.loadFailed"));
      }
    }
  };

  const scheduleMcpStatusRefresh = (workspacePath: string) => {
    const workspace = normalizeWorkspacePath(workspacePath);
    if (!workspace) return;
    const existing = mcpStatusRefreshTimersByWorkspace.get(workspace);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      mcpStatusRefreshTimersByWorkspace.delete(workspace);
      if (normalizeWorkspacePath(getWorkspacePath()) !== workspace) return;
      if (!getServerIdForWorkspace(workspace)) return;
      void refreshMcp();
    }, mcpStatusRefreshDebounceMs);
    mcpStatusRefreshTimersByWorkspace.set(workspace, timer);
  };

  const applyMcpStartupStatusNotification = (args: {
    workspace: string;
    name: string;
    status: string;
    error: string;
  }) => {
    const workspace = normalizeWorkspacePath(args.workspace);
    const name = String(args.name ?? "").trim();
    const status = String(args.status ?? "").trim();
    const error = String(args.error ?? "").trim();
    if (!workspace || !name || normalizeWorkspacePath(getWorkspacePath()) !== workspace) return;

    const current = mcpStore.servers;
    const next = current.map((server) => {
      if (server.id !== name) return server;
      if (status === "starting")
        return { ...server, state: "connecting" as const, message: translate("runtime.starting") };
      if (status === "ready") return { ...server, state: "connected" as const, message: undefined };
      if (status === "failed") return { ...server, state: "error" as const, message: error || "failed" };
      if (status === "cancelled") return { ...server, state: "error" as const, message: error || "cancelled" };
      return server;
    });

    if (!next.some((server) => server.id === name)) {
      next.push({
        id: name,
        enabled: true,
        state:
          status === "starting"
            ? "connecting"
            : status === "ready"
              ? "connected"
              : status === "failed" || status === "cancelled"
                ? "error"
                : "unknown",
        message:
          status === "starting"
            ? translate("runtime.starting")
            : status === "failed"
              ? error || "failed"
              : status === "cancelled"
                ? error || "cancelled"
                : undefined,
        tools: [],
        resources: [],
        resourceTemplates: [],
      });
      next.sort((a, b) => a.id.localeCompare(b.id));
    }

    mcpStore.setServers(next);
    mcpStore.setLoadState("ready");
    mcpStore.setStatusText(
      next.length === 0
        ? translate("integrations.noMcpConfig")
        : translate("runtime.mcpServerCount", { count: next.length })
    );

    if (status === "failed" || status === "cancelled") {
      const toastKey = `${workspace}:${name}:${status}:${error}`;
      if (!mcpStartupFailureToastKeys.has(toastKey)) {
        mcpStartupFailureToastKeys.add(toastKey);
        showToast({
          kind: "error",
          title:
            status === "failed"
              ? translate("runtime.mcpStartupFailedTitle")
              : translate("runtime.mcpStartupCanceledTitle"),
          message: error ? `${name}：${error}` : name,
        });
      }
    }
  };

  const reloadMcpConfig = async () => {
    const workspace = normalizeWorkspacePath(getWorkspacePath());
    if (!getServerIdForWorkspace(workspace)) return;
    try {
      await requestReloadMcpConfig();
      invalidateMcpSnapshot(workspace);
      pushEvent("mcp", translate("runtime.configReloaded"), { threadId: appTimelineId });
      await refreshMcp();
    } catch (error: unknown) {
      const msg = readErrorMessage(error);
      pushEvent("mcp:error", msg, { threadId: appTimelineId, level: "error" });
      showToast({ kind: "error", title: translate("runtime.mcpReloadFailedTitle"), message: msg });
      throw error;
    }
  };

  const toggleMcpEnabled = async (serverKey: string, enabled: boolean) => {
    const workspace = normalizeWorkspacePath(getWorkspacePath());
    if (!getServerIdForWorkspace(workspace)) return;
    try {
      const id = String(serverKey ?? "").trim();
      const profile = getRequiredActiveSwitcherProfile();
      const current = profile.mcpServers[id];
      if (!current) throw new Error(translate("runtime.managedMcpNotFound", { id }));
      const nextProfile: CodexConfigSwitcherProfile = {
        ...profile,
        mcpServers: {
          ...profile.mcpServers,
          [id]: { ...current, enabled },
        },
        updatedAt: Date.now(),
      };
      await writeCodexConfigSwitcherState({
        ...codexConfigSwitcherStore.state,
        profiles: codexConfigSwitcherStore.state.profiles.map((item) =>
          item.id === nextProfile.id ? nextProfile : item
        ),
      });
      await syncSwitcherProfileToCodex(nextProfile);
      invalidateMcpSnapshot(workspace);
      pushEvent("mcp", `enabled=${enabled ? "true" : "false"}\n${serverKey}`, { threadId: appTimelineId });
      await refreshMcp();
    } catch (error: unknown) {
      const msg = readErrorMessage(error);
      pushEvent("mcp:error", msg, { threadId: appTimelineId, level: "error" });
      showToast({ kind: "error", title: translate("runtime.mcpConfigFailedTitle"), message: msg });
      throw error;
    }
  };

  const deleteMcpServer = async (serverId: string) => {
    const workspace = normalizeWorkspacePath(getWorkspacePath());
    if (!getServerIdForWorkspace(workspace)) throw new Error(translate("runtime.noServiceCannotWriteMcpConfig"));
    const id = String(serverId ?? "").trim();
    if (!id) throw new Error(translate("runtime.mcpIdRequired"));
    try {
      const profile = getRequiredActiveSwitcherProfile();
      const nextMcpServers = { ...profile.mcpServers };
      delete nextMcpServers[id];
      const nextProfile: CodexConfigSwitcherProfile = {
        ...profile,
        mcpServers: nextMcpServers,
        updatedAt: Date.now(),
      };
      await writeCodexConfigSwitcherState({
        ...codexConfigSwitcherStore.state,
        profiles: codexConfigSwitcherStore.state.profiles.map((item) =>
          item.id === nextProfile.id ? nextProfile : item
        ),
      });
      await syncSwitcherProfileToCodex(nextProfile);
      invalidateMcpSnapshot(workspace);
      pushEvent("mcp", `deleted\n${id}`, { threadId: appTimelineId });
      await refreshMcp();
      showToast({ kind: "success", title: translate("runtime.mcpDeletedTitle"), message: id });
    } catch (error: unknown) {
      const msg = readErrorMessage(error);
      pushEvent("mcp:error", msg, { threadId: appTimelineId, level: "error" });
      showToast({ kind: "error", title: translate("runtime.mcpDeleteFailedTitle"), message: msg });
      throw error;
    }
  };

  const importMcpServersFromJson = async (text: string): Promise<{ imported: number; errors: string[] }> => {
    const workspace = normalizeWorkspacePath(getWorkspacePath());
    if (!getServerIdForWorkspace(workspace)) throw new Error(translate("runtime.noServiceCannotWriteMcpConfig"));
    const parsed = parseCodexMcpJsonImport(text);
    if (parsed.servers.length === 0) return { imported: 0, errors: parsed.errors };
    try {
      await upsertActiveSwitcherMcpServers(
        Object.fromEntries(parsed.servers.map((server) => [server.id, codexMcpServerSpecToConfigValue(server)]))
      );
      invalidateMcpSnapshot(workspace);
      pushEvent("mcp", `imported ${parsed.servers.length} servers`, { threadId: appTimelineId });
      await refreshMcp();
      showToast({
        kind: "success",
        title: translate("runtime.mcpJsonImportedTitle"),
        message: translate("runtime.mcpServersImported", { count: parsed.servers.length }),
      });
      return { imported: parsed.servers.length, errors: parsed.errors };
    } catch (error: unknown) {
      const msg = readErrorMessage(error);
      pushEvent("mcp:error", msg, { threadId: appTimelineId, level: "error" });
      showToast({ kind: "error", title: translate("runtime.mcpJsonImportFailedTitle"), message: msg });
      throw error;
    }
  };

  const startMcpOAuthLogin = async (serverKey: string) => {
    if (!getServerIdForWorkspace(getWorkspacePath())) return;
    try {
      const url = await requestStartMcpOAuthLogin(serverKey);
      await openExternalUrl(url);
      pushEvent("mcp", `oauth login started\nid=${serverKey}\nurl=${url}`, { threadId: appTimelineId });
      showToast({
        kind: "success",
        title: translate("runtime.browserOpenedTitle"),
        message: translate("runtime.mcpOauthStarted", { server: serverKey }),
      });
    } catch (error: unknown) {
      const msg = readErrorMessage(error);
      pushEvent("mcp:error", msg, { threadId: appTimelineId, level: "error" });
      showToast({ kind: "error", title: translate("runtime.mcpOauthFailedTitle"), message: msg });
      throw error;
    }
  };

  const dispose = () => {
    for (const timer of mcpStatusRefreshTimersByWorkspace.values()) clearTimeout(timer);
    mcpStatusRefreshTimersByWorkspace.clear();
  };

  return {
    refreshMcp,
    scheduleMcpStatusRefresh,
    applyMcpStartupStatusNotification,
    reloadMcpConfig,
    toggleMcpEnabled,
    deleteMcpServer,
    importMcpServersFromJson,
    startMcpOAuthLogin,
    dispose,
  };
}
