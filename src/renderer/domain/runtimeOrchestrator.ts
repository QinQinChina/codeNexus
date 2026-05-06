import { nextTick } from "vue";
import type { Pinia } from "pinia";
import { codexDesktop } from "../api/codexDesktopClient";
import type { ReplayTimelineEvent } from "../features/history/replayParsers";
import {
  ALL_THREAD_SOURCE_KINDS,
  buildHistoryThreadMetadataPatchFromServerThread,
  normalizeOptionalText,
  resolveThreadParentIdForGraph,
} from "../features/history/threadMetadata";
import { toThreadHistoryItem as toThreadHistoryItemFromHistory } from "../features/history/threadHistoryItem";
import {
  fallbackThreadTitle,
  isBootstrapThreadTitleSource,
  titleFromFirstUserMessage,
} from "../features/history/threadTitle";
import { showToast } from "../ui/toast";
import { appendDebugLog } from "../shared/debugLog";
import { isIpcHandlerMissingError } from "../shared/ipcErrors";
import { sandboxKebabFromUi } from "../shared/sandboxPolicy";
import { safeJsonStringify } from "../utils/safeJson";
import {
  beginThreadCreateAttempt,
  bindThreadCreateAttemptToThread,
  createPendingThreadId,
  isPendingThreadId,
} from "../shared/threadCreateDebug";
import { useRuntimeStore } from "../stores/runtime.store";
import { useTimelineStore } from "../stores/timeline.store";
import { useThreadStore } from "../stores/thread.store";
import { useAppShellStore } from "../stores/appShell.store";
import { useConfigStore } from "../stores/config.store";
import { useConfigRequirementsStore } from "../stores/configRequirements.store";
import { useSkillsStore } from "../stores/skills.store";
import { useMcpStore } from "../stores/mcp.store";
import { useMcpResourceStore } from "../stores/mcpResource.store";
import { useUserInputStore } from "../stores/userInput.store";
import { useMessageQueueStore } from "../stores/messageQueue.store";
import { resolveHistoryRewriteRollback } from "./historyRewriteRollback";
import { useApprovalStore } from "../stores/approval.store";
import { useWorkspaceFilesStore } from "../stores/workspaceFiles.store";
import { installEventPipeline } from "../processes/protocol-event-pipeline/installEventPipeline";
import { installRequestResponder } from "../processes/protocol-request-responder/installRequestResponder";
import { notifyTurnCompleted } from "../features/systemNotification/systemNotification";
import {
  buildCompletedTurnsFromReplay,
  countReplayTurns,
  dedupeReplayEvents,
  extractProposedPlanBody,
  hasOlderReplayHistory,
  isReplayCarryoverEvent,
  normalizePlanText,
  sortReplayEvents,
  splitReplayEventsByRecentTurns,
  stripProposedPlanTags,
  toPlanSignatureText,
  toPlanTurnKey,
  type ThreadReplayCache,
} from "./runtime/historyReplayRuntime";
import { createHistoryThreadRuntime } from "./runtime/historyThreadRuntime";
import { createConfigRuntime } from "./runtime/configRuntime";
import { createMcpRuntime } from "./runtime/mcpRuntime";
import { createMcpResourceReadRuntime } from "./runtime/mcpResourceRuntime";
import { createSkillsRuntime } from "./runtime/skillsRuntime";
import { createTurnInputRuntime } from "./runtime/turnInputRuntime";
import { createTurnStartRuntime } from "./runtime/turnStartRuntime";
import { createWorkspaceFileRuntime } from "./runtime/workspaceFileRuntime";
import {
  invalidateThreadContentCache,
  type ThreadContentCacheEntry,
} from "./runtime/rendererCacheRuntime";
import {
  buildConfigBatchChangesFromDraft,
  createDefaultGlobalConfigDraft,
  extractConfigRequirementsFromReadResult,
  extractGlobalConfigFromReadResult,
  normalizeApprovalPolicy,
  normalizeApprovalsReviewer,
  normalizeEffort,
  normalizeMcpServersFromConfig,
  normalizeModelName,
  normalizeReasoningSummary,
  normalizeSandboxMode,
} from "./serverInterop";
import { isWithinWorkspaceFsPath, resolveWorkspaceFsPath } from "./workspacePath";
import {
  buildComposeDraftFromUserTurnInputs,
  hasMeaningfulComposeText,
} from "./composeFileMentions";
import type { HistoryThread } from "../../shared/ipc";
import type { Thread as ServerThread } from "../../generated/codex-app-server/v2/Thread";
import type { ThreadListParams } from "../../generated/codex-app-server/v2/ThreadListParams";
import type { ThreadListResponse } from "../../generated/codex-app-server/v2/ThreadListResponse";
import type { ThreadReadParams } from "../../generated/codex-app-server/v2/ThreadReadParams";
import type { ThreadResumeParams } from "../../generated/codex-app-server/v2/ThreadResumeParams";
import type { ThreadStartParams } from "../../generated/codex-app-server/v2/ThreadStartParams";
import type { ThreadMemoryMode } from "../../generated/codex-app-server/ThreadMemoryMode";
import type { JsonValue } from "../../generated/codex-app-server/serde_json/JsonValue";
import type {
  ComposeImageAttachment,
  ComposeWorkspaceFileMention,
  McpResourceContentState,
  McpResourceParameterEntry,
  McpServerState,
  SkillState,
  ThreadHistoryItem,
  TimelineEventItem,
  UserTurnInput,
  WorkspaceDirectoryReadResult,
  WorkspaceFileMetadataState,
  WorkspaceTextFileReadResult,
  WorkspaceTextFileWriteResult,
} from "./types";
import { IPC_HISTORY_CHANNELS } from "../../shared/ipc";
import {
  buildThreadStartConfigOverridesForModel,
  hasThreadStartConfigOverridesForModel,
  type ThreadStartConfigOverrides,
} from "../../shared/modelToolFeatureOverrides";
import { buildNewThreadComposeSeed } from "../../shared/newThreadComposeSeed";
import type {
  AppTextEncoding,
  AppTextLineEnding,
  CacheClearArgs,
  CacheClearResult,
  CacheListResult,
  HistoryThreadContentResult,
  HistoryThreadTaskCreateArgs,
  HistoryThreadTaskCreateResult,
  HistoryThreadTaskUpdateArgs,
  HistoryThreadTaskUpdateResult,
} from "../../shared/ipc/contracts";
import { isCodexLocalEventMessage, isCodexServerNotificationMessage } from "../../shared/codex-protocol";

const APP_TIMELINE_ID = "__app__";
// 历史回放仍按事件页读取，但聊天首屏只保留最近几个 turn，旧历史按需继续补。
const HISTORY_REPLAY_BATCH = 1000;
const HISTORY_REPLAY_TURN_SEGMENTS = 4;
// UI：最多显示最近 N 轮对话（不做虚拟列表/窗口化渲染）。
const TIMELINE_MAX_VISIBLE_TURNS = 16;
const THREAD_METADATA_PAGE_SIZE = 200;
const THREAD_CONTENT_CACHE_TTL_MS = 2000;

type ReplayBatchResult = {
  loaded: number;
  hasMore: boolean;
  events: ReplayTimelineEvent[];
};

type ThreadReplayWindowState = {
  nextBefore: number;
  hasMorePages: boolean;
  bufferedOlderEvents: ThreadReplayCache;
};

type SkillsSnapshot = {
  items: SkillState[];
  parseErrors: string[];
  summary: string;
};

type McpSnapshot = {
  servers: McpServerState[];
  statusText: string;
};

type JsonRpcErrorLike = {
  code: number;
  message: string;
};

async function confirmModalLazy(options: Parameters<typeof import("../ui/modal")["confirmModal"]>[0]) {
  const { confirmModal } = await import("../ui/modal");
  return confirmModal(options);
}

async function promptNumberModalLazy(options: Parameters<typeof import("../ui/modal")["promptNumberModal"]>[0]) {
  const { promptNumberModal } = await import("../ui/modal");
  return promptNumberModal(options);
}

async function parseSessionReplayEventsLazy(
  entries: Parameters<typeof import("../features/history/replayParsers")["parseSessionReplayEvents"]>[0],
  threadId: string
): Promise<ReplayTimelineEvent[]> {
  const { parseSessionReplayEvents } = await import("../features/history/replayParsers");
  return parseSessionReplayEvents(entries, threadId);
}

export type RuntimeOrchestrator = {
  dispose: () => void;
  checkEnvironment: () => Promise<void>;
  selectWorkspace: () => Promise<void>;
  switchWorkspace: (workspacePath: string) => Promise<boolean>;
  refreshHistory: (force?: boolean) => Promise<void>;
  createThread: () => Promise<void>;
  switchThread: (threadId: string) => Promise<void>;
  loadOlderHistoryTurns: (threadId?: string) => Promise<boolean>;
  deleteHistoryThread: (threadId: string) => Promise<void>;
  send: () => Promise<void>;
  steerNow: () => Promise<void>;
  sendQueuedMessageNow: (messageId: string) => Promise<void>;
  editQueuedMessage: (messageId: string) => Promise<void>;
  removeQueuedMessage: (messageId: string) => Promise<void>;
  interruptTurn: () => Promise<void>;
  compactThread: () => Promise<void>;
  resetCodexMemory: () => Promise<void>;
  setCurrentThreadMemoryMode: (mode: ThreadMemoryMode) => Promise<void>;
  refreshGlobalConfig: () => Promise<void>;
  saveGlobalConfig: (options?: { source?: "manual" | "auto"; silentSuccessToast?: boolean }) => Promise<void>;
  resetGlobalConfig: () => void;
  openExternalUrl: (url: string) => Promise<void>;
  readTextFile: (path: string) => Promise<string>;
  writeTextFile: (path: string, content: string) => Promise<void>;
  readWorkspaceDirectory: (path?: string) => Promise<WorkspaceDirectoryReadResult>;
  getWorkspaceMetadata: (path: string) => Promise<WorkspaceFileMetadataState>;
  readWorkspaceTextFile: (path: string) => Promise<WorkspaceTextFileReadResult>;
  writeWorkspaceTextFile: (
    path: string,
    content: string,
    options?: { encoding?: AppTextEncoding; lineEnding?: AppTextLineEnding }
  ) => Promise<WorkspaceTextFileWriteResult>;
  refreshSkills: (forceReload?: boolean) => Promise<void>;
  toggleSkill: (skillPath: string, enabled: boolean) => Promise<void>;
  refreshMcp: () => Promise<void>;
  reloadMcpConfig: () => Promise<void>;
  toggleMcpEnabled: (serverKey: string, enabled: boolean) => Promise<void>;
  startMcpOAuthLogin: (serverKey: string) => Promise<void>;
  readThreadContent: (params?: {
    threadId?: string;
    messageLimit?: number;
    eventLimit?: number;
    eventBefore?: number;
    includeAux?: boolean;
  }) => Promise<HistoryThreadContentResult>;
  createThreadTask: (args: HistoryThreadTaskCreateArgs) => Promise<HistoryThreadTaskCreateResult>;
  updateThreadTask: (args: HistoryThreadTaskUpdateArgs) => Promise<HistoryThreadTaskUpdateResult>;
  listRendererCaches: () => Promise<CacheListResult>;
  clearRendererCaches: (args?: CacheClearArgs) => Promise<CacheClearResult>;
  readMcpResource: (params: {
    threadId: string;
    serverKey: string;
    uri: string;
    sourceTab?: "resources" | "templates";
    templateKey?: string;
  }) => Promise<{
    contents: McpResourceContentState[];
    resourceLabel: string;
    toolNames: string[];
    parameterEntries: McpResourceParameterEntry[];
  }>;
  rollbackTurns: () => Promise<void>;
  submitUserInputPromptForThread: (threadId: string) => Promise<void>;
  cancelUserInputPromptForThread: (threadId: string) => Promise<void>;
  submitActiveUserInputPrompt: () => Promise<void>;
  cancelActiveUserInputPrompt: () => Promise<void>;
  submitActiveApprovalPrompt: (decision: unknown) => Promise<void>;
  dismissActiveApprovalPrompt: () => void;
};

let runtimeOrchestrator: RuntimeOrchestrator | null = null;

export function initRuntimeOrchestrator(pinia: Pinia): RuntimeOrchestrator {
  if (runtimeOrchestrator) return runtimeOrchestrator;

  const runtimeStore = useRuntimeStore(pinia);
  const threadStore = useThreadStore(pinia);
  const timelineStore = useTimelineStore(pinia);
  const appShellStore = useAppShellStore(pinia);
  const configStore = useConfigStore(pinia);
  const configRequirementsStore = useConfigRequirementsStore(pinia);
  const skillsStore = useSkillsStore(pinia);
  const mcpStore = useMcpStore(pinia);
  const mcpResourceStore = useMcpResourceStore(pinia);
  const userInputStore = useUserInputStore(pinia);
  const approvalStore = useApprovalStore(pinia);
  const messageQueueStore = useMessageQueueStore(pinia);
  const workspaceFilesStore = useWorkspaceFilesStore(pinia);

  // 运行期缓存：会话恢复、历史分页、工作区<->服务映射、右侧面板快照。
  const resumedThreadIds = new Set<string>();
  const resumePromisesByThread = new Map<string, Promise<boolean>>();
  const replayCacheByThread = new Map<string, ThreadReplayCache>();
  const replayWindowStateByThread = new Map<string, ThreadReplayWindowState>();
  const replayRequestSeqByThread = new Map<string, number>();
  const olderHistoryLoadPromiseByThread = new Map<string, Promise<boolean>>();
  const UNPERSISTED_THREAD_TTL_MS = 10 * 60_000;
  const unpersistedThreadsById = new Map<string, { createdAt: number; item: ThreadHistoryItem }>();
  const threadStartConfigOverridesByThreadId = new Map<string, ThreadStartConfigOverrides>();
  const threadContentCacheByKey = new Map<string, ThreadContentCacheEntry>();
  const serverIdByWorkspace = new Map<string, string>();
  const workspaceByServerId = new Map<string, string>();
  const serverExperimentalApiById = new Map<string, boolean>();
  const workspaceByThreadId = new Map<string, string>();
  const threadMetadataHydrationPromiseByWorkspace = new Map<string, Promise<void>>();
  const handoffDiagnosticsPromiseByThread = new Map<string, Promise<void>>();
  let warnedExperimentalApiUnavailable = false;
  let latestSwitchThreadSeq = 0;
  const skillsSnapshotByWorkspace = new Map<string, SkillsSnapshot>();
  const mcpSnapshotByWorkspace = new Map<string, McpSnapshot>();
  let globalConfigAutoLoadAttempted = false;
  const disposers: Array<() => void> = [];

  // 统一写入时间线事件，默认写到应用级线程。
  const pushEvent = (
    method: string,
    paramsText: string,
    opts?: { threadId?: string; turnId?: string; level?: "info" | "warn" | "error" }
  ) => {
    timelineStore.appendEvent({
      threadId: opts?.threadId || APP_TIMELINE_ID,
      method,
      paramsText,
      turnId: opts?.turnId,
      level: opts?.level ?? "info",
    });
  };

  const perfNow = () => {
    if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
    return Date.now();
  };

  const elapsedMs = (startedAt: number) => Number((perfNow() - startedAt).toFixed(1));

  const normalizeWorkspacePath = (value: string) => String(value ?? "").trim();

  const rememberThreadStartConfigOverrides = (
    threadIdValue: string,
    overrides: ThreadStartConfigOverrides | null | undefined
  ) => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return;
    if (overrides) threadStartConfigOverridesByThreadId.set(threadId, { ...overrides });
    else threadStartConfigOverridesByThreadId.delete(threadId);
  };

  const buildThreadStartParamsForModel = (args: {
    model: string;
    workspace: string;
    sandboxMode: string;
  }): { params: ThreadStartParams; configOverrides: ThreadStartConfigOverrides | null } => {
    const model = normalizeModelName(args.model);
    const workspace = normalizeWorkspacePath(args.workspace);
    const configOverrides = buildThreadStartConfigOverridesForModel(model);
    const approvalPolicy = normalizeApprovalPolicy(configStore.draft.approvalPolicy);
    const approvalsReviewer = normalizeApprovalsReviewer(configStore.draft.approvalsReviewer);
    return {
      configOverrides,
      params: {
        model,
        cwd: workspace,
        approvalPolicy: approvalPolicy as ThreadStartParams["approvalPolicy"],
        approvalsReviewer: approvalsReviewer as ThreadStartParams["approvalsReviewer"],
        sandbox: sandboxKebabFromUi(normalizeSandboxMode(args.sandboxMode)),
        ...(configOverrides ? { config: configOverrides } : {}),
        experimentalRawEvents: false,
        persistExtendedHistory: true,
      },
    };
  };

  const cloneSkillItems = (items: SkillState[]): SkillState[] => {
    return items.map((item) => ({ ...item }));
  };

  const cloneMcpServers = (servers: McpServerState[]): McpServerState[] => {
    return servers.map((server) => ({
      ...server,
      ...(Array.isArray(server.args) ? { args: [...server.args] } : {}),
      tools: Array.isArray(server.tools) ? server.tools.map((tool) => ({ ...tool })) : [],
      resources: Array.isArray(server.resources) ? [...server.resources] : [],
      resourceTemplates: Array.isArray(server.resourceTemplates) ? [...server.resourceTemplates] : [],
    }));
  };

  const readErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message || error.name;
    return String(error ?? "unknown error");
  };

  const createRendererCacheContext = () => ({
    threadContentCacheByKey,
    replayCacheByThread,
    replayWindowStateByThread,
    replayRequestSeqByThread,
    olderHistoryLoadPromiseByThread,
    skillsSnapshotByWorkspace,
    mcpSnapshotByWorkspace,
    mcpResourceStore,
    workspaceFilesStore,
  });

  const listRendererCaches = async (): Promise<CacheListResult> => {
    const { listRendererCachesForRuntime } = await import("./runtime/rendererCacheRegistry");
    return listRendererCachesForRuntime(createRendererCacheContext());
  };

  const clearRendererCaches = async (args?: CacheClearArgs): Promise<CacheClearResult> => {
    const { clearRendererCachesForRuntime } = await import("./runtime/rendererCacheRegistry");
    return clearRendererCachesForRuntime(createRendererCacheContext(), args);
  };

  const parseJsonRpcError = (error: unknown): JsonRpcErrorLike | null => {
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
  };

  const _isRpcMethodUnavailable = (error: unknown, method: string): boolean => {
    const rpcErr = parseJsonRpcError(error);
    if (!rpcErr) return false;
    if (rpcErr.code === -32601) return true;
    if (rpcErr.code !== -32600) return false;
    const message = String(rpcErr.message ?? "");
    return message.includes(`unknown variant \`${method}\``) || message.includes(`unknown variant '${method}'`);
  };

  const resolveWorkspacePathForFileAccess = (inputPath: string) => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!workspace) throw new Error("未选择工作区。");
    const path = resolveWorkspaceFsPath(workspace, inputPath);
    if (!path) throw new Error("无效的文件路径。");
    if (!isWithinWorkspaceFsPath(workspace, path)) {
      throw new Error("仅支持访问当前工作区内的文件。");
    }
    return { workspace, path };
  };

  // 右侧面板缓存命中时直接回填，减少切换工作区时的重复请求。
  const applySkillsSnapshot = (workspacePathValue: string): boolean => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    if (!workspace) return false;
    const snapshot = skillsSnapshotByWorkspace.get(workspace);
    if (!snapshot) return false;
    skillsStore.setItems(cloneSkillItems(snapshot.items));
    skillsStore.setParseErrors([...snapshot.parseErrors]);
    skillsStore.setSummary(snapshot.summary);
    skillsStore.setLoadState("ready");
    return true;
  };

  const saveSkillsSnapshot = (workspacePathValue: string, snapshot: SkillsSnapshot) => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    if (!workspace) return;
    skillsSnapshotByWorkspace.set(workspace, {
      items: cloneSkillItems(snapshot.items),
      parseErrors: [...snapshot.parseErrors],
      summary: snapshot.summary,
    });
  };

  const invalidateSkillsSnapshot = (workspacePathValue?: string) => {
    const workspace = normalizeWorkspacePath(workspacePathValue ?? "");
    if (!workspace) return;
    skillsSnapshotByWorkspace.delete(workspace);
  };

  const hasSkillsSnapshot = (workspacePathValue: string): boolean => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    if (!workspace) return false;
    return skillsSnapshotByWorkspace.has(workspace);
  };

  const applyMcpSnapshot = (workspacePathValue: string): boolean => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    if (!workspace) return false;
    const snapshot = mcpSnapshotByWorkspace.get(workspace);
    if (!snapshot) return false;
    mcpStore.setServers(cloneMcpServers(snapshot.servers));
    mcpStore.setStatusText(snapshot.statusText);
    mcpStore.setLoadState("ready");
    return true;
  };

  const saveMcpSnapshot = (workspacePathValue: string, snapshot: McpSnapshot) => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    if (!workspace) return;
    mcpSnapshotByWorkspace.set(workspace, {
      servers: cloneMcpServers(snapshot.servers),
      statusText: snapshot.statusText,
    });
  };

  const invalidateMcpSnapshot = (workspacePathValue?: string) => {
    const workspace = normalizeWorkspacePath(workspacePathValue ?? "");
    if (!workspace) return;
    mcpSnapshotByWorkspace.delete(workspace);
  };

  const hasMcpSnapshot = (workspacePathValue: string): boolean => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    if (!workspace) return false;
    return mcpSnapshotByWorkspace.has(workspace);
  };

  const applyCachedRightPanels = (workspacePathValue: string) => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    if (!workspace) return;
    applySkillsSnapshot(workspace);
    applyMcpSnapshot(workspace);
  };

  // 统一重置右侧面板 store，避免状态残留。
  const resetSidePanelStores = (statusText = "未连接服务") => {
    configStore.resetState(statusText);
    configRequirementsStore.resetState(statusText);
    skillsStore.resetState(statusText);
    mcpStore.resetState(statusText);
    mcpResourceStore.resetState();
    userInputStore.resetAll();
  };

  const setThreadWorkspace = (threadIdValue: string, workspacePathValue: string | undefined) => {
    const threadId = String(threadIdValue ?? "").trim();
    const workspace = normalizeWorkspacePath(String(workspacePathValue ?? ""));
    if (!threadId) return;
    if (!workspace) {
      workspaceByThreadId.delete(threadId);
      return;
    }
    workspaceByThreadId.set(threadId, workspace);
  };

  const clearThreadWorkspace = (threadIdValue: string) => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return;
    workspaceByThreadId.delete(threadId);
  };

  // 线程对应工作区的解析优先级：内存映射 > 历史记录 > 当前工作区。
  const getWorkspaceForThread = (threadIdValue: string): string => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return "";
    const mapped = normalizeWorkspacePath(workspaceByThreadId.get(threadId) ?? "");
    if (mapped) return mapped;
    const fromHistory = normalizeWorkspacePath(
      String(threadStore.threadHistory.find((item) => item.id === threadId)?.cwd ?? "")
    );
    if (fromHistory) {
      workspaceByThreadId.set(threadId, fromHistory);
      return fromHistory;
    }
    return normalizeWorkspacePath(runtimeStore.workspacePath);
  };

  const getServerIdForWorkspace = (workspacePathValue: string): string => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    if (!workspace) return "";
    return normalizeWorkspacePath(serverIdByWorkspace.get(workspace) ?? "");
  };

  const getServerIdForThread = (threadIdValue: string): string => {
    const workspace = getWorkspaceForThread(threadIdValue);
    if (!workspace) return "";
    return getServerIdForWorkspace(workspace);
  };

  const requireActiveWorkspaceServerId = (): string => {
    const serverId = getServerIdForWorkspace(runtimeStore.workspacePath);
    if (!serverId) throw new Error("server not running");
    return serverId;
  };

  const syncActiveServerByWorkspace = (workspacePathValue: string) => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    const serverId = getServerIdForWorkspace(workspace);
    if (!serverId) {
      runtimeStore.clearServer();
      appShellStore.setServerConnState("disconnected");
      resetSidePanelStores("未连接服务");
      return "";
    }
    runtimeStore.setServer(serverId);
    appShellStore.setServerConnState("connected");
    return serverId;
  };

  const warnExperimentalApiUnavailableOnce = (detail: string) => {
    if (warnedExperimentalApiUnavailable) return;
    warnedExperimentalApiUnavailable = true;
    pushEvent(
      "experimentalApi",
      detail || "当前 Codex 服务未启用 experimentalApi，Plan 等能力将自动降级，建议升级 codex。",
      { threadId: APP_TIMELINE_ID, level: "warn" }
    );
    showToast({
      kind: "warn",
      title: "experimentalApi 未启用",
      message: detail || "当前 Codex 服务未启用 experimentalApi，Plan 等能力将自动降级；建议升级 codex。",
    });
  };

  // 启动成功后登记工作区与服务实例的双向映射。
  const registerServerForWorkspace = (workspacePathValue: string, serverIdValue: string, experimentalApi = false) => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    const serverId = normalizeWorkspacePath(serverIdValue);
    if (!workspace || !serverId) return;
    serverIdByWorkspace.set(workspace, serverId);
    workspaceByServerId.set(serverId, workspace);
    serverExperimentalApiById.set(serverId, Boolean(experimentalApi));
  };

  // 通过 serverId 回收映射并返回对应工作区。
  const clearServerById = (serverIdValue: string) => {
    const serverId = normalizeWorkspacePath(serverIdValue);
    if (!serverId) return "";
    const workspace = normalizeWorkspacePath(workspaceByServerId.get(serverId) ?? "");
    workspaceByServerId.delete(serverId);
    serverExperimentalApiById.delete(serverId);
    if (workspace) {
      const mapped = normalizeWorkspacePath(serverIdByWorkspace.get(workspace) ?? "");
      if (mapped === serverId) serverIdByWorkspace.delete(workspace);
    }
    return workspace;
  };

  const configRuntime = createConfigRuntime({
    requireActiveWorkspaceServerId,
    getWorkspacePath: () => String(runtimeStore.workspacePath ?? "").trim(),
    onBatchWriteUnavailable: () => {
      pushEvent("config", "config/batchWrite 不可用，已降级为 config/value/write", {
        threadId: APP_TIMELINE_ID,
        level: "warn",
      });
    },
  });
  const { requestConfigRead, requestConfigRequirementsRead, requestConfigBatchWrite } = configRuntime;

  const requestThreadRead = async (threadIdValue: string): Promise<ServerThread> => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) throw new Error("missing thread id");
    const workspace = getWorkspaceForThread(threadId);
    const serverId = await ensureServerForWorkspace(workspace);
    if (!serverId) throw new Error("server not running");
    const params: ThreadReadParams = { threadId, includeTurns: true };
    const res = await codexDesktop.codexServer.rpc({
      serverId,
      method: "thread/read",
      params,
    });
    return res.result.thread;
  };

  const skillsRuntime = createSkillsRuntime({
    requireActiveWorkspaceServerId,
    getServerIdForWorkspace,
    getWorkspacePath: () => String(runtimeStore.workspacePath ?? "").trim(),
  });
  const { requestSkillsList, writeSkillConfig } = skillsRuntime;

  const mcpRuntime = createMcpRuntime({
    requireActiveWorkspaceServerId,
    getWorkspacePath: () => String(runtimeStore.workspacePath ?? "").trim(),
    getWorkspaceForThread,
    ensureServerForWorkspace: (workspace) => ensureServerForWorkspace(workspace),
  });
  const {
    requestMcpStatusList,
    requestReloadMcpConfig,
    requestWriteMcpEnabled,
    requestStartMcpOAuthLogin,
    requestMcpResourceRead,
  } = mcpRuntime;

  const requestThreadRollback = async (threadIdValue: string, turns: number): Promise<boolean> => {
    const tid = String(threadIdValue ?? "").trim();
    if (!tid) return false;
    const serverId = getServerIdForThread(tid);
    if (!serverId) return false;
    const n = Number.isFinite(turns) ? Math.max(1, Math.round(turns)) : 1;
    try {
      await codexDesktop.codexServer.rpc({
        serverId,
        method: "thread/rollback",
        params: { threadId: tid, numTurns: n },
      });
      return true;
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("rollback:error", msg || "thread/rollback failed", { threadId: tid, level: "error" });
      showToast({ kind: "error", title: "撤回失败", message: "thread/rollback 请求失败" });
      return false;
    }
  };

  const resolveHistoryRewriteAnchorTurnId = (threadIdValue: string): string => {
    const directTurnId = String(runtimeStore.historyRewriteAnchorTurnId ?? "").trim();
    if (directTurnId) return directTurnId;

    const anchorEventId = String(runtimeStore.historyRewriteAnchorEventId ?? "").trim();
    if (!anchorEventId) return "";
    const anchorEvent = timelineStore
      .eventsForThread(threadIdValue)
      .find((event) => String(event?.id ?? "").trim() === anchorEventId);
    return String(anchorEvent?.turnId ?? "").trim();
  };

  const rollbackHistoryRewriteBeforeSend = async (threadIdValue: string): Promise<boolean> => {
    if (!runtimeStore.historyRewriteActive || runtimeStore.historyRewriteSource !== "history") return true;

    const tid = String(threadIdValue ?? "").trim();
    if (!tid) {
      showToast({ kind: "info", title: "无法重写历史", message: "未选择会话。" });
      return false;
    }
    if (threadStore.runningThreadIds.has(tid)) {
      showToast({ kind: "warn", title: "线程运行中", message: "请等待当前回合完成后再发送编辑后的消息。" });
      return false;
    }

    const workspace = normalizeWorkspacePath(getWorkspaceForThread(tid) || runtimeStore.workspacePath);
    const serverId = getServerIdForThread(tid);
    if (!workspace) {
      showToast({ kind: "error", title: "无法重写历史", message: "未选择工作区或工作区不可用。" });
      return false;
    }
    if (!serverId) {
      showToast({ kind: "error", title: "无法重写历史", message: "未连接服务或服务不可用。" });
      return false;
    }

    const anchorTurnId = resolveHistoryRewriteAnchorTurnId(tid);
    const rollback = resolveHistoryRewriteRollback(threadStore.completedTurnsByThread.get(tid) ?? [], anchorTurnId);
    if (!rollback) {
      showToast({
        kind: "error",
        title: "无法重写历史",
        message: "找不到该消息对应的可撤回回合，请改用最新消息继续对话。",
      });
      return false;
    }

    let confirmed = false;
    try {
      confirmed = await confirmModalLazy({
        title: "发送编辑后的历史消息？",
        message: `会先撤回从该消息开始的 ${rollback.count} 个已完成回合，再发送编辑后的内容。`,
        detail: "撤回会回退线程上下文，并尝试回退这些回合产生的文件内容改动（不回退命令副作用）。",
        confirmText: "撤回并发送",
        cancelText: "取消",
        danger: true,
      });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      const isBusy = msg.includes("another modal is already open");
      showToast({
        kind: isBusy ? "warn" : "error",
        title: "无法打开确认弹窗",
        message: isBusy ? "当前已有弹窗打开，请先关闭后再重试。" : "打开弹窗失败",
      });
      return false;
    }
    if (!confirmed) return false;

    if (rollback.combinedDiff.trim()) {
      const dry = await codexDesktop.workspace.dryRunApplyReverseDiff({ cwd: workspace, diffText: rollback.combinedDiff });
      if (!dry.ok) {
        pushEvent("rollback:error", `无法回退文件内容：${dry.error}`, { threadId: tid, level: "error" });
        showToast({ kind: "error", title: "重写失败", message: "文件回退预检失败（工作区可能已手动修改）" });
        return false;
      }
    }

    const resumed = await ensureThreadResumed(tid);
    if (!resumed) return false;
    const ok = await requestThreadRollback(tid, rollback.count);
    if (!ok) return false;

    if (rollback.combinedDiff.trim()) {
      const applied = await codexDesktop.workspace.applyReverseDiff({ cwd: workspace, diffText: rollback.combinedDiff });
      if (!applied.ok) {
        timelineStore.removeTurnEvents(tid, rollback.turnIds);
        threadStore.removeTurnsFromState(tid, rollback.turnIds);
        runtimeStore.endHistoryRewrite();
        pushEvent("rollback:error", `上下文已撤回，但文件回退失败：${applied.error}`, {
          threadId: tid,
          level: "error",
        });
        showToast({ kind: "error", title: "部分失败", message: "上下文已撤回，但文件回退失败；请手动检查工作区。" });
        return false;
      }
      pushEvent("rollback", `history rewrite files reverted: ${(applied.files ?? []).join(", ")}`, { threadId: tid });
    } else {
      pushEvent("rollback", "history rewrite has no file diff; context only", { threadId: tid });
    }

    timelineStore.removeTurnEvents(tid, rollback.turnIds);
    threadStore.removeTurnsFromState(tid, rollback.turnIds);
    showToast({ kind: "success", title: "历史已回退", message: `已撤回 ${rollback.count} 个回合，正在发送编辑内容。` });
    return true;
  };

  const preserveNonHistoryTimelineEvents = (
    threadIdValue: string,
    historyEventIds: Set<string>,
    latestReplayCreatedAt: number
  ): TimelineEventItem[] => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return [];
    const existing = timelineStore.eventsForThread(threadId);
    if (existing.length === 0) return [];
    return existing
      .filter((event) => {
        const id = String(event.id ?? "").trim();
        if (!id) return false;
        if (isReplayCarryoverEvent(event)) return true;
        if (historyEventIds.has(id)) return false;
        const createdAt = Number.isFinite(event.createdAt) ? Number(event.createdAt) : 0;
        return createdAt > latestReplayCreatedAt;
      })
      .map((event) => ({ ...event }));
  };

  const rebuildRollbackStateFromReplay = (
    threadIdValue: string,
    events: Array<{ method: string; turnId?: string; params?: unknown; paramsText: string; createdAt?: number }>
  ) => {
    threadStore.replaceRollbackState(threadIdValue, buildCompletedTurnsFromReplay(events));
  };

  const renderReplayEvents = (threadIdValue: string, replayEvents: ThreadReplayCache) => {
    const historyEventIds = new Set<string>();
    for (const event of replayEvents) {
      const id = String(event.id ?? "").trim();
      if (!id) continue;
      historyEventIds.add(id);
    }
    const latestReplayCreatedAt = replayEvents.reduce((max, event) => {
      const createdAt = Number.isFinite(event.createdAt) ? Number(event.createdAt) : 0;
      return Math.max(max, createdAt);
    }, 0);
    const preservedTimelineEvents = preserveNonHistoryTimelineEvents(
      threadIdValue,
      historyEventIds,
      latestReplayCreatedAt
    );
    const combined = [
      ...sortReplayEvents(replayEvents).map((event) => ({
        id: event.id,
        method: event.method,
        paramsText: event.paramsText,
        params: event.params,
        turnId: event.turnId,
        level: event.level,
        localKind: event.localKind,
        localState: event.localState,
        thinkingPhase: event.thinkingPhase,
        localMessageId: undefined as string | undefined,
        hidden: event.hidden,
        createdAt: event.createdAt,
      })),
      ...preservedTimelineEvents.map((prompt) => ({
        id: prompt.id,
        method: prompt.method,
        paramsText: prompt.paramsText,
        params: prompt.params,
        turnId: prompt.turnId,
        level: prompt.level,
        localKind: prompt.localKind,
        localState: prompt.localState,
        thinkingPhase: prompt.thinkingPhase,
        localMessageId: prompt.localMessageId,
        hidden: prompt.hidden,
        createdAt: prompt.createdAt,
      })),
    ].sort((a, b) => {
      const ta = Number.isFinite(a.createdAt) ? Number(a.createdAt) : 0;
      const tb = Number.isFinite(b.createdAt) ? Number(b.createdAt) : 0;
      if (ta !== tb) return ta - tb;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });

    const seenIds = new Set<string>();
    const unique: typeof combined = [];
    for (const item of combined) {
      const id = String(item.id ?? "").trim();
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      unique.push(item);
    }

    const planKeyById = new Map<string, string>();
    const bestTextByPlanKey = new Map<string, string>();
    const selectedIdByPlanKey = new Map<string, { id: string; preferNotif: boolean; textLen: number }>();

    const preferNotifPlanId = (id: string) => id.startsWith("notif:item/plan/delta:");

    const considerPlanCandidate = (planKey: string, item: (typeof unique)[number]) => {
      if (!planKey) return;
      const id = String(item.id ?? "").trim();
      if (!id) return;

      const text = normalizePlanText(item.paramsText);
      const textLen = text.length;
      const existingBest = bestTextByPlanKey.get(planKey);
      if (!existingBest || textLen > existingBest.length) bestTextByPlanKey.set(planKey, text);

      const candidatePreferNotif = preferNotifPlanId(id);
      const existing = selectedIdByPlanKey.get(planKey);
      if (!existing) {
        selectedIdByPlanKey.set(planKey, { id, preferNotif: candidatePreferNotif, textLen });
        return;
      }
      if (candidatePreferNotif && !existing.preferNotif) {
        selectedIdByPlanKey.set(planKey, { id, preferNotif: candidatePreferNotif, textLen });
        return;
      }
      if (candidatePreferNotif === existing.preferNotif && textLen > existing.textLen) {
        selectedIdByPlanKey.set(planKey, { id, preferNotif: candidatePreferNotif, textLen });
      }
    };

    const transformed = unique.map((raw) => {
      const id = String(raw.id ?? "").trim();
      const turnKey = toPlanTurnKey(raw.turnId, raw.createdAt);

      if (raw.method === "item/plan/delta") {
        const sig = toPlanSignatureText(raw.paramsText);
        if (sig) {
          const planKey = `${turnKey}|${sig}`;
          planKeyById.set(id, planKey);
          considerPlanCandidate(planKey, raw);
        }
        return raw;
      }

      if (raw.method === "item/agentMessage/delta") {
        const proposedBody = extractProposedPlanBody(raw.paramsText);
        const proposedSig = toPlanSignatureText(proposedBody);
        if (proposedBody && proposedSig) {
          const planKey = `${turnKey}|${proposedSig}`;
          const cleanedText = stripProposedPlanTags(raw.paramsText);
          const next = {
            ...raw,
            method: "item/plan/delta",
            paramsText: cleanedText,
          };
          planKeyById.set(id, planKey);
          considerPlanCandidate(planKey, next);
          return next;
        }
        return raw;
      }

      return raw;
    });

    rebuildRollbackStateFromReplay(threadIdValue, transformed);
    const nextTimelineEvents: TimelineEventItem[] = [];

    for (const item of transformed) {
      const id = String(item.id ?? "").trim();
      if (!id) continue;

      // turn diff 仅用于回滚状态重建/摘要，不写入时间线 UI。
      if (item.method === "turn/diff/updated") continue;

      const planKey = planKeyById.get(id) ?? "";
      if (planKey) {
        const selected = selectedIdByPlanKey.get(planKey);
        if (!selected || selected.id !== id) continue;
        const bestText = bestTextByPlanKey.get(planKey);
        const paramsText = typeof bestText === "string" && bestText ? bestText : item.paramsText;
        nextTimelineEvents.push({
          id,
          method: "item/plan/delta",
          paramsText,
          params: item.params,
          turnId: item.turnId,
          level: item.level ?? "info",
          localKind: item.localKind,
          localState: item.localState,
          thinkingPhase: item.thinkingPhase,
          localMessageId: item.localMessageId,
          hidden: item.hidden,
          createdAt: Number.isFinite(item.createdAt) ? Number(item.createdAt) : Date.now(),
        });
        continue;
      }

      nextTimelineEvents.push({
        id,
        method: item.method,
        paramsText: item.paramsText,
        params: item.params,
        turnId: item.turnId,
        level: item.level ?? "info",
        localKind: item.localKind,
        localState: item.localState,
        thinkingPhase: item.thinkingPhase,
        localMessageId: item.localMessageId,
        hidden: item.hidden,
        createdAt: Number.isFinite(item.createdAt) ? Number(item.createdAt) : Date.now(),
      });
    }

    timelineStore.replaceThreadEvents(threadIdValue, nextTimelineEvents);
  };

  const hydrateReplayFromCacheIfNeeded = (threadIdValue: string): boolean => {
    const cache = replayCacheByThread.get(threadIdValue);
    if (!cache) return false;
    const existingTimelineEventCount = timelineStore.eventsForThread(threadIdValue).length;
    if (existingTimelineEventCount === 0) {
      renderReplayEvents(threadIdValue, cache);
    }
    return true;
  };

  const nextReplayRequestSeq = (threadIdValue: string): number => {
    const next = (replayRequestSeqByThread.get(threadIdValue) ?? 0) + 1;
    replayRequestSeqByThread.set(threadIdValue, next);
    return next;
  };

  const isReplayRequestSeqCurrent = (threadIdValue: string, requestSeq: number): boolean => {
    return (replayRequestSeqByThread.get(threadIdValue) ?? 0) === requestSeq;
  };

  const markReplayIncompatible = (threadIdValue: string, detail: string) => {
    replayCacheByThread.delete(threadIdValue);
    replayWindowStateByThread.delete(threadIdValue);
    olderHistoryLoadPromiseByThread.delete(threadIdValue);
    timelineStore.clearThread(threadIdValue);
    threadStore.replaceRollbackState(threadIdValue, []);
    timelineStore.appendEvent({
      threadId: threadIdValue,
      method: "history/replay_incompatible",
      paramsText: detail,
      level: "error",
    });
  };

  const loadReplayBatchFromSessions = async (threadIdValue: string, before = 0): Promise<ReplayBatchResult> => {
    const page = await codexDesktop.history.getThreadEvents({
      threadId: threadIdValue,
      limit: HISTORY_REPLAY_BATCH,
      before,
    });
    const entries = Array.isArray(page?.entries) ? page.entries : [];
    const events = entries.length > 0 ? await parseSessionReplayEventsLazy(entries, threadIdValue) : [];
    return {
      loaded: Number.isFinite(page?.loaded) ? Math.max(0, Math.round(Number(page.loaded))) : 0,
      hasMore: Boolean(page?.hasMore),
      events,
    };
  };

  const collectReplayEventsForTurnCount = async (
    threadIdValue: string,
    requestSeq: number,
    opts?: {
      turnLimit?: number;
      before?: number;
      seedEvents?: ReplayTimelineEvent[];
      hasMorePages?: boolean;
    }
  ): Promise<{
    events: ThreadReplayCache;
    nextBefore: number;
    hasMorePages: boolean;
  } | null> => {
    const turnLimit = Number.isFinite(opts?.turnLimit)
      ? Math.max(1, Math.round(Number(opts?.turnLimit)))
      : HISTORY_REPLAY_TURN_SEGMENTS;
    let before = Number.isFinite(opts?.before) ? Math.max(0, Math.round(Number(opts?.before))) : 0;
    let hasMorePages = opts?.hasMorePages ?? true;
    let collected = dedupeReplayEvents(opts?.seedEvents ?? []);

    while (countReplayTurns(collected) < turnLimit && hasMorePages) {
      const { loaded, hasMore, events } = await loadReplayBatchFromSessions(threadIdValue, before);
      if (!isReplayRequestSeqCurrent(threadIdValue, requestSeq)) return null;
      collected = dedupeReplayEvents([...events, ...collected]);

      if (hasMore && loaded <= before) {
        throw new Error(`history pagination stalled at loaded=${loaded}, before=${before}`);
      }
      before = loaded;
      hasMorePages = hasMore;
    }

    return {
      events: collected,
      nextBefore: before,
      hasMorePages,
    };
  };

  const countTimelineTurnsForThread = (threadIdValue: string): number => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return 0;
    timelineStore.flushPendingAppends();
    const events = timelineStore.eventsForThread(threadId);
    const turnIds = new Set<string>();
    for (const event of events) {
      const turnId = String(event?.turnId ?? "").trim();
      if (turnId) turnIds.add(turnId);
    }
    return turnIds.size;
  };

  const loadHistoryMessages = async (threadIdValue: string): Promise<boolean> => {
    if (!threadIdValue) return false;

    const requestSeq = nextReplayRequestSeq(threadIdValue);
    replayCacheByThread.delete(threadIdValue);
    replayWindowStateByThread.delete(threadIdValue);

    try {
      const collected = await collectReplayEventsForTurnCount(threadIdValue, requestSeq, {
        turnLimit: HISTORY_REPLAY_TURN_SEGMENTS,
      });
      if (!collected) return false;
      if (!isReplayRequestSeqCurrent(threadIdValue, requestSeq)) return false;
      const { olderEvents, visibleEvents } = splitReplayEventsByRecentTurns(
        collected.events,
        HISTORY_REPLAY_TURN_SEGMENTS
      );
      replayWindowStateByThread.set(threadIdValue, {
        nextBefore: collected.nextBefore,
        hasMorePages: collected.hasMorePages,
        bufferedOlderEvents: olderEvents,
      });
      replayCacheByThread.set(threadIdValue, visibleEvents);
      renderReplayEvents(threadIdValue, visibleEvents);
      return true;
    } catch (sessionsErr: any) {
      if (!isReplayRequestSeqCurrent(threadIdValue, requestSeq)) return false;
      const sessionsMsg = sessionsErr?.message ? String(sessionsErr.message) : String(sessionsErr);
      markReplayIncompatible(threadIdValue, `历史回放失败：sessions=${sessionsMsg}`);
      return false;
    }
  };

  const loadOlderHistoryTurns = async (threadIdValue?: string): Promise<boolean> => {
    const threadId = String(threadIdValue ?? runtimeStore.timelineKey ?? "").trim();
    if (!threadId) return false;

    const pending = olderHistoryLoadPromiseByThread.get(threadId);
    if (pending) return pending;

    // turn window：达到上限后不再继续向上补历史。
    if (countTimelineTurnsForThread(threadId) >= TIMELINE_MAX_VISIBLE_TURNS) return false;
    const requestSeq = nextReplayRequestSeq(threadId);

    const task = (async () => {
      const currentState = replayWindowStateByThread.get(threadId);
      if (!hasOlderReplayHistory(currentState)) return false;

      const collected = await collectReplayEventsForTurnCount(threadId, requestSeq, {
        turnLimit: HISTORY_REPLAY_TURN_SEGMENTS,
        before: currentState?.nextBefore ?? 0,
        seedEvents: currentState?.bufferedOlderEvents ?? [],
        hasMorePages: currentState?.hasMorePages ?? false,
      });
      if (!collected) return false;
      if (!isReplayRequestSeqCurrent(threadId, requestSeq)) return false;

      const { olderEvents, visibleEvents } = splitReplayEventsByRecentTurns(
        collected.events,
        HISTORY_REPLAY_TURN_SEGMENTS
      );
      replayWindowStateByThread.set(threadId, {
        nextBefore: collected.nextBefore,
        hasMorePages: collected.hasMorePages,
        bufferedOlderEvents: olderEvents,
      });
      if (visibleEvents.length === 0) return false;

      const previousCache = replayCacheByThread.get(threadId) ?? [];
      const nextCache = dedupeReplayEvents([...visibleEvents, ...previousCache]);
      if (nextCache.length === previousCache.length) return false;

      replayCacheByThread.set(threadId, nextCache);
      renderReplayEvents(threadId, nextCache);
      return true;
    })()
      .catch((sessionsErr: any) => {
        if (!isReplayRequestSeqCurrent(threadId, requestSeq)) return false;
        const sessionsMsg = sessionsErr?.message ? String(sessionsErr.message) : String(sessionsErr);
        markReplayIncompatible(threadId, `历史回放失败：sessions=${sessionsMsg}`);
        return false;
      })
      .finally(() => {
        olderHistoryLoadPromiseByThread.delete(threadId);
      });

    olderHistoryLoadPromiseByThread.set(threadId, task);
    return task;
  };

  const requestThreadListPage = async (
    workspacePathValue: string,
    archived: boolean,
    cursor?: string | null
  ): Promise<ThreadListResponse> => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    const serverId = getServerIdForWorkspace(workspace);
    if (!workspace || !serverId) {
      return { data: [], nextCursor: null, backwardsCursor: null };
    }
    const params: ThreadListParams = {
      cwd: workspace,
      archived,
      cursor: cursor ?? null,
      limit: THREAD_METADATA_PAGE_SIZE,
      sortKey: "updated_at",
      sourceKinds: ALL_THREAD_SOURCE_KINDS,
    };
    const { result } = await codexDesktop.codexServer.rpc({
      serverId,
      method: "thread/list",
      params,
    });
    return result;
  };

  const requestAllThreadsForWorkspace = async (workspacePathValue: string): Promise<ServerThread[]> => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    if (!workspace) return [];
    const deduped = new Map<string, ServerThread>();

    for (const archived of [false, true]) {
      let cursor: string | null = null;
      while (true) {
        const page = await requestThreadListPage(workspace, archived, cursor);
        const threads = Array.isArray(page?.data) ? page.data : [];
        for (const thread of threads) {
          const threadId = normalizeOptionalText(thread?.id);
          if (!threadId) continue;
          deduped.set(threadId, thread);
        }
        const nextCursor = normalizeOptionalText(page?.nextCursor);
        if (!nextCursor) break;
        cursor = nextCursor;
      }
    }

    return [...deduped.values()];
  };

  const hydrateThreadMetadataForWorkspace = async (workspacePathValue: string): Promise<void> => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    const serverId = getServerIdForWorkspace(workspace);
    if (!workspace || !serverId) return;

    const existing = threadMetadataHydrationPromiseByWorkspace.get(workspace);
    if (existing) return existing;

    const task = (async () => {
      try {
        const threads = await requestAllThreadsForWorkspace(workspace);
        const patches = threads.flatMap((thread) => {
          const patch = buildHistoryThreadMetadataPatchFromServerThread(thread);
          return patch ? [patch] : [];
        });
        if (patches.length === 0) return;
        await codexDesktop.history.mergeThreadMetadata({ threads: patches });
      } catch (e: any) {
        const rpcErr = parseJsonRpcError(e);
        if (rpcErr?.code === -32601) return;
        const msg = e?.message ? String(e.message) : String(e);
        if (isIpcHandlerMissingError(msg, IPC_HISTORY_CHANNELS.historyMergeThreadMetadata)) return;
        console.warn("[runtimeOrchestrator] thread metadata hydration failed", { workspace, msg });
      } finally {
        threadMetadataHydrationPromiseByWorkspace.delete(workspace);
      }
    })();

    threadMetadataHydrationPromiseByWorkspace.set(workspace, task);
    return task;
  };

  const hydrateThreadHandoffDiagnostics = async (
    threadIdValue: string,
    options?: { force?: boolean }
  ): Promise<void> => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId || threadId === APP_TIMELINE_ID) return;

    const historyItem = threadStore.threadHistory.find((item) => String(item.id ?? "").trim() === threadId);
    const parentThreadId = historyItem ? resolveThreadParentIdForGraph(historyItem) : "";
    if (!parentThreadId) {
      threadStore.clearThreadHandoffDiagnostics(threadId);
      return;
    }

    if (!options?.force && threadStore.handoffDiagnosticsByThread.has(threadId)) return;
    const existing = handoffDiagnosticsPromiseByThread.get(threadId);
    if (existing) return existing;

    const task = (async () => {
      threadStore.setThreadHandoffDiagnosticsLoading(threadId, true);
      try {
        const [currentResult, parentResult] = await Promise.allSettled([
          requestThreadRead(threadId),
          requestThreadRead(parentThreadId),
        ]);
        if (currentResult.status !== "fulfilled") throw currentResult.reason;

        const { buildThreadHandoffDiagnostics } = await import(
          "../features/history/threadHandoffDiagnostics"
        );
        const diagnostics = buildThreadHandoffDiagnostics({
          threadId,
          parentThreadId,
          currentThread: currentResult.value,
          parentThread: parentResult.status === "fulfilled" ? parentResult.value : null,
        });
        threadStore.setThreadHandoffDiagnostics(threadId, diagnostics);

        if (parentResult.status !== "fulfilled") {
          const parentError = parentResult.reason;
          const parentMsg = parentError?.message ? String(parentError.message) : String(parentError);
          console.warn("[runtimeOrchestrator] parent thread handoff diagnostics degraded", {
            threadId,
            parentThreadId,
            msg: parentMsg,
          });
        }
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : String(e);
        console.warn("[runtimeOrchestrator] thread handoff diagnostics failed", { threadId, parentThreadId, msg });
        threadStore.clearThreadHandoffDiagnostics(threadId);
      } finally {
        threadStore.setThreadHandoffDiagnosticsLoading(threadId, false);
        handoffDiagnosticsPromiseByThread.delete(threadId);
      }
    })();

    handoffDiagnosticsPromiseByThread.set(threadId, task);
    return task;
  };

  const refreshGlobalConfig = async () => {
    if (!getServerIdForWorkspace(runtimeStore.workspacePath)) {
      configStore.resetState("未连接服务");
      configRequirementsStore.resetState("未连接服务");
      return;
    }
    configStore.setLoadState("loading", "读取配置中…");
    configRequirementsStore.setLoadState("loading", "读取 requirements 中…");

    const [configResult, requirementsResult] = await Promise.allSettled([
      requestConfigRead(),
      requestConfigRequirementsRead(),
    ]);

    if (configResult.status === "fulfilled") {
      const draft = extractGlobalConfigFromReadResult(configResult.value);
      configStore.applySnapshot(draft);
      configStore.setLoadState("ready", "已同步生效配置（config/read）");
    } else {
      const error = configResult.reason;
      const msg = error?.message ? String(error.message) : String(error);
      configStore.setLoadState("error", `读取失败：${msg}`);
    }

    if (requirementsResult.status === "fulfilled") {
      const requirements = extractConfigRequirementsFromReadResult(requirementsResult.value);
      configRequirementsStore.setRequirements(requirements);
      configRequirementsStore.setLoadState(
        "ready",
        requirements ? "已同步服务端限制（configRequirements/read）" : "当前服务端未配置 requirements"
      );
      return;
    }

    const requirementsError = requirementsResult.reason;
    const rpcErr = parseJsonRpcError(requirementsError);
    const requirementsMsg = requirementsError?.message ? String(requirementsError.message) : String(requirementsError);
    configRequirementsStore.setRequirements(null);
    if (rpcErr?.code === -32601) {
      configRequirementsStore.setLoadState("ready", "当前服务端未提供 configRequirements/read，已按无约束处理");
      return;
    }
    configRequirementsStore.setLoadState("error", `读取 requirements 失败：${requirementsMsg}；已按无约束处理`);
  };

  const ensureGlobalConfigLoadedOnce = async () => {
    // “只在启动时加载一次”：首次在已连接服务的前提下触发，之后不再自动读取（手动刷新不受影响）。
    if (globalConfigAutoLoadAttempted) return;
    if (!getServerIdForWorkspace(runtimeStore.workspacePath)) return;
    globalConfigAutoLoadAttempted = true;
    await refreshGlobalConfig();
  };

  const saveGlobalConfig = async (options?: { source?: "manual" | "auto"; silentSuccessToast?: boolean }) => {
    const source = options?.source ?? "manual";
    const silentSuccessToast =
      typeof options?.silentSuccessToast === "boolean" ? options.silentSuccessToast : source === "auto";
    if (!getServerIdForWorkspace(runtimeStore.workspacePath) || configStore.saving) return;
    const baseline = configStore.snapshot ?? createDefaultGlobalConfigDraft();
    const draft = configStore.draft ?? createDefaultGlobalConfigDraft();
    const changes = buildConfigBatchChangesFromDraft(draft, baseline);
    if (changes.length === 0) {
      configStore.setLoadState("ready", "已同步生效配置（config/read）");
      return;
    }
    configStore.setSaving(true);
    configStore.setLoadState("ready", "保存中…");
    try {
      await requestConfigBatchWrite(changes);
      pushEvent("config", `saved ${changes.length} keys`, { threadId: APP_TIMELINE_ID });
      await refreshGlobalConfig();
      if (!silentSuccessToast) {
        showToast({
          kind: "success",
          title: source === "auto" ? "全局配置已自动保存" : "全局配置已保存",
          message: `已写入 ${changes.length} 项`,
        });
      }
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      configStore.setLoadState("error", `保存失败：${msg}`);
      pushEvent("config:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({
        kind: "error",
        title: source === "auto" ? "全局配置自动保存失败" : "全局配置保存失败",
        message: msg,
      });
    } finally {
      configStore.setSaving(false);
      if (configStore.loadState !== "error") {
        configStore.setLoadState("ready", configStore.isDirty ? "有未保存改动" : "已同步生效配置（config/read）");
      }
    }
  };

  const resetGlobalConfig = () => {
    configStore.resetToSnapshot();
    configStore.setLoadState("ready", configStore.isDirty ? "有未保存改动" : "已同步生效配置（config/read）");
  };

  const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
  const normalizeExternalUrlForOpen = (url: string): string => {
    const raw = String(url ?? "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw);
      const protocol = String(parsed.protocol ?? "").toLowerCase();
      if (!ALLOWED_EXTERNAL_PROTOCOLS.has(protocol)) return "";
      if ((protocol === "http:" || protocol === "https:") && !parsed.hostname) return "";
      return parsed.toString();
    } catch {
      return "";
    }
  };

  // 统一外链打开入口。
  const openExternalUrl = async (url: string) => {
    const value = normalizeExternalUrlForOpen(url);
    if (!value) throw new Error("仅支持 http/https/mailto 外链。");
    await codexDesktop.app.openExternal({ url: value });
  };

  const workspaceFileRuntime = createWorkspaceFileRuntime(resolveWorkspacePathForFileAccess);
  const {
    readTextFile,
    writeTextFile,
    readWorkspaceDirectory,
    getWorkspaceMetadata,
    readWorkspaceTextFile,
    writeWorkspaceTextFile,
  } = workspaceFileRuntime;

  const refreshSkills = async (forceReload = false) => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!getServerIdForWorkspace(workspace)) {
      skillsStore.resetState("未连接服务");
      return;
    }
    if (!workspace) {
      skillsStore.resetState("未选择工作区");
      return;
    }
    const hasVisibleData = skillsStore.loadState === "ready" && skillsStore.items.length > 0;
    if (forceReload || !hasVisibleData) {
      skillsStore.setLoadState("loading");
    }
    try {
      const res = await requestSkillsList(forceReload);
      skillsStore.setItems(res.entries);
      skillsStore.setParseErrors(res.errors);
      skillsStore.setSummary(res.summary);
      skillsStore.setLoadState("ready");
      saveSkillsSnapshot(workspace, {
        items: res.entries,
        parseErrors: res.errors,
        summary: res.summary,
      });
      if (res.entries.length === 0) {
        pushEvent("skills:empty", res.summary, { threadId: APP_TIMELINE_ID });
      }
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      if (hasVisibleData) {
        skillsStore.setLoadState("ready");
      } else {
        skillsStore.setLoadState("error", msg);
      }
    }
  };

  const toggleSkill = async (skillPath: string, enabled: boolean) => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!getServerIdForWorkspace(workspace)) return;
    try {
      await writeSkillConfig(skillPath, enabled);
      invalidateSkillsSnapshot(workspace);
      pushEvent("skills", `${enabled ? "enabled" : "disabled"}\n${skillPath}`, { threadId: APP_TIMELINE_ID });
      await refreshSkills(true);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("skills:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({ kind: "error", title: "技能配置失败", message: msg });
      throw e;
    }
  };

  const refreshMcp = async () => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!getServerIdForWorkspace(workspace)) {
      mcpStore.resetState("未连接服务");
      return;
    }
    const hasVisibleData = mcpStore.loadState === "ready" && mcpStore.servers.length > 0;
    if (!hasVisibleData) {
      mcpStore.setLoadState("loading");
      mcpStore.setStatusText("加载中…");
    }
    try {
      // 合并配置层与状态层两路数据，得到完整 MCP 展示模型。
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
          url: server.url,
          command: server.command,
          args: server.args,
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
      const statusText = merged.length === 0 ? "暂无 MCP 配置" : `共 ${merged.length} 个 MCP 服务器`;
      mcpStore.setStatusText(statusText);
      saveMcpSnapshot(workspace, {
        servers: merged,
        statusText,
      });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      if (hasVisibleData) {
        mcpStore.setLoadState("ready");
      } else {
        mcpStore.setLoadState("error", msg);
        mcpStore.setStatusText("加载失败");
      }
    }
  };

  const reloadMcpConfig = async () => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!getServerIdForWorkspace(workspace)) return;
    try {
      await requestReloadMcpConfig();
      invalidateMcpSnapshot(workspace);
      pushEvent("mcp", "配置已重载", { threadId: APP_TIMELINE_ID });
      await refreshMcp();
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("mcp:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({ kind: "error", title: "MCP 重载失败", message: msg });
      throw e;
    }
  };

  const toggleMcpEnabled = async (serverKey: string, enabled: boolean) => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!getServerIdForWorkspace(workspace)) return;
    try {
      await requestWriteMcpEnabled(serverKey, enabled);
      await requestReloadMcpConfig();
      invalidateMcpSnapshot(workspace);
      pushEvent("mcp", `enabled=${enabled ? "true" : "false"}\n${serverKey}`, { threadId: APP_TIMELINE_ID });
      await refreshMcp();
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("mcp:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({ kind: "error", title: "MCP 配置失败", message: msg });
      throw e;
    }
  };

  const startMcpOAuthLogin = async (serverKey: string) => {
    if (!getServerIdForWorkspace(runtimeStore.workspacePath)) return;
    try {
      const url = await requestStartMcpOAuthLogin(serverKey);
      await openExternalUrl(url);
      pushEvent("mcp", `oauth login started\nid=${serverKey}\nurl=${url}`, { threadId: APP_TIMELINE_ID });
      showToast({ kind: "success", title: "已打开浏览器", message: `MCP OAuth：${serverKey}` });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("mcp:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({ kind: "error", title: "MCP OAuth 失败", message: msg });
      throw e;
    }
  };

  const historyThreadRuntime = createHistoryThreadRuntime({
    getCurrentThreadId: () => String(runtimeStore.currentThreadId ?? "").trim(),
    threadContentCacheByKey,
    threadContentCacheTtlMs: THREAD_CONTENT_CACHE_TTL_MS,
  });
  const { readThreadContent, createThreadTask, updateThreadTask } = historyThreadRuntime;

  const mcpResourceReadRuntime = createMcpResourceReadRuntime({
    getServers: () => mcpStore.servers,
    getTemplateDraft: (templateKey) => mcpResourceStore.getTemplateDraft(templateKey),
    requestMcpResourceRead,
    upsertTimelineEvent: (params) => timelineStore.upsertEvent(params),
  });
  const { readMcpResource } = mcpResourceReadRuntime;

  const refreshRightPanels = async (opts?: { forceSkills?: boolean; forceMcp?: boolean }) => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!workspace || !getServerIdForWorkspace(workspace)) return;
    const shouldRefreshSkills = Boolean(opts?.forceSkills) || !hasSkillsSnapshot(workspace);
    const shouldRefreshMcp = Boolean(opts?.forceMcp) || !hasMcpSnapshot(workspace);
    const tasks: Promise<unknown>[] = [ensureGlobalConfigLoadedOnce()];
    if (shouldRefreshSkills) tasks.push(refreshSkills(false));
    if (shouldRefreshMcp) tasks.push(refreshMcp());
    await Promise.allSettled(tasks);
  };

  const clearThreadRuntimeState = (threadIdValue: string) => {
    const id = String(threadIdValue ?? "").trim();
    if (!id) return;
    threadStore.threadHistory = threadStore.threadHistory.filter((item) => item.id !== id);
    unpersistedThreadsById.delete(id);
    threadStore.clearThreadState(id);
    timelineStore.clearThread(id);
    // 删除线程时同步清理“排队消息”的线程级持久化，避免幽灵队列残留。
    messageQueueStore.clearThreadQueue(id);
    runtimeStore.clearThreadComposeState(id);
    replayCacheByThread.delete(id);
    replayWindowStateByThread.delete(id);
    replayRequestSeqByThread.delete(id);
    olderHistoryLoadPromiseByThread.delete(id);
    resumedThreadIds.delete(id);
    resumePromisesByThread.delete(id);
    threadStartConfigOverridesByThreadId.delete(id);
    workspaceByThreadId.delete(id);
    if (runtimeStore.currentThreadId === id) {
      runtimeStore.setCurrentThread("", { savePrev: false });
      threadStore.setCurrentThread("");
    }
  };

  const ensureServerForWorkspace = async (workspacePathValue: string): Promise<string> => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    if (!workspace) return "";
    const existingServerId = getServerIdForWorkspace(workspace);
    if (existingServerId) {
      if (normalizeWorkspacePath(runtimeStore.workspacePath) === workspace) {
        syncActiveServerByWorkspace(workspace);
      }
      void hydrateThreadMetadataForWorkspace(workspace);
      return existingServerId;
    }
    try {
      if (normalizeWorkspacePath(runtimeStore.workspacePath) === workspace) {
        appShellStore.setServerConnState("connecting");
      }
      const requestedExperimentalApi = true;
      const res = await codexDesktop.codexServer.start({ cwd: workspace, experimentalApi: requestedExperimentalApi });
      const serverId = normalizeWorkspacePath(String(res.serverId ?? ""));
      if (!serverId) throw new Error("serverStart did not return serverId");
      const experimentalApi = Boolean(res.capabilities?.experimentalApi);
      registerServerForWorkspace(workspace, serverId, experimentalApi);
      if (normalizeWorkspacePath(runtimeStore.workspacePath) === workspace) {
        runtimeStore.setServer(serverId);
        appShellStore.setServerConnState("connected");
      }
      if (requestedExperimentalApi && !experimentalApi) {
        warnExperimentalApiUnavailableOnce(
          "当前 Codex 服务未启用 experimentalApi，Plan 等能力将自动降级，建议升级 codex。"
        );
      }
      pushEvent(
        "server",
        `started id=${serverId}\nworkspace=${workspace}\nexperimentalApi.requested=${requestedExperimentalApi}\nexperimentalApi.enabled=${experimentalApi}`,
        { threadId: APP_TIMELINE_ID }
      );

      void Promise.allSettled([
        refreshHistory(false),
        hydrateThreadMetadataForWorkspace(workspace),
        normalizeWorkspacePath(runtimeStore.workspacePath) === workspace
          ? refreshRightPanels({ forceSkills: true, forceMcp: true })
          : Promise.resolve(),
      ]);
      return serverId;
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      if (normalizeWorkspacePath(runtimeStore.workspacePath) === workspace) {
        appShellStore.setServerConnState("failed", msg);
      }
      pushEvent("server:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({ kind: "error", title: "服务启动失败", message: msg });
      return "";
    }
  };

  const startServer = async () => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!workspace) {
      showToast({ kind: "warn", title: "未选择工作区", message: "请先选择工作区后再启动服务。" });
      return false;
    }
    const serverId = await ensureServerForWorkspace(workspace);
    return Boolean(serverId);
  };

  const applyWorkspaceSelection = async (selectedValue: string) => {
    const selected = normalizeWorkspacePath(selectedValue);
    if (!selected) return false;
    if (selected !== normalizeWorkspacePath(runtimeStore.workspacePath)) {
      const confirmed = await workspaceFilesStore.confirmResetDirtyTabsForWorkspaceChange(selected);
      if (!confirmed) return false;
    }
    runtimeStore.setWorkspace(selected);
    threadStore.setWorkspace(selected);
    pushEvent("workspace", selected, { threadId: APP_TIMELINE_ID });
    void workspaceFilesStore.ensureReady(true);
    const activeServerId = syncActiveServerByWorkspace(selected);
    if (activeServerId) {
      applyCachedRightPanels(selected);
      void refreshRightPanels();
    }
    return true;
  };

  const ensureWorkspaceForSend = async (): Promise<boolean> => {
    const cwd = String(runtimeStore.workspacePath ?? "").trim();
    if (cwd) return true;
    const selected = await codexDesktop.workspace.select();
    if (!selected) {
      showToast({ kind: "info", title: "已取消发送", message: "已取消选择工作区，消息未发送。" });
      return false;
    }
    return await applyWorkspaceSelection(selected);
  };

  const ensureThreadResumed = async (threadId: string): Promise<boolean> => {
    const tid = String(threadId ?? "").trim();
    if (!tid) return false;
    if (resumedThreadIds.has(tid)) {
      return true;
    }
    const existing = resumePromisesByThread.get(tid);
    if (existing) {
      return existing;
    }
    const task = (async (): Promise<boolean> => {
      try {
        const workspace = getWorkspaceForThread(tid);
        const serverId = await ensureServerForWorkspace(workspace);
        if (!serverId) return false;
        const resumeParams: ThreadResumeParams = { threadId: tid, persistExtendedHistory: true };
        await codexDesktop.codexServer.rpc({ serverId, method: "thread/resume", params: resumeParams });
        resumedThreadIds.add(tid);
        return true;
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : String(e);
        pushEvent("thread:resume:error", msg, { threadId, level: "error" });
        return false;
      } finally {
        resumePromisesByThread.delete(tid);
      }
    })();
    resumePromisesByThread.set(tid, task);
    return task;
  };

  const hasThreadModelToolConfigForModel = (threadIdValue: string, modelValue: string): boolean => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return false;
    return hasThreadStartConfigOverridesForModel(threadStartConfigOverridesByThreadId.get(threadId), modelValue);
  };

  const hasStartedConversationActivity = (threadIdValue: string): boolean => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return false;
    return timelineStore.eventsForThread(threadId).some((event) => {
      const method = String(event.method ?? "").trim();
      return (
        event.localKind === "user" ||
        method === "user" ||
        method.startsWith("turn/") ||
        method.startsWith("item/") ||
        method.startsWith("local/")
      );
    });
  };

  const canRecreateEmptyUnpersistedThreadForModelConfig = (threadIdValue: string): boolean => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return false;
    if (!unpersistedThreadsById.has(threadId)) return false;
    if (threadStore.runningThreadIds.has(threadId)) return false;
    return !hasStartedConversationActivity(threadId);
  };

  const recreateEmptyUnpersistedThreadForModelConfig = async (args: {
    threadId: string;
    threadWorkspace: string;
    threadServerId: string;
    model: string;
  }): Promise<string> => {
    const oldThreadId = String(args.threadId ?? "").trim();
    const workspace = normalizeWorkspacePath(args.threadWorkspace);
    const serverId = String(args.threadServerId ?? "").trim();
    const model = normalizeModelName(args.model);
    if (!oldThreadId || !workspace || !serverId) throw new Error("invalid thread recreation params");

    const existing = threadStore.threadHistory.find((item) => item.id === oldThreadId);
    const oldStub = unpersistedThreadsById.get(oldThreadId);
    const { params: threadStartParams, configOverrides } = buildThreadStartParamsForModel({
      model,
      workspace,
      sandboxMode: runtimeStore.sandboxMode,
    });
    const startedAt = perfNow();
    appendDebugLog("thread.create", "recreate empty thread for model config begin", {
      oldThreadId,
      workspace,
      model,
      config: threadStartParams.config ?? null,
    });

    const res = await codexDesktop.codexServer.rpc({
      serverId,
      method: "thread/start",
      params: threadStartParams,
    });
    const newThreadId = String(res.result?.thread?.id ?? "").trim();
    if (!newThreadId) throw new Error("thread/start did not return thread id");

    const oldTitle = String(existing?.title ?? oldStub?.item?.title ?? "").trim();
    const oldFallback = fallbackThreadTitle(oldThreadId);
    const nextTitle = oldTitle && oldTitle !== oldFallback ? oldTitle : fallbackThreadTitle(newThreadId);
    const now = Date.now();
    const nextHistoryItem: ThreadHistoryItem = {
      ...(oldStub?.item ?? existing ?? {}),
      id: newThreadId,
      title: nextTitle,
      meta: String(existing?.meta ?? oldStub?.item?.meta ?? workspace).trim() || "无工作区",
      cwd: workspace || undefined,
      updatedAt: now,
      running: false,
      unpersisted: true,
    };

    runtimeStore.moveThreadComposeState(oldThreadId, newThreadId);
    runtimeStore.movePendingThreadInitSendCount(oldThreadId, newThreadId);
    timelineStore.moveThread(oldThreadId, newThreadId);
    threadStore.replaceThreadId(oldThreadId, newThreadId, nextHistoryItem);
    messageQueueStore.moveThreadQueue(oldThreadId, newThreadId);

    unpersistedThreadsById.delete(oldThreadId);
    unpersistedThreadsById.set(newThreadId, {
      createdAt: oldStub?.createdAt ?? now,
      item: { ...nextHistoryItem },
    });
    resumedThreadIds.delete(oldThreadId);
    resumedThreadIds.add(newThreadId);
    resumePromisesByThread.delete(oldThreadId);
    threadStartConfigOverridesByThreadId.delete(oldThreadId);
    rememberThreadStartConfigOverrides(newThreadId, configOverrides);
    replayCacheByThread.delete(oldThreadId);
    replayWindowStateByThread.delete(oldThreadId);
    replayRequestSeqByThread.delete(oldThreadId);
    olderHistoryLoadPromiseByThread.delete(oldThreadId);
    setThreadWorkspace(newThreadId, workspace);
    clearThreadWorkspace(oldThreadId);
    runtimeStore.setCurrentThread(newThreadId, { savePrev: false });
    threadStore.setCurrentThread(newThreadId);

    appendDebugLog("thread.create", "recreate empty thread for model config resolved", {
      oldThreadId,
      threadId: newThreadId,
      model,
      elapsedMs: elapsedMs(startedAt),
    });
    return newThreadId;
  };

  const resumeThreadWithModelToolConfig = async (args: {
    threadId: string;
    threadWorkspace: string;
    threadServerId: string;
    model: string;
    configOverrides: ThreadStartConfigOverrides;
  }): Promise<boolean> => {
    const threadId = String(args.threadId ?? "").trim();
    const workspace = normalizeWorkspacePath(args.threadWorkspace);
    const serverId = String(args.threadServerId ?? "").trim();
    const model = normalizeModelName(args.model);
    if (!threadId || !workspace || !serverId) return false;
    try {
      const resumeParams: ThreadResumeParams = {
        threadId,
        model,
        cwd: workspace,
        config: { ...args.configOverrides },
        persistExtendedHistory: true,
      };
      const res = await codexDesktop.codexServer.rpc({ serverId, method: "thread/resume", params: resumeParams });
      const appliedModel = normalizeModelName((res.result as any)?.model ?? model);
      if (appliedModel !== model) return false;
      resumedThreadIds.add(threadId);
      rememberThreadStartConfigOverrides(threadId, args.configOverrides);
      return true;
    } catch (error) {
      pushEvent("thread:resume:error", readErrorMessage(error), { threadId, level: "error" });
      return false;
    }
  };

  const ensureThreadModelToolCompatibility = async (args: {
    threadId: string;
    threadWorkspace: string;
    threadServerId: string;
    model: string;
  }): Promise<{ ok: true; threadId: string } | { ok: false; error: string }> => {
    const threadId = String(args.threadId ?? "").trim();
    const model = normalizeModelName(args.model);
    const configOverrides = buildThreadStartConfigOverridesForModel(model);
    if (!configOverrides) return { ok: true, threadId };
    if (hasThreadModelToolConfigForModel(threadId, model)) return { ok: true, threadId };

    if (canRecreateEmptyUnpersistedThreadForModelConfig(threadId)) {
      try {
        const nextThreadId = await recreateEmptyUnpersistedThreadForModelConfig({
          threadId,
          threadWorkspace: args.threadWorkspace,
          threadServerId: args.threadServerId,
          model,
        });
        return { ok: true, threadId: nextThreadId };
      } catch (error) {
        return { ok: false, error: readErrorMessage(error) || "无法创建 Spark 会话" };
      }
    }

    if (!resumedThreadIds.has(threadId)) {
      const resumed = await resumeThreadWithModelToolConfig({
        threadId,
        threadWorkspace: args.threadWorkspace,
        threadServerId: args.threadServerId,
        model,
        configOverrides,
      });
      if (resumed && hasThreadModelToolConfigForModel(threadId, model)) return { ok: true, threadId };
    }

    return {
      ok: false,
      error: "当前会话创建时未关闭 image_generation；请新建一个 Spark 会话后再发送。",
    };
  };

  const applyHistoryItems = (items: HistoryThread[]) => {
    invalidateThreadContentCache(threadContentCacheByKey);
    const now = Date.now();
    const incomingThreadIds = new Set<string>();
    for (const item of items) {
      const threadId = String(item?.id ?? "").trim();
      if (threadId) incomingThreadIds.add(threadId);
    }
    for (const [threadId, stub] of unpersistedThreadsById.entries()) {
      if (!threadId) {
        unpersistedThreadsById.delete(threadId);
        continue;
      }
      if (incomingThreadIds.has(threadId)) {
        unpersistedThreadsById.delete(threadId);
        continue;
      }
      if (now - stub.createdAt > UNPERSISTED_THREAD_TTL_MS) {
        unpersistedThreadsById.delete(threadId);
      }
    }
    const previousTitleById = new Map(
      threadStore.threadHistory.map((item) => [String(item.id ?? "").trim(), String(item.title ?? "").trim()])
    );
    const historyItems = items
      .map((item) => {
        const historyItem = toThreadHistoryItemFromHistory(item);
        const threadId = String(historyItem.id ?? "").trim();
        const placeholder = fallbackThreadTitle(threadId);
        const nextTitle = String(historyItem.title ?? "").trim();
        const previousTitle = String(previousTitleById.get(threadId) ?? "").trim();
        if ((!nextTitle || nextTitle === placeholder) && previousTitle && previousTitle !== placeholder) {
          historyItem.title = previousTitle;
        }
        return historyItem;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const mergedItems: ThreadHistoryItem[] = [...historyItems];
    const mergedThreadIds = new Set(mergedItems.map((item) => String(item?.id ?? "").trim()).filter(Boolean));
    for (const [threadId, stub] of unpersistedThreadsById.entries()) {
      const tid = String(threadId ?? "").trim();
      if (!tid || mergedThreadIds.has(tid)) continue;
      mergedItems.push({ ...stub.item });
      mergedThreadIds.add(tid);
    }
    mergedItems.sort((a, b) => b.updatedAt - a.updatedAt);

    threadStore.threadHistory = mergedItems;
    for (const item of items) {
      const threadId = String(item.id ?? "").trim();
      if (!threadId) continue;
      const running = Boolean(item.running);
      const activeTurnId = running ? String(item.activeTurnId ?? "").trim() : "";
      threadStore.setThreadRunning(threadId, running);
      threadStore.setActiveTurn(threadId, activeTurnId);
    }
    for (const item of mergedItems) {
      setThreadWorkspace(item.id, item.cwd);
    }
  };

  const refreshHistory = async (force = false) => {
    const startedAt = perfNow();
    appendDebugLog("history.refresh", "started", { force });
    try {
      const result = force ? await codexDesktop.history.refresh() : await codexDesktop.history.list();
      const items = Array.isArray(result?.items) ? result.items : [];
      applyHistoryItems(items);
      void hydrateThreadMetadataForWorkspace(runtimeStore.workspacePath);
      appendDebugLog("history.refresh", "completed", {
        force,
        count: items.length,
        elapsedMs: elapsedMs(startedAt),
      });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      appendDebugLog("history.refresh", "failed", {
        force,
        elapsedMs: elapsedMs(startedAt),
        message: msg,
      });
      console.warn("[runtimeOrchestrator] refreshHistory failed", msg);
    }
  };

  const checkEnvironment = async () => {
    showToast({ kind: "info", title: "检查环境", message: "正在检测 codex/node/npm..." });

    try {
      const res = await codexDesktop.codexServer.getDiagnostics();
      const ready = Boolean(res.codex.ok) && Boolean(res.node.ok) && Boolean(res.npm.ok);
      const details = [
        `codex：${res.codex.ok ? "正常" : "缺失"}`,
        String(res.codex.details ?? "").trim(),
        `node：${res.node.ok ? "正常" : "缺失"}`,
        String(res.node.details ?? "").trim(),
        `npm：${res.npm.ok ? "正常" : "缺失"}`,
        String(res.npm.details ?? "").trim(),
      ]
        .filter(Boolean)
        .join("\n");

      pushEvent("env", details, {
        threadId: APP_TIMELINE_ID,
        level: ready ? "info" : "error",
      });

      if (ready) {
        showToast({ kind: "success", title: "环境正常", message: "codex/node/npm 已就绪" });
        return;
      }

      appShellStore.openSettings("env");
      showToast({ kind: "warn", title: "环境未就绪", message: "请按“环境检测”中的指引手动安装所需环境。" });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      showToast({ kind: "error", title: "检查失败", message: msg });
      pushEvent("env:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
    }
  };

  const selectWorkspace = async () => {
    const selected = await codexDesktop.workspace.select();
    if (!selected) return;
    const applied = await applyWorkspaceSelection(selected);
    if (!applied) return;
    await startServer();
  };

  const switchWorkspace = async (workspacePathValue: string): Promise<boolean> => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    if (!workspace) return false;
    const applied = await applyWorkspaceSelection(workspace);
    if (!applied) return false;
    await startServer();
    return true;
  };

  const createThread = async () => {
    const attemptId = beginThreadCreateAttempt();
    const createStartedAt = perfNow();
    const workspaceBeforeStart = normalizeWorkspacePath(runtimeStore.workspacePath);
    const serverIdBeforeStart = getServerIdForWorkspace(workspaceBeforeStart);
    const previousThreadId = String(runtimeStore.currentThreadId ?? "").trim();
    const globalDraft = configStore.draft ?? createDefaultGlobalConfigDraft();
    const newThreadComposeSeed = buildNewThreadComposeSeed({
      previousThreadId,
      runtime: {
        composeMode: runtimeStore.composeMode,
        model: normalizeModelName(runtimeStore.model),
        reasoningEffort: normalizeEffort(runtimeStore.reasoningEffort),
        reasoningSummary: normalizeReasoningSummary(runtimeStore.reasoningSummary),
        sandboxMode: normalizeSandboxMode(runtimeStore.sandboxMode),
      },
      global: {
        model: normalizeModelName(globalDraft.model),
        reasoningEffort: normalizeEffort(globalDraft.modelReasoningEffort),
        reasoningSummary: normalizeReasoningSummary(globalDraft.modelReasoningSummary),
        sandboxMode: normalizeSandboxMode(globalDraft.sandboxMode),
      },
    });
    const optimisticThreadId = createPendingThreadId();
    appendDebugLog("thread.create", "clicked", {
      attemptId,
      workspace: workspaceBeforeStart || null,
      currentThreadId: String(runtimeStore.currentThreadId ?? "").trim() || null,
      serverReady: Boolean(serverIdBeforeStart),
      serverId: serverIdBeforeStart || null,
    });
    runtimeStore.seedThreadComposeStateFromSeed(optimisticThreadId, newThreadComposeSeed);
    setThreadWorkspace(optimisticThreadId, workspaceBeforeStart);
    runtimeStore.clearPendingThreadInitSendCount(optimisticThreadId);
    const optimisticCreatedAt = Date.now();
    const optimisticHistoryItem: ThreadHistoryItem = {
      id: optimisticThreadId,
      title: "创建中",
      meta: workspaceBeforeStart || "无工作区",
      cwd: workspaceBeforeStart || undefined,
      updatedAt: optimisticCreatedAt,
      running: false,
      unpersisted: true,
    };
    threadStore.upsertThreadHistory(optimisticHistoryItem);
    unpersistedThreadsById.set(optimisticThreadId, {
      createdAt: optimisticCreatedAt,
      item: { ...optimisticHistoryItem },
    });
    runtimeStore.setCurrentThread(optimisticThreadId);
    threadStore.setCurrentThread(optimisticThreadId);
    appendDebugLog("thread.create", "optimistic thread shown", {
      attemptId,
      optimisticThreadId,
      elapsedMs: elapsedMs(createStartedAt),
    });
    const startServerStartedAt = perfNow();
    const ok = await startServer();
    appendDebugLog("thread.create", "startServer completed", {
      attemptId,
      ok,
      workspace: normalizeWorkspacePath(runtimeStore.workspacePath) || null,
      elapsedMs: elapsedMs(startServerStartedAt),
      totalElapsedMs: elapsedMs(createStartedAt),
    });
    if (!ok) {
      const queued = messageQueueStore.queueByThread.get(optimisticThreadId) ?? [];
      const candidate = queued.length > 0 ? queued[queued.length - 1] : null;
      clearThreadRuntimeState(optimisticThreadId);
      if (previousThreadId) {
        runtimeStore.setCurrentThread(previousThreadId, { savePrev: false });
        threadStore.setCurrentThread(previousThreadId);
        if (candidate) {
          try {
            const queueInputs = cloneUserTurnInputs(Array.isArray(candidate.inputs) ? candidate.inputs : []);
            const { attachments } = await buildComposeAttachmentsFromUserTurnInputs(queueInputs);
            const draft = buildComposeDraftFromUserTurnInputs(queueInputs);
            runtimeStore.composeInput = draft.composeInput || String(candidate.text ?? "");
            runtimeStore.composeAttachments = attachments;
            runtimeStore.composeFileMentions = draft.composeFileMentions;
            runtimeStore.saveThreadComposeAttachments(runtimeStore.currentThreadId);
            runtimeStore.saveThreadComposeFileMentions(runtimeStore.currentThreadId);
            showToast({ kind: "warn", title: "线程创建失败", message: "已恢复待发送内容，请重试发送。" });
          } catch {}
        }
      }
      appendDebugLog("thread.create", "optimistic thread rolled back", {
        attemptId,
        optimisticThreadId,
        reason: "startServer failed",
        totalElapsedMs: elapsedMs(createStartedAt),
      });
      return;
    }
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    const serverId = getServerIdForWorkspace(workspace);
    if (!serverId) {
      const queued = messageQueueStore.queueByThread.get(optimisticThreadId) ?? [];
      const candidate = queued.length > 0 ? queued[queued.length - 1] : null;
      clearThreadRuntimeState(optimisticThreadId);
      if (previousThreadId) {
        runtimeStore.setCurrentThread(previousThreadId, { savePrev: false });
        threadStore.setCurrentThread(previousThreadId);
        if (candidate) {
          try {
            const queueInputs = cloneUserTurnInputs(Array.isArray(candidate.inputs) ? candidate.inputs : []);
            const { attachments } = await buildComposeAttachmentsFromUserTurnInputs(queueInputs);
            const draft = buildComposeDraftFromUserTurnInputs(queueInputs);
            runtimeStore.composeInput = draft.composeInput || String(candidate.text ?? "");
            runtimeStore.composeAttachments = attachments;
            runtimeStore.composeFileMentions = draft.composeFileMentions;
            runtimeStore.saveThreadComposeAttachments(runtimeStore.currentThreadId);
            runtimeStore.saveThreadComposeFileMentions(runtimeStore.currentThreadId);
            showToast({ kind: "warn", title: "线程创建失败", message: "已恢复待发送内容，请重试发送。" });
          } catch {}
        }
      }
      appendDebugLog("thread.create", "aborted: missing serverId after startServer", {
        attemptId,
        workspace: workspace || null,
        totalElapsedMs: elapsedMs(createStartedAt),
      });
      return;
    }
    try {
      // 重要：`thread/start` 的 `sandbox` 使用 kebab-case（见 schema 的 v2/ThreadStartParams.json）。
      const { params: threadStartParams, configOverrides: modelConfigOverrides } = buildThreadStartParamsForModel({
        model: newThreadComposeSeed.model,
        workspace,
        sandboxMode: newThreadComposeSeed.sandboxMode,
      });
      const rpcStartedAt = perfNow();
      appendDebugLog("thread.create", "thread/start rpc begin", {
        attemptId,
        serverId,
        workspace: workspace || null,
        model: threadStartParams.model,
        sandbox: threadStartParams.sandbox,
        approvalPolicy: threadStartParams.approvalPolicy,
      });
      const res = await codexDesktop.codexServer.rpc({
        serverId,
        method: "thread/start",
        params: threadStartParams,
      });
      const result = res.result;
      if (!result) throw new Error("thread/start failed");
      const id = String(result.thread?.id ?? "").trim();
      if (!id) throw new Error("thread/start did not return thread id");
      rememberThreadStartConfigOverrides(id, modelConfigOverrides);
      bindThreadCreateAttemptToThread(attemptId, id);
      appendDebugLog("thread.create", "thread/start rpc resolved", {
        attemptId,
        threadId: id,
        elapsedMs: elapsedMs(rpcStartedAt),
        totalElapsedMs: elapsedMs(createStartedAt),
      });
      const applyStateStartedAt = perfNow();
      runtimeStore.moveThreadComposeState(optimisticThreadId, id);
      runtimeStore.clearPendingThreadInitSendCount(optimisticThreadId);
      timelineStore.moveThread(optimisticThreadId, id);
      const finalizedHistoryItem: ThreadHistoryItem = {
        id,
        title: `Thread ${id.slice(-8)}`,
        meta: workspace || "无工作区",
        cwd: workspace || undefined,
        updatedAt: Date.now(),
        running: false,
        unpersisted: true,
      };
      threadStore.replaceThreadId(optimisticThreadId, id, {
        title: finalizedHistoryItem.title,
        meta: finalizedHistoryItem.meta,
        cwd: finalizedHistoryItem.cwd,
        updatedAt: finalizedHistoryItem.updatedAt,
        running: finalizedHistoryItem.running,
      });
      const stub = unpersistedThreadsById.get(optimisticThreadId);
      if (stub) {
        unpersistedThreadsById.delete(optimisticThreadId);
        unpersistedThreadsById.set(id, {
          createdAt: stub.createdAt,
          item: { ...stub.item, ...finalizedHistoryItem },
        });
      } else {
        unpersistedThreadsById.set(id, { createdAt: Date.now(), item: { ...finalizedHistoryItem } });
      }
      messageQueueStore.moveThreadQueue(optimisticThreadId, id);
      resumedThreadIds.add(id);
      setThreadWorkspace(id, workspace);
      clearThreadWorkspace(optimisticThreadId);
      pushEvent("thread", "会话已创建", { threadId: id });
      appendDebugLog("thread.create", "local state applied", {
        attemptId,
        threadId: id,
        threadHistorySize: threadStore.threadHistory.length,
        elapsedMs: elapsedMs(applyStateStartedAt),
        totalElapsedMs: elapsedMs(createStartedAt),
      });
      const nextTickStartedAt = perfNow();
      await nextTick();
      appendDebugLog("thread.create", "nextTick flushed", {
        attemptId,
        threadId: id,
        elapsedMs: elapsedMs(nextTickStartedAt),
        totalElapsedMs: elapsedMs(createStartedAt),
      });
      if (!threadStore.runningThreadIds.has(id)) void flushQueueForThread(id);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      const queued = messageQueueStore.queueByThread.get(optimisticThreadId) ?? [];
      const candidate = queued.length > 0 ? queued[queued.length - 1] : null;
      clearThreadRuntimeState(optimisticThreadId);
      if (previousThreadId) {
        runtimeStore.setCurrentThread(previousThreadId, { savePrev: false });
        threadStore.setCurrentThread(previousThreadId);
        if (candidate) {
          try {
            const queueInputs = cloneUserTurnInputs(Array.isArray(candidate.inputs) ? candidate.inputs : []);
            const { attachments } = await buildComposeAttachmentsFromUserTurnInputs(queueInputs);
            const draft = buildComposeDraftFromUserTurnInputs(queueInputs);
            runtimeStore.composeInput = draft.composeInput || String(candidate.text ?? "");
            runtimeStore.composeAttachments = attachments;
            runtimeStore.composeFileMentions = draft.composeFileMentions;
            runtimeStore.saveThreadComposeAttachments(runtimeStore.currentThreadId);
            runtimeStore.saveThreadComposeFileMentions(runtimeStore.currentThreadId);
            showToast({ kind: "warn", title: "线程创建失败", message: "已恢复待发送内容，请重试发送。" });
          } catch {}
        }
      }
      appendDebugLog("thread.create", "failed", {
        attemptId,
        workspace: workspace || null,
        serverId,
        elapsedMs: elapsedMs(createStartedAt),
        message: msg,
      });
      pushEvent("thread:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
    }
  };

  const switchThread = async (threadId: string) => {
    const id = String(threadId ?? "").trim();
    if (!id) return;
    const switchStartedAt = perfNow();
    const target = threadStore.threadHistory.find((item) => item.id === id);
    const targetRunning = threadStore.runningThreadIds.has(id);
    const existingTimelineEvents = timelineStore.eventsForThread(id);
    const canFastActivateRunningThread = targetRunning && existingTimelineEvents.length > 0;
    const prevWorkspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    const nextCwd = normalizeWorkspacePath(String(target?.cwd ?? getWorkspaceForThread(id)));
    const didWorkspaceChange = Boolean(nextCwd && nextCwd !== prevWorkspace);
    if (didWorkspaceChange) {
      const confirmed = await workspaceFilesStore.confirmResetDirtyTabsForWorkspaceChange(nextCwd);
      if (!confirmed) return;
    }
    const switchSeq = ++latestSwitchThreadSeq;
    const isActiveSwitch = () => switchSeq === latestSwitchThreadSeq;
    appendDebugLog("thread.switch", "begin", {
      threadId: id,
      running: targetRunning,
      existingTimelineEventCount: existingTimelineEvents.length,
      hasReplayCache: replayCacheByThread.has(id),
      fastActivate: canFastActivateRunningThread,
    });
    threadStore.setLoadingThread(id);
    runtimeStore.setCurrentThread(id);
    threadStore.setCurrentThread(id);
    const reusedReplayCache = hydrateReplayFromCacheIfNeeded(id);
    const shouldLoadHistory = !canFastActivateRunningThread && !reusedReplayCache;
    if (canFastActivateRunningThread) {
      appendDebugLog("thread.switch", "fast activate live timeline", {
        threadId: id,
        existingTimelineEventCount: existingTimelineEvents.length,
      });
    }
    const historyLoadPromise = shouldLoadHistory ? loadHistoryMessages(id) : Promise.resolve(true);
    if (shouldLoadHistory) {
      void historyLoadPromise.finally(() => {
        if (isActiveSwitch()) threadStore.clearLoadingThread(id);
      });
    } else {
      threadStore.clearLoadingThread(id);
    }
    try {
      if (didWorkspaceChange) {
        runtimeStore.setWorkspace(nextCwd);
        threadStore.setWorkspace(nextCwd);
        pushEvent("workspace:history", nextCwd, { threadId: APP_TIMELINE_ID });
        syncActiveServerByWorkspace(nextCwd);
      }
      const workspace = nextCwd || prevWorkspace;
      if (!workspace) {
        await historyLoadPromise;
        return;
      }
      const serverId = await ensureServerForWorkspace(workspace);
      if (!isActiveSwitch()) return;
      if (!serverId) {
        return;
      }
      setThreadWorkspace(id, workspace);
      applyCachedRightPanels(workspace);
      await historyLoadPromise;
      if (!isActiveSwitch()) return;
      appendDebugLog("thread.switch", "history loaded", { threadId: id, elapsedMs: elapsedMs(switchStartedAt) });

      // 恢复线程上下文不应阻塞“打开线程”；发送/回滚等入口会再次确保 resume。
      void ensureThreadResumed(id);
      void hydrateThreadHandoffDiagnostics(id, { force: true });

      // 刷新文件树可能较慢，尽量让时间线先渲染，再后台刷新，避免“点进去卡住”的观感。
      const mode = didWorkspaceChange ? "full" : "light";
      void nextTick().then(() => {
        if (!isActiveSwitch()) {
          return;
        }
        void workspaceFilesStore.reloadTreeForThreadSwitch({ mode });
      });

      void refreshRightPanels();
    } finally {
      threadStore.clearLoadingThread(id);
    }
  };

  const deleteHistoryThread = async (threadId: string) => {
    const id = String(threadId ?? "").trim();
    if (!id) return;
    try {
      await codexDesktop.history.deleteThread({ threadId: id });
      invalidateThreadContentCache(threadContentCacheByKey, id);
      clearThreadRuntimeState(id);
      pushEvent("history", "已删除会话", { threadId: APP_TIMELINE_ID });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      showToast({ kind: "error", title: "删除失败", message: msg });
      pushEvent("history:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
    }
  };

  const turnInputRuntime = createTurnInputRuntime();
  const {
    cloneUserTurnInputs,
    toCodexUserInputs,
    fileNameFromPathLike,
    buildComposeAttachmentsFromUserTurnInputs,
    buildTimelineUserMessagePayload,
    buildUserTurnInput,
    summarizeLocalUserMessage,
  } = turnInputRuntime;

  const requestTurnSteer = async (threadId: string, input: UserTurnInput[], turnIdValue: string) => {
    const serverId = getServerIdForThread(threadId);
    if (!serverId) return false;
    if (!turnIdValue) {
      pushEvent("steer:error", "缺少 active turnId，无法执行 turn/steer", { threadId, level: "error" });
      return false;
    }
    const params = {
      threadId,
      expectedTurnId: turnIdValue,
      input: toCodexUserInputs(input),
    };
    try {
      await codexDesktop.codexServer.rpc({ serverId, method: "turn/steer", params });
      return true;
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("steer:error", msg || "turn/steer failed", { threadId, level: "error" });
      return false;
    }
  };

  const turnStartRuntime = createTurnStartRuntime({
    getServerExperimentalApi: (serverId) => Boolean(serverExperimentalApiById.get(serverId)),
    setServerExperimentalApi: (serverId, enabled) => serverExperimentalApiById.set(serverId, enabled),
    getComposeMode: () => runtimeStore.composeMode,
    setComposeMode: (mode) => runtimeStore.setComposeMode(mode),
    getAssistantFinalMessageFormat: () => appShellStore.assistantFinalMessageFormat,
    setAssistantFinalMessageFormat: (format) => appShellStore.setAssistantFinalMessageFormat(format),
    getModel: () => runtimeStore.model,
    getReasoningEffort: () => runtimeStore.reasoningEffort,
    getReasoningSummary: () => runtimeStore.reasoningSummary,
    getSandboxMode: () => runtimeStore.sandboxMode,
    getApprovalPolicy: () => configStore.draft.approvalPolicy,
    getApprovalsReviewer: () => configStore.draft.approvalsReviewer,
    toCodexUserInputs,
    parseJsonRpcError,
    warnExperimentalApiUnavailableOnce,
  });
  const { startTurnWithInput } = turnStartRuntime;

  const sendOrQueueText = async (mode: "auto" | "steer") => {
    const composeInput = String(runtimeStore.composeInput ?? "");
    const composeAttachments = runtimeStore.composeAttachments.map((item: ComposeImageAttachment) => ({
      ...item,
      input: { ...item.input },
    }));
    const composeFileMentions = runtimeStore.composeFileMentions.map((item: ComposeWorkspaceFileMention) => ({
      ...item,
    }));
    const input = buildUserTurnInput(composeInput, composeAttachments, composeFileMentions);
    if (input.length === 0) return;
    const localUserMessage = summarizeLocalUserMessage(input);
    const visibleText = String(localUserMessage.payload.text ?? "").trim();
    const queueText = String(localUserMessage.payload.text ?? "");

    const workspaceReady = await ensureWorkspaceForSend();
    if (!workspaceReady) {
      showToast({ kind: "error", title: "无法发送", message: "未选择工作区或工作区不可用。" });
      return;
    }
    const activeWorkspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    const activeServerId = await ensureServerForWorkspace(activeWorkspace);
    if (!activeServerId) {
      showToast({ kind: "error", title: "无法发送", message: "未连接服务或服务不可用。" });
      return;
    }
    if (!runtimeStore.currentThreadId) {
      void createThread();
    }
    let threadId = String(runtimeStore.currentThreadId ?? "").trim();
    if (!threadId) {
      showToast({ kind: "error", title: "无法发送", message: "会话尚未就绪，请稍后重试。" });
      return;
    }
    if (isPendingThreadId(threadId)) {
      const prevCount = runtimeStore.pendingThreadInitSendCountByThread.get(threadId) ?? 0;
      const nextCount = Number.isFinite(prevCount) ? Math.max(0, Math.round(prevCount)) + 1 : 1;
      runtimeStore.setPendingThreadInitSendCount(threadId, nextCount);

      runtimeStore.composeInput = "";
      runtimeStore.clearComposeAttachments();
      runtimeStore.clearComposeFileMentions();
      runtimeStore.endHistoryRewrite();

      const localUserEventId = `local:user:${Date.now()}:${Math.random().toString(16).slice(2)}`;
      const localUserMessageId = `local-user-msg:${Date.now()}:${Math.random().toString(16).slice(2)}`;
      timelineStore.appendEvent({
        threadId,
        id: localUserEventId,
        method: "user",
        paramsText: localUserMessage.displayText,
        params: localUserMessage.payload,
        level: "warn",
        localKind: "user",
        localState: "queued",
        localMessageId: localUserMessageId,
      });
      runtimeStore.requestScrollTimelineToBottom();
      messageQueueStore.enqueue({
        threadId,
        text: queueText,
        inputs: input,
        localEventId: localUserEventId,
        displayText: localUserMessage.displayText,
      });

      appendDebugLog("thread.create", "pending send queued", {
        threadId,
        queuedCount: nextCount,
      });
      return;
    }
    let threadWorkspace = normalizeWorkspacePath(getWorkspaceForThread(threadId) || runtimeStore.workspacePath);
    let threadServerId = await ensureServerForWorkspace(threadWorkspace);
    if (!threadServerId) {
      showToast({ kind: "error", title: "无法发送", message: "当前会话对应的服务不可用。" });
      return;
    }
    setThreadWorkspace(threadId, threadWorkspace);

    const compatibility = await ensureThreadModelToolCompatibility({
      threadId,
      threadWorkspace,
      threadServerId,
      model: runtimeStore.model,
    });
    if (!compatibility.ok) {
      showToast({ kind: "warn", title: "Spark 会话需要新建", message: compatibility.error });
      pushEvent("turn:error", compatibility.error, { threadId, level: "error" });
      return;
    }
    if (compatibility.threadId !== threadId) {
      threadId = compatibility.threadId;
      threadWorkspace = normalizeWorkspacePath(getWorkspaceForThread(threadId) || threadWorkspace);
      threadServerId = await ensureServerForWorkspace(threadWorkspace);
      if (!threadServerId) {
        showToast({ kind: "error", title: "无法发送", message: "当前会话对应的服务不可用。" });
        return;
      }
      setThreadWorkspace(threadId, threadWorkspace);
    }

    {
      const existing = threadStore.threadHistory.find((item) => item.id === threadId);
      const currentTitle = String(existing?.title ?? "").trim();
      const placeholder = fallbackThreadTitle(threadId);
      const titleSeedText =
        visibleText ||
        (composeFileMentions.length > 0
          ? `文件 ${composeFileMentions.length} 个`
          : `图片 ${composeAttachments.length} 张`);
      if (!currentTitle || currentTitle === placeholder) {
        if (!isBootstrapThreadTitleSource(titleSeedText)) {
          const nextTitle = titleFromFirstUserMessage(titleSeedText) || placeholder;
          threadStore.upsertThreadHistory({
            id: threadId,
            title: nextTitle,
            meta: String(existing?.meta ?? threadWorkspace ?? "").trim() || "无工作区",
            cwd: String(existing?.cwd ?? threadWorkspace ?? "").trim() || undefined,
            modelProvider: String(existing?.modelProvider ?? "").trim() || undefined,
            updatedAt: Date.now(),
            running: threadStore.runningThreadIds.has(threadId),
          });
        }
      }
    }

    const rewroteHistoryBeforeSend = runtimeStore.historyRewriteActive && runtimeStore.historyRewriteSource === "history";
    const historyRewriteReady = await rollbackHistoryRewriteBeforeSend(threadId);
    if (!historyRewriteReady) return;
    if (!rewroteHistoryBeforeSend) {
      const resumed = await ensureThreadResumed(threadId);
      if (!resumed) {
        showToast({ kind: "error", title: "无法发送", message: "会话未就绪（resume 失败）。" });
        return;
      }
    }

    for (const event of timelineStore.eventsForThread(threadId)) {
      if (event.method !== "local/contextCompaction") continue;
      timelineStore.removeEvent({ threadId, id: event.id });
    }

    runtimeStore.composeInput = "";
    runtimeStore.clearComposeAttachments();
    runtimeStore.clearComposeFileMentions();
    runtimeStore.endHistoryRewrite();

    const running = threadStore.runningThreadIds.has(threadId);
    if (running && mode === "auto") {
      messageQueueStore.enqueue({
        threadId,
        text: queueText,
        inputs: input,
        displayText: localUserMessage.displayText,
      });
      return;
    }

    const localUserEventId = `local:user:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const localUserMessageId = `local-user-msg:${Date.now()}:${Math.random().toString(16).slice(2)}`;

    timelineStore.appendEvent({
      threadId,
      id: localUserEventId,
      method: "user",
      paramsText: localUserMessage.displayText,
      params: localUserMessage.payload,
      level: "info",
      localKind: "user",
      localState: "pending",
      localMessageId: localUserMessageId,
    });
    runtimeStore.requestScrollTimelineToBottom();

    const setLocalUserEventState = (
      state: "pending" | "queued" | "sending" | "sent" | "failed",
      level?: "info" | "warn" | "error",
      turnIdValue?: string
    ) => {
      timelineStore.patchEvent({
        threadId,
        id: localUserEventId,
        patch: {
          localState: state,
          ...(level ? { level } : {}),
          ...(turnIdValue ? { turnId: turnIdValue } : {}),
        },
      });
    };

    if (running && mode === "steer") {
      const turnIdValue = String(threadStore.activeTurnIdByThread.get(threadId) ?? "").trim();
      const steerOk = await requestTurnSteer(threadId, input, turnIdValue);
      if (!steerOk) {
        setLocalUserEventState("failed", "error", turnIdValue || undefined);
        return;
      }
      setLocalUserEventState("sent", "info", turnIdValue || undefined);
      return;
    }

    setLocalUserEventState("sending", "info");
    const started = await startTurnWithInput({ threadId, threadWorkspace, threadServerId, input });
    if (started.ok) {
      setLocalUserEventState("sent", "info");
      return;
    }
    pushEvent("turn:error", started.error, { threadId, level: "error" });
    threadStore.setThreadRunning(threadId, false);
    setLocalUserEventState("failed", "error");
  };

  const summarizeQueuedMessagePreview = (message: {
    text?: string;
    inputs?: UserTurnInput[];
    displayText?: string;
  }): string => {
    const displayText = String(message.displayText ?? "").trim();
    if (displayText) return displayText;
    const payload = buildTimelineUserMessagePayload(Array.isArray(message.inputs) ? message.inputs : []);
    if (payload.displayText) return payload.displayText;
    const text = String(message.text ?? "").trim();
    if (text) return text;
    const inputs = Array.isArray(message.inputs) ? message.inputs : [];
    const imageCount = inputs.filter((item) => item?.type === "image" || item?.type === "localImage").length;
    if (imageCount > 0) return `图片 ${imageCount} 张`;
    return "（空消息）";
  };

  const flushQueueForThread = async (threadIdValue: string) => {
    let threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return;
    if (threadStore.runningThreadIds.has(threadId)) return;
    const next = messageQueueStore.peekNextQueued(threadId);
    if (!next) return;

    const previewText = summarizeQueuedMessagePreview(next);
    const previewPayload = buildTimelineUserMessagePayload(Array.isArray(next.inputs) ? next.inputs : []);

    const localEventId =
      String((next as any)?.localEventId ?? "").trim() ||
      `local:user:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const localMessageId = `local-user-msg:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    messageQueueStore.setLocalEventId(threadId, next.id, localEventId);
    const ensureLocalEvent = () => {
      if (String((next as any)?.localEventId ?? "").trim()) return;
      timelineStore.appendEvent({
        threadId,
        id: localEventId,
        method: "user",
        paramsText: previewText,
        params: previewPayload.payload,
        level: "info",
        localKind: "user",
        localState: "pending",
        localMessageId: localMessageId,
      });
      runtimeStore.requestScrollTimelineToBottom();
    };
    const patchLocalEvent = (patch: Partial<TimelineEventItem>) => {
      timelineStore.patchEvent({ threadId, id: localEventId, patch });
    };

    ensureLocalEvent();

    let threadWorkspace = normalizeWorkspacePath(getWorkspaceForThread(threadId) || runtimeStore.workspacePath);
    let threadServerId = await ensureServerForWorkspace(threadWorkspace);
    if (!threadServerId) {
      messageQueueStore.markStatus(threadId, next.id, "failed");
      patchLocalEvent({ localState: "failed", level: "error" });
      return;
    }
    const compatibility = await ensureThreadModelToolCompatibility({
      threadId,
      threadWorkspace,
      threadServerId,
      model: runtimeStore.model,
    });
    if (!compatibility.ok) {
      messageQueueStore.markStatus(threadId, next.id, "failed");
      patchLocalEvent({ localState: "failed", level: "error" });
      pushEvent("turn:error", compatibility.error, { threadId, level: "error" });
      return;
    }
    if (compatibility.threadId !== threadId) {
      threadId = compatibility.threadId;
      threadWorkspace = normalizeWorkspacePath(getWorkspaceForThread(threadId) || threadWorkspace);
      threadServerId = await ensureServerForWorkspace(threadWorkspace);
      if (!threadServerId) {
        messageQueueStore.markStatus(threadId, next.id, "failed");
        patchLocalEvent({ localState: "failed", level: "error" });
        return;
      }
    }
    const resumed = await ensureThreadResumed(threadId);
    if (!resumed) {
      messageQueueStore.markStatus(threadId, next.id, "failed");
      patchLocalEvent({ localState: "failed", level: "error" });
      return;
    }

    messageQueueStore.markStatus(threadId, next.id, "sending");
    patchLocalEvent({ localState: "sending", level: "info" });

    const fallbackInput = next.text.trim() ? [{ type: "text", text: next.text.trim() } as UserTurnInput] : [];
    const queueInput = Array.isArray(next.inputs) && next.inputs.length > 0 ? next.inputs : fallbackInput;
    if (queueInput.length === 0) {
      messageQueueStore.markStatus(threadId, next.id, "failed");
      patchLocalEvent({ localState: "failed", level: "error" });
      return;
    }
    const started = await startTurnWithInput({ threadId, threadWorkspace, threadServerId, input: queueInput });
    if (started.ok) {
      messageQueueStore.remove(threadId, next.id);
      patchLocalEvent({ localState: "sent", level: "info" });
      return;
    }
    messageQueueStore.markStatus(threadId, next.id, "failed");
    patchLocalEvent({ localState: "failed", level: "error" });
  };

  const notifyCompletedTurnIfBackground = async (threadIdValue: string) => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return;
    const historyItem = threadStore.threadHistory.find((item) => String(item.id ?? "").trim() === threadId);
    const threadTitle = threadStore.displayThreadTitle(threadId, historyItem?.title ?? threadId);
    try {
      const windowState = await codexDesktop.window.getState();
      await notifyTurnCompleted({
        app: codexDesktop.app,
        focused: typeof document !== "undefined" ? document.hasFocus() : false,
        hidden: typeof document !== "undefined" ? document.hidden : true,
        minimized: Boolean(windowState?.isMinimized),
        threadTitle,
      });
    } catch (error) {
      console.warn("[systemNotification] turn completed notification failed", error);
    }
  };

  const send = async () => {
    await sendOrQueueText("auto");
  };

  const steerNow = async () => {
    await sendOrQueueText("steer");
  };

  const editQueuedMessage = async (messageIdValue: string) => {
    const threadId = String(runtimeStore.currentThreadId ?? "").trim();
    if (!threadId) return;
    const messageId = String(messageIdValue ?? "").trim();
    if (!messageId) return;

    const list = messageQueueStore.queueByThread.get(threadId) ?? [];
    const queuedMessage =
      list.find((item) => item.id === messageId && (item.status === "queued" || item.status === "failed")) ?? null;
    if (!queuedMessage) return;

    const queueInputs = cloneUserTurnInputs(Array.isArray(queuedMessage.inputs) ? queuedMessage.inputs : []);
    const textValue = String(queuedMessage.text ?? "");
    const { attachments, failedLocalPaths } = await buildComposeAttachmentsFromUserTurnInputs(queueInputs);
    const draft = buildComposeDraftFromUserTurnInputs(queueInputs);
    const prefillText = draft.composeInput || textValue;
    const mentions = draft.composeFileMentions;
    if (!hasMeaningfulComposeText(prefillText) && attachments.length === 0 && mentions.length === 0) {
      showToast({ kind: "warn", title: "无法编辑排队消息", message: "该排队消息没有可回填的内容。" });
      return;
    }

    const taken = messageQueueStore.takeEditable(threadId, messageId);
    if (!taken) return;

    runtimeStore.startQueueRewrite({
      prefillText,
      prefillAttachments: attachments,
      prefillMentions: mentions,
    });

    if (failedLocalPaths.length > 0) {
      const names = failedLocalPaths.slice(0, 2).map((item) => fileNameFromPathLike(item, "图片"));
      const summary = names.join("、");
      const suffix = failedLocalPaths.length > 2 ? ` 等 ${failedLocalPaths.length} 张图片` : "";
      showToast({
        kind: "warn",
        title: "部分图片未恢复",
        message: summary ? `${summary}${suffix} 未能回填，请重新添加。` : "部分本地图片未能回填，请重新添加。",
      });
    }
  };

  const removeQueuedMessage = async (messageIdValue: string) => {
    const threadId = String(runtimeStore.currentThreadId ?? "").trim();
    if (!threadId) return;
    const messageId = String(messageIdValue ?? "").trim();
    if (!messageId) return;

    const list = messageQueueStore.queueByThread.get(threadId) ?? [];
    const msg = list.find((item) => item.id === messageId) ?? null;
    if (!msg) return;
    if (msg.status === "sending") return;

    const localEventId = String(msg.localEventId ?? "").trim();
    messageQueueStore.remove(threadId, messageId);
    if (localEventId) {
      timelineStore.removeEvent({ threadId, id: localEventId });
    }
  };

  const sendQueuedMessageNow = async (messageIdValue: string) => {
    const threadId = String(runtimeStore.currentThreadId ?? "").trim();
    if (!threadId) return;
    const messageId = String(messageIdValue ?? "").trim();
    if (!messageId) return;

    const list = messageQueueStore.queueByThread.get(threadId) ?? [];
    const msg = list.find((m) => m.id === messageId) ?? null;
    if (!msg || (msg.status !== "queued" && msg.status !== "failed")) return;

    const previewText = summarizeQueuedMessagePreview(msg);
    const previewPayload = buildTimelineUserMessagePayload(Array.isArray(msg.inputs) ? msg.inputs : []);

    const localEventId =
      String((msg as any)?.localEventId ?? "").trim() ||
      `local:user:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const localMessageId = `local-user-msg:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    messageQueueStore.setLocalEventId(threadId, msg.id, localEventId);
    const ensureLocalEvent = () => {
      if (String((msg as any)?.localEventId ?? "").trim()) return;
      timelineStore.appendEvent({
        threadId,
        id: localEventId,
        method: "user",
        paramsText: previewText,
        params: previewPayload.payload,
        level: "info",
        localKind: "user",
        localState: "pending",
        localMessageId: localMessageId,
      });
      runtimeStore.requestScrollTimelineToBottom();
    };
    const patchLocalEvent = (patch: Partial<TimelineEventItem>) => {
      timelineStore.patchEvent({ threadId, id: localEventId, patch });
    };

    ensureLocalEvent();

    const threadWorkspace = normalizeWorkspacePath(getWorkspaceForThread(threadId) || runtimeStore.workspacePath);
    const threadServerId = await ensureServerForWorkspace(threadWorkspace);
    if (!threadServerId) {
      messageQueueStore.markStatus(threadId, msg.id, "failed");
      patchLocalEvent({ localState: "failed", level: "error" });
      return;
    }

    const resumed = await ensureThreadResumed(threadId);
    if (!resumed) {
      messageQueueStore.markStatus(threadId, msg.id, "failed");
      patchLocalEvent({ localState: "failed", level: "error" });
      return;
    }

    const fallbackInput = msg.text.trim() ? [{ type: "text", text: msg.text.trim() } as UserTurnInput] : [];
    const queueInput = Array.isArray(msg.inputs) && msg.inputs.length > 0 ? msg.inputs : fallbackInput;
    if (queueInput.length === 0) {
      messageQueueStore.markStatus(threadId, msg.id, "failed");
      patchLocalEvent({ localState: "failed", level: "error" });
      return;
    }

    messageQueueStore.markStatus(threadId, msg.id, "sending");
    patchLocalEvent({ localState: "sending", level: "info" });

    const running = threadStore.runningThreadIds.has(threadId);
    if (running) {
      const turnIdValue = String(threadStore.activeTurnIdByThread.get(threadId) ?? "").trim();
      if (!turnIdValue) {
        messageQueueStore.markStatus(threadId, msg.id, "queued");
        patchLocalEvent({ localState: "queued", level: "warn" });
        pushEvent("steer:error", "缺少 active turnId，无法立即发送排队消息", { threadId, level: "error" });
        return;
      }
      const ok = await requestTurnSteer(threadId, queueInput, turnIdValue);
      if (ok) {
        messageQueueStore.remove(threadId, msg.id);
        patchLocalEvent({ localState: "sent", level: "info", turnId: turnIdValue });
        return;
      }
      messageQueueStore.markStatus(threadId, msg.id, "failed");
      patchLocalEvent({ localState: "failed", level: "error", turnId: turnIdValue });
      return;
    }

    const started = await startTurnWithInput({ threadId, threadWorkspace, threadServerId, input: queueInput });
    if (started.ok) {
      messageQueueStore.remove(threadId, msg.id);
      patchLocalEvent({ localState: "sent", level: "info" });
      return;
    }
    messageQueueStore.markStatus(threadId, msg.id, "failed");
    patchLocalEvent({ localState: "failed", level: "error" });
  };

  const interruptTurn = async () => {
    const threadId = runtimeStore.currentThreadId;
    if (!threadId) return;
    const serverId = getServerIdForThread(threadId);
    if (!serverId) return;
    const turnIdValue = String(threadStore.activeTurnIdByThread.get(threadId) ?? "").trim();
    if (!turnIdValue) {
      pushEvent("interrupt:error", "缺少 active turnId，无法执行 turn/interrupt", { threadId, level: "error" });
      return;
    }
    const params = { threadId, turnId: turnIdValue };
    try {
      await codexDesktop.codexServer.rpc({ serverId, method: "turn/interrupt", params });
      pushEvent("interrupt", "已请求停止当前回合", { threadId });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("interrupt:error", msg || "turn/interrupt failed", { threadId, level: "error" });
    }
  };

  const compactThread = async () => {
    if (!runtimeStore.currentThreadId) return;
    const serverId = getServerIdForThread(runtimeStore.currentThreadId);
    if (!serverId) return;
    try {
      await codexDesktop.codexServer.rpc({
        serverId,
        method: "thread/compact/start",
        params: { threadId: runtimeStore.currentThreadId },
      });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("compact:error", msg, { threadId: runtimeStore.currentThreadId, level: "error" });
    }
  };

  const resetCodexMemory = async () => {
    const serverId = getServerIdForWorkspace(runtimeStore.workspacePath);
    if (!serverId) {
      showToast({ kind: "warn", title: "\u65e0\u6cd5\u91cd\u7f6e\u8bb0\u5fc6", message: "\u5f53\u524d\u672a\u8fde\u63a5 Codex \u670d\u52a1\u3002" });
      return;
    }
    try {
      await codexDesktop.codexServer.rpc({ serverId, method: "memory/reset" });
      showToast({ kind: "success", title: "\u8bb0\u5fc6\u5df2\u91cd\u7f6e", message: "Codex \u8bb0\u5fc6\u5df2\u6e05\u7a7a\u3002" });
      pushEvent("memory/reset", "Codex memory reset", { threadId: runtimeStore.currentThreadId || APP_TIMELINE_ID });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      showToast({ kind: "error", title: "\u91cd\u7f6e\u8bb0\u5fc6\u5931\u8d25", message: msg || "memory/reset \u8bf7\u6c42\u5931\u8d25" });
      pushEvent("memory/reset:error", msg || "memory/reset failed", {
        threadId: runtimeStore.currentThreadId || APP_TIMELINE_ID,
        level: "error",
      });
    }
  };

  const setCurrentThreadMemoryMode = async (mode: ThreadMemoryMode) => {
    const threadId = String(runtimeStore.currentThreadId ?? "").trim();
    if (!threadId) {
      showToast({ kind: "warn", title: "\u65e0\u6cd5\u8bbe\u7f6e\u8bb0\u5fc6", message: "\u8bf7\u5148\u9009\u62e9\u4e00\u4e2a\u7ebf\u7a0b\u3002" });
      return;
    }
    const serverId = getServerIdForThread(threadId);
    if (!serverId) {
      showToast({ kind: "warn", title: "\u65e0\u6cd5\u8bbe\u7f6e\u8bb0\u5fc6", message: "\u5f53\u524d\u7ebf\u7a0b\u672a\u8fde\u63a5 Codex \u670d\u52a1\u3002" });
      return;
    }
    try {
      await codexDesktop.codexServer.rpc({ serverId, method: "thread/memoryMode/set", params: { threadId, mode } });
      const enabled = mode === "enabled";
      showToast({
        kind: "success",
        title: enabled ? "\u7ebf\u7a0b\u8bb0\u5fc6\u5df2\u542f\u7528" : "\u7ebf\u7a0b\u8bb0\u5fc6\u5df2\u5173\u95ed",
        message: enabled ? "\u5f53\u524d\u7ebf\u7a0b\u4f1a\u4f7f\u7528 Codex \u8bb0\u5fc6\u3002" : "\u5f53\u524d\u7ebf\u7a0b\u4e0d\u4f1a\u4f7f\u7528 Codex \u8bb0\u5fc6\u3002",
      });
      pushEvent("memory/mode", `thread memory mode: ${mode}`, { threadId });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      showToast({ kind: "error", title: "\u8bbe\u7f6e\u8bb0\u5fc6\u5931\u8d25", message: msg || "thread/memoryMode/set \u8bf7\u6c42\u5931\u8d25" });
      pushEvent("memory/mode:error", msg || "thread/memoryMode/set failed", { threadId, level: "error" });
    }
  };

  const rollbackTurns = async () => {
    if (!runtimeStore.currentThreadId) {
      showToast({ kind: "info", title: "无法撤回", message: "未选择会话。" });
      return;
    }
    const tid = String(runtimeStore.currentThreadId ?? "").trim();
    if (!tid) {
      showToast({ kind: "info", title: "无法撤回", message: "未选择会话。" });
      return;
    }
    const workspace = normalizeWorkspacePath(getWorkspaceForThread(tid) || runtimeStore.workspacePath);
    const serverId = getServerIdForThread(tid);
    if (!workspace) {
      showToast({ kind: "error", title: "无法撤回", message: "未选择工作区或工作区不可用。" });
      return;
    }
    if (!serverId) {
      showToast({ kind: "error", title: "无法撤回", message: "未连接服务或服务不可用。" });
      return;
    }
    if (threadStore.runningThreadIds.has(tid)) {
      showToast({ kind: "warn", title: "线程运行中", message: "请等待当前回合完成后再撤回。" });
      return;
    }
    const stack = threadStore.completedTurnsByThread.get(tid) ?? [];
    if (stack.length === 0) {
      showToast({ kind: "info", title: "暂无可撤回回合", message: "当前会话还没有已完成回合。" });
      return;
    }
    let n: number | null = null;
    try {
      n = await promptNumberModalLazy({
        title: "撤回最近 N 轮",
        message: "撤回会回退线程上下文，并尝试回退这些回合产生的文件内容改动（不回退命令副作用）。",
        detail: `可撤回：1..${stack.length}`,
        confirmText: "撤回",
        cancelText: "取消",
        danger: true,
        defaultValue: 1,
        min: 1,
        max: stack.length,
      });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      const isBusy = msg.includes("another modal is already open");
      showToast({
        kind: isBusy ? "warn" : "error",
        title: "无法打开撤回弹窗",
        message: isBusy ? "当前已有弹窗打开，请先关闭后再重试。" : "打开弹窗失败",
      });
      return;
    }
    if (n == null) return;

    const selected = stack.slice(-n);
    const selectedTurnIds = selected.map((entry) => entry.turnId);
    const diffParts = [...selected]
      .reverse()
      .map((entry) => entry.diffText)
      .filter((text) => String(text ?? "").trim().length > 0);
    const combinedDiff = diffParts.join("\n\n");

    if (combinedDiff.trim()) {
      const dry = await codexDesktop.workspace.dryRunApplyReverseDiff({ cwd: workspace, diffText: combinedDiff });
      if (!dry.ok) {
        pushEvent("rollback:error", `无法回退文件内容：${dry.error}`, { threadId: tid, level: "error" });
        showToast({ kind: "error", title: "撤回失败", message: "文件回退预检失败（工作区可能已手动修改）" });
        return;
      }
    }

    const resumed = await ensureThreadResumed(tid);
    if (!resumed) return;
    const ok = await requestThreadRollback(tid, n);
    if (!ok) return;

    if (combinedDiff.trim()) {
      const applied = await codexDesktop.workspace.applyReverseDiff({ cwd: workspace, diffText: combinedDiff });
      if (!applied.ok) {
        timelineStore.removeTurnEvents(tid, selectedTurnIds);
        threadStore.removeTurnsFromState(tid, selectedTurnIds);
        pushEvent("rollback:error", `上下文已撤回，但文件回退失败：${applied.error}`, {
          threadId: tid,
          level: "error",
        });
        showToast({ kind: "error", title: "部分失败", message: "上下文已撤回，但文件回退失败；请手动检查工作区。" });
        return;
      }
      pushEvent("rollback", `files reverted: ${(applied.files ?? []).join(", ")}`, { threadId: tid });
    } else {
      pushEvent("rollback", "no file diff in selected turns; context only", { threadId: tid });
    }

    timelineStore.removeTurnEvents(tid, selectedTurnIds);
    threadStore.removeTurnsFromState(tid, selectedTurnIds);
    showToast({ kind: "success", title: "撤回完成", message: `已撤回最近 ${n} 轮` });
  };

  const submitUserInputPromptForThread = async (threadIdValue: unknown) => {
    const tid = String(threadIdValue ?? "").trim();
    if (!tid) return;
    const prompt = userInputStore.activePromptForThread(tid);
    if (!prompt) return;
    const promptThreadId = String(prompt.threadId || tid).trim();
    if (!promptThreadId) return;
    try {
      if (prompt.kind === "questions") {
        const answers: Record<string, { answers: string[] }> = {};
        for (const question of prompt.questions) {
          const draft = userInputStore.getDraft(promptThreadId, prompt.requestId, question.id);
          const normalized = draft.map((answer) => answer.trim()).filter(Boolean);
          if (normalized.length === 0) {
            const detail = `问题未作答：${question.header}`;
            pushEvent("plan:input:error", detail, { threadId: promptThreadId || APP_TIMELINE_ID, level: "error" });
            showToast({ kind: "warn", title: "问答未完成", message: detail });
            return;
          }
          // 按 app-server 协议：每题必须回传 answers 数组（即使只有一项）。
          answers[question.id] = { answers: normalized };
        }

        await codexDesktop.codexServer.respond({
          serverId: prompt.serverId,
          id: prompt.requestId,
          result: { answers },
        });
        pushEvent("plan:input", `已提交问答（${prompt.questions.length} 题）`, {
          threadId: promptThreadId || APP_TIMELINE_ID,
        });
      } else if (prompt.kind === "elicitationForm") {
        const question = prompt.questions[0];
        if (!question) return;
        const draft = userInputStore.getDraft(promptThreadId, prompt.requestId, question.id);
        const raw = String(draft[0] ?? "").trim();
        if (!raw) {
          const detail = `MCP 输入未完成：${prompt.serverName}`;
          pushEvent("mcp:elicitation:error", detail, { threadId: promptThreadId || APP_TIMELINE_ID, level: "error" });
          showToast({ kind: "warn", title: "输入未完成", message: detail });
          return;
        }

        let content: JsonValue;
        try {
          content = JSON.parse(raw) as JsonValue;
        } catch {
          const detail = "MCP 输入必须是合法 JSON";
          pushEvent("mcp:elicitation:error", detail, { threadId: promptThreadId || APP_TIMELINE_ID, level: "error" });
          showToast({ kind: "warn", title: "JSON 无效", message: detail });
          return;
        }

        await codexDesktop.codexServer.respond({
          serverId: prompt.serverId,
          id: prompt.requestId,
          result: { action: "accept", content },
        });
        pushEvent("mcp:elicitation", `已提交 MCP 输入（${prompt.serverName}）`, {
          threadId: promptThreadId || APP_TIMELINE_ID,
        });
      } else {
        await codexDesktop.codexServer.respond({
          serverId: prompt.serverId,
          id: prompt.requestId,
          result: { action: "accept", content: null },
        });
        pushEvent("mcp:elicitation", `已确认 MCP 链接操作（${prompt.serverName}）`, {
          threadId: promptThreadId || APP_TIMELINE_ID,
        });
      }

      userInputStore.completeActivePrompt(promptThreadId);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      const eventMethod =
        prompt.method === "mcpServer/elicitation/request" ? "mcp:elicitation:error" : "plan:input:error";
      const title = prompt.method === "mcpServer/elicitation/request" ? "MCP 输入提交失败" : "问答提交失败";
      pushEvent(eventMethod, msg, { threadId: promptThreadId || APP_TIMELINE_ID, level: "error" });
      showToast({ kind: "error", title, message: msg });
    }
  };

  const cancelUserInputPromptForThread = async (threadIdValue: unknown) => {
    const tid = String(threadIdValue ?? "").trim();
    if (!tid) return;
    const prompt = userInputStore.activePromptForThread(tid);
    if (!prompt) return;
    const promptThreadId = String(prompt.threadId || tid).trim();
    if (!promptThreadId) return;
    try {
      if (prompt.method === "mcpServer/elicitation/request") {
        await codexDesktop.codexServer.respond({
          serverId: prompt.serverId,
          id: prompt.requestId,
          result: { action: "cancel", content: null },
        });
        pushEvent("mcp:elicitation:cancel", `${prompt.method} (id=${prompt.requestId})`, {
          threadId: promptThreadId || APP_TIMELINE_ID,
          level: "warn",
        });
      } else {
        await codexDesktop.codexServer.respond({
          serverId: prompt.serverId,
          id: prompt.requestId,
          error: { code: 4001, message: "request_user_input cancelled by user" },
        });
        pushEvent("plan:input:cancel", `${prompt.method} (id=${prompt.requestId})`, {
          threadId: promptThreadId || APP_TIMELINE_ID,
          level: "warn",
        });
      }
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent(prompt.method === "mcpServer/elicitation/request" ? "mcp:elicitation:error" : "plan:input:error", msg, {
        threadId: promptThreadId || APP_TIMELINE_ID,
        level: "error",
      });
      showToast({
        kind: "error",
        title: prompt.method === "mcpServer/elicitation/request" ? "取消 MCP 输入失败" : "取消问答失败",
        message: msg,
      });
    } finally {
      userInputStore.completeActivePrompt(promptThreadId);
    }
  };

  const submitActiveUserInputPrompt = async () => {
    const tid = String(runtimeStore.currentThreadId ?? "").trim();
    if (!tid) return;
    await submitUserInputPromptForThread(tid);
  };

  const cancelActiveUserInputPrompt = async () => {
    const tid = String(runtimeStore.currentThreadId ?? "").trim();
    if (!tid) return;
    await cancelUserInputPromptForThread(tid);
  };

  const dismissActiveApprovalPrompt = () => {
    const prompt = approvalStore.activePrompt;
    if (!prompt) return;
    approvalStore.remove(prompt.serverId, prompt.requestId);
  };

  const submitActiveApprovalPrompt = async (decisionRaw: unknown) => {
    const prompt = approvalStore.activePrompt;
    if (!prompt) return;
    const decision = decisionRaw as any;
    if (typeof decision === "string" && !decision.trim()) return;
    if (decision == null) return;

    const threadId = prompt.threadId || runtimeStore.currentThreadId || APP_TIMELINE_ID;

    try {
      if (prompt.method === "item/fileChange/requestApproval") {
        // decision: accept | acceptForSession | decline | cancel
        await codexDesktop.codexServer.respond({
          serverId: prompt.serverId,
          id: prompt.requestId,
          result: { decision },
        });
        const decisionText = typeof decision === "string" ? decision : safeJsonStringify(decision, { space: 0 });
        const level = typeof decisionText === "string" && decisionText.startsWith("accept") ? "info" : "warn";
        pushEvent("approval:fileChange", `decision=${decisionText}`, { threadId, level });
      } else if (prompt.method === "applyPatchApproval") {
        // decision: approved | approved_for_session | denied | abort (per local schema)
        await codexDesktop.codexServer.respond({
          serverId: prompt.serverId,
          id: prompt.requestId,
          result: { decision },
        });
        const decisionText = typeof decision === "string" ? decision : safeJsonStringify(decision, { space: 0 });
        const level = typeof decisionText === "string" && decisionText.startsWith("approved") ? "info" : "warn";
        pushEvent("approval:applyPatch", `decision=${decisionText}`, { threadId, level });
      } else if (prompt.method === "item/commandExecution/requestApproval") {
        // decision: accept | acceptForSession | decline | cancel | { acceptWithExecpolicyAmendment } | { applyNetworkPolicyAmendment }
        await codexDesktop.codexServer.respond({
          serverId: prompt.serverId,
          id: prompt.requestId,
          result: { decision },
        });
        const decisionText = typeof decision === "string" ? decision : safeJsonStringify(decision, { space: 0 });
        const normalized = typeof decisionText === "string" ? decisionText : "";
        const level = normalized.includes("decline") || normalized.includes("cancel") ? "warn" : "info";
        pushEvent("approval:commandExecution", `decision=${decisionText}`, { threadId, level });
      } else if (prompt.method === "item/permissions/requestApproval") {
        const normalizedDecision = typeof decision === "string" ? decision.trim().toLowerCase() : "";
        if (normalizedDecision === "turn" || normalizedDecision === "session") {
          await codexDesktop.codexServer.respond({
            serverId: prompt.serverId,
            id: prompt.requestId,
            result: {
              permissions: prompt.params.permissions,
              scope: normalizedDecision,
            },
          });
          pushEvent("approval:permissions", `scope=${normalizedDecision}`, { threadId, level: "info" });
        } else {
          const message =
            normalizedDecision === "cancel"
              ? "permissions request cancelled by user"
              : "permissions request declined by user";
          await codexDesktop.codexServer.respond({
            serverId: prompt.serverId,
            id: prompt.requestId,
            error: { code: 4001, message },
          });
          pushEvent("approval:permissions", `decision=${normalizedDecision || "decline"}`, { threadId, level: "warn" });
        }
      } else if (prompt.method === "execCommandApproval") {
        // decision: approved | approved_for_session | denied | abort | (and possibly object decisions)
        await codexDesktop.codexServer.respond({
          serverId: prompt.serverId,
          id: prompt.requestId,
          result: { decision },
        });
        const decisionText = typeof decision === "string" ? decision : safeJsonStringify(decision, { space: 0 });
        const normalized = typeof decisionText === "string" ? decisionText : "";
        const level = normalized.includes("denied") || normalized.includes("abort") ? "warn" : "info";
        pushEvent("approval:execCommand", `decision=${decisionText}`, { threadId, level });
      }

      approvalStore.remove(prompt.serverId, prompt.requestId);
      const decisionText = typeof decision === "string" ? decision : safeJsonStringify(decision, { space: 0 });
      showToast({ kind: "success", title: "已提交审批", message: `decision=${decisionText}` });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("approval:error", msg, { threadId, level: "error" });
      showToast({ kind: "error", title: "审批提交失败", message: msg });
    }
  };

  disposers.push(
    codexDesktop.history.onUpdated((payload) => {
      const items = Array.isArray(payload?.items) ? payload.items : [];
      applyHistoryItems(items);
    })
  );
  disposers.push(
    codexDesktop.codexServer.onEvent((payload) => {
      const msg = payload?.msg;
      if (isCodexServerNotificationMessage(msg)) {
        if (msg.method === "serverRequest/resolved") {
          const resolvedThreadId = String(msg.params?.threadId ?? "").trim();
          const requestId = msg.params?.requestId;
          if (resolvedThreadId && (typeof requestId === "string" || typeof requestId === "number")) {
            approvalStore.removeResolved(resolvedThreadId, requestId);
            userInputStore.removePrompt(resolvedThreadId, requestId);
          }
        }

        if (msg.method === "turn/completed") {
          const threadId = String(msg.params?.threadId ?? "").trim();
          if (threadId) {
            void hydrateThreadHandoffDiagnostics(threadId, { force: true });
            void notifyCompletedTurnIfBackground(threadId);
            setTimeout(() => {
              if (!threadStore.runningThreadIds.has(threadId)) void flushQueueForThread(threadId);
            }, 120);
          }
          return;
        }

        if (msg.method === "turn/started") {
          return;
        }

        if (msg.method === "mcpServer/oauthLogin/completed") {
          const eventServerId = normalizeWorkspacePath(payload?.serverId ?? "");
          const workspace = normalizeWorkspacePath(workspaceByServerId.get(eventServerId) ?? "");
          if (workspace) invalidateMcpSnapshot(workspace);
          if (!eventServerId || eventServerId === runtimeStore.serverId) void refreshMcp();
          return;
        }

        return;
      }

      if (!isCodexLocalEventMessage(msg)) return;

      if (msg.method === "codex/exit") {
        const serverId = normalizeWorkspacePath(payload?.serverId ?? "");
        const expected = Boolean(msg?.params?.expected);
        const stoppedWorkspace = clearServerById(serverId);
        if (stoppedWorkspace) {
          for (const [threadId, workspace] of workspaceByThreadId.entries()) {
            if (workspace !== stoppedWorkspace) continue;
            threadStore.setThreadRunning(threadId, false);
            threadStore.setActiveTurn(threadId, "");
            resumedThreadIds.delete(threadId);
            replayCacheByThread.delete(threadId);
            replayWindowStateByThread.delete(threadId);
            replayRequestSeqByThread.delete(threadId);
            olderHistoryLoadPromiseByThread.delete(threadId);
          }
        }
        const activeWorkspace = normalizeWorkspacePath(runtimeStore.workspacePath);
        if (stoppedWorkspace && activeWorkspace === stoppedWorkspace) {
          const activeServerId = syncActiveServerByWorkspace(activeWorkspace);
          if (!activeServerId && !expected) {
            appShellStore.setServerConnState("failed", "codex app-server exited");
          }
        } else if (runtimeStore.serverId === serverId) {
          runtimeStore.clearServer();
          if (!expected) appShellStore.setServerConnState("failed", "codex app-server exited");
          else appShellStore.setServerConnState("disconnected");
          resetSidePanelStores("未连接服务");
        }
        return;
      }
      if (msg.method === "codex/protocolError") {
        console.warn("[runtimeOrchestrator] protocol error", msg?.params ?? msg);
        return;
      }
    })
  );
  disposers.push(installEventPipeline(pinia));
  disposers.push(installRequestResponder(pinia));
  void codexDesktop.history
    .getThreadTitleOverrides()
    .then((res) => {
      threadStore.applyThreadTitleOverrides(res?.overrides ?? {});
    })
    .catch(() => {
      threadStore.applyThreadTitleOverrides({});
    });
  void refreshHistory(false);
  resetSidePanelStores("未连接服务");

  runtimeOrchestrator = {
    dispose() {
      // 窗口卸载/热重载时强制落盘输入草稿与线程级参数，避免防抖计时器未触发导致丢失。
      try {
        runtimeStore.flushPendingComposeStateSaves();
      } catch {}
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {}
      }
      runtimeOrchestrator = null;
    },
    checkEnvironment,
    selectWorkspace,
    switchWorkspace,
    refreshHistory,
    createThread,
    switchThread,
    loadOlderHistoryTurns,
    deleteHistoryThread,
    send,
    steerNow,
    sendQueuedMessageNow,
    editQueuedMessage,
    removeQueuedMessage,
    interruptTurn,
    compactThread,
    resetCodexMemory,
    setCurrentThreadMemoryMode,
    refreshGlobalConfig,
    saveGlobalConfig,
    resetGlobalConfig,
    openExternalUrl,
    readTextFile,
    writeTextFile,
    readWorkspaceDirectory,
    getWorkspaceMetadata,
    readWorkspaceTextFile,
    writeWorkspaceTextFile,
    refreshSkills,
    toggleSkill,
    refreshMcp,
    reloadMcpConfig,
    toggleMcpEnabled,
    startMcpOAuthLogin,
    readThreadContent,
    createThreadTask,
    updateThreadTask,
    listRendererCaches,
    clearRendererCaches,
    readMcpResource,
    rollbackTurns,
    submitUserInputPromptForThread,
    cancelUserInputPromptForThread,
    submitActiveUserInputPrompt,
    cancelActiveUserInputPrompt,
    submitActiveApprovalPrompt,
    dismissActiveApprovalPrompt,
  };
  return runtimeOrchestrator;
}

export function getRuntimeOrchestrator(): RuntimeOrchestrator {
  if (!runtimeOrchestrator) throw new Error("runtime orchestrator not initialized");
  return runtimeOrchestrator;
}
