import { nextTick } from "vue";
import type { Pinia } from "pinia";
import { codexDesktop } from "../api/codexDesktopClient";
import { toThreadHistoryItem as toThreadHistoryItemFromHistory } from "../features/history/threadHistoryItem";
import {
  fallbackThreadTitle,
  isBootstrapThreadTitleSource,
  titleFromFirstUserMessage,
} from "../features/history/threadTitle";
import { showToast } from "../ui/toast";
import { translate } from "../i18n/translate";
import { appendDebugLog } from "../shared/debugLog";
import { sandboxKebabFromUi } from "../shared/sandboxPolicy";
import {
  beginThreadCreateAttempt,
  bindThreadCreateAttemptToThread,
  createPendingThreadId,
  isPendingThreadId,
} from "../shared/threadCreateDebug";
import { useRuntimeStore } from "../stores/runtime.store";
import { useTimelineStore } from "../stores/timeline.store";
import { useThreadStore } from "../stores/thread.store";
import { useGoalShutdownStore } from "../stores/goalShutdown.store";
import { useAppShellStore } from "../stores/appShell.store";
import { useConfigStore } from "../stores/config.store";
import { useConfigRequirementsStore } from "../stores/configRequirements.store";
import { useSkillsStore } from "../stores/skills.store";
import { useMcpStore } from "../stores/mcp.store";
import { useMcpResourceStore } from "../stores/mcpResource.store";
import { useUserInputStore } from "../stores/userInput.store";
import { useMessageQueueStore } from "../stores/messageQueue.store";
import { useCodexProfilesStore } from "../stores/codexProfiles.store";
import { useCodexSkillRootsStore } from "../stores/codexSkillRoots.store";
import { useCodexConfigSwitcherStore } from "../stores/codexConfigSwitcher.store";
import { usePaperStore } from "@codenexus/feature-paper";
import { resolveCodexInstructionProfileForMainView } from "../features/registry";
import { useApprovalStore } from "../stores/approval.store";
import { useWorkspaceFilesStore } from "../stores/workspaceFiles.store";
import { installEventPipeline } from "../processes/protocol-event-pipeline/installEventPipeline";
import { installRequestResponder } from "../processes/protocol-request-responder/installRequestResponder";
import { notifyTurnCompleted } from "../features/systemNotification/systemNotification";
import { type ThreadReplayCache } from "./runtime/historyReplayRuntime";
import {
  createHistoryReplayWindowRuntime,
  type ThreadReplayWindowState,
} from "./runtime/historyReplayWindowRuntime";
import { createHistoryThreadRuntime } from "./runtime/historyThreadRuntime";
import { createConfigRuntime } from "./runtime/configRuntime";
import { createMcpRuntime } from "./runtime/mcpRuntime";
import { createMcpResourceReadRuntime } from "./runtime/mcpResourceRuntime";
import { createSkillsRuntime } from "./runtime/skillsRuntime";
import { createTurnInputRuntime } from "./runtime/turnInputRuntime";
import { createTurnStartRuntime } from "./runtime/turnStartRuntime";
import { createWorkspaceFileRuntime } from "./runtime/workspaceFileRuntime";
import { createPromptResponseRuntime } from "./runtime/promptResponseRuntime";
import { createMessageQueueRuntime } from "./runtime/messageQueueRuntime";
import { createThreadGoalRuntime } from "./runtime/threadGoalRuntime";
import { createThreadMemoryRuntime } from "./runtime/threadMemoryRuntime";
import { createThreadRollbackRuntime } from "./runtime/threadRollbackRuntime";
import { createHistoryRewriteRuntime } from "./runtime/historyRewriteRuntime";
import { createThreadMetadataRuntime } from "./runtime/threadMetadataRuntime";
import { createCodexProfileRuntime } from "./runtime/codexProfileRuntime";
import { invalidateThreadContentCache, type ThreadContentCacheEntry } from "./runtime/rendererCacheRuntime";
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
import { buildComposeDraftFromUserTurnInputs } from "./composeFileMentions";
import type { HistoryThread } from "@codenexus/shared/ipc";
import type { Thread as ServerThread } from "@codenexus/generated/codex-app-server/v2/Thread";
import type { ThreadReadParams } from "@codenexus/generated/codex-app-server/v2/ThreadReadParams";
import type { ThreadResumeParams } from "@codenexus/generated/codex-app-server/v2/ThreadResumeParams";
import type { ThreadStartParams } from "@codenexus/generated/codex-app-server/v2/ThreadStartParams";
import type { ThreadMemoryMode } from "@codenexus/generated/codex-app-server/ThreadMemoryMode";
import type {
  ComposeImageAttachment,
  ComposeWorkspaceFileMention,
  McpResourceContentState,
  McpResourceParameterEntry,
  McpServerState,
  SkillState,
  LocalThreadItem,
  ThreadGoalState,
  ThreadHistoryItem,
  UserTurnInput,
  WorkspaceDirectoryReadResult,
  WorkspaceFileMetadataState,
  WorkspaceTextFileReadResult,
  WorkspaceTextFileWriteResult,
} from "./types";
import {
  buildThreadStartConfigOverridesForModel,
  hasThreadStartConfigOverridesForModel,
  type ThreadStartConfigOverrides,
} from "@codenexus/shared/modelToolFeatureOverrides";
import { buildBuiltinDynamicToolSpecs } from "@codenexus/shared/dynamicTools";
import {
  buildDeveloperInstructionsForProfile,
  buildDynamicToolNamesForInstructionProfile,
  type CodexInstructionProfile,
} from "@codenexus/shared/codexInstructionProfiles";
import { buildNewThreadComposeSeed } from "@codenexus/shared/newThreadComposeSeed";
import { codexMcpServerSpecToConfigValue, parseCodexMcpJsonImport } from "@codenexus/shared/codexMcp";
import {
  getActiveCodexConfigSwitcherProfile,
  normalizeCodexConfigSwitcherMcpServers,
  normalizeCodexConfigSwitcherState,
  type CodexConfigSwitcherProfile,
  type CodexConfigSwitcherSkillEntry,
  type CodexConfigSwitcherState,
} from "@codenexus/shared/codexConfigSwitcher";
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
} from "@codenexus/shared/ipc/contracts";
import { isCodexLocalEventMessage, isCodexServerNotificationMessage } from "@codenexus/shared/codex-protocol";

const APP_TIMELINE_ID = "__app__";
const HISTORY_REPLAY_BATCH = 1000;
const HISTORY_REPLAY_TURN_SEGMENTS = 4;
const TIMELINE_MAX_VISIBLE_TURNS = 16;
const THREAD_METADATA_PAGE_SIZE = 200;
const THREAD_CONTENT_CACHE_TTL_MS = 2000;
const MCP_STATUS_REFRESH_DEBOUNCE_MS = 250;
const SKILLS_REFRESH_DEBOUNCE_MS = 250;

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
  send: () => Promise<boolean>;
  sendHistoryRewriteDraft: (draft: {
    anchorTurnId: string;
    composeInput: string;
    composeAttachments: ComposeImageAttachment[];
    composeFileMentions: ComposeWorkspaceFileMention[];
    model: string;
    reasoningEffort: string;
    sandboxMode: string;
    composeMode: "default" | "plan";
  }) => Promise<boolean>;
  steerNow: () => Promise<void>;
  sendQueuedMessageNow: (messageId: string) => Promise<void>;
  editQueuedMessage: (messageId: string) => Promise<void>;
  removeQueuedMessage: (messageId: string) => Promise<void>;
  interruptTurn: () => Promise<void>;
  compactThread: () => Promise<void>;
  resetCodexMemory: () => Promise<void>;
  setCurrentThreadMemoryMode: (mode: ThreadMemoryMode) => Promise<void>;
  refreshThreadGoal: (threadId?: string) => Promise<ThreadGoalState | null>;
  promptAndSetCurrentThreadGoal: () => Promise<ThreadGoalState | null>;
  setCurrentThreadGoal: (args: {
    objective: string;
    tokenBudget?: number | null;
    shutdownOnComplete?: boolean;
  }) => Promise<ThreadGoalState | null>;
  completeCurrentThreadGoal: () => Promise<ThreadGoalState | null>;
  clearCurrentThreadGoal: () => Promise<boolean>;
  refreshGlobalConfig: () => Promise<void>;
  saveGlobalConfig: (options?: { source?: "manual" | "auto"; silentSuccessToast?: boolean }) => Promise<void>;
  resetGlobalConfig: () => void;
  applyCodexProfile: (profileId: string) => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
  readTextFile: (path: string) => Promise<string>;
  writeTextFile: (path: string, content: string) => Promise<void>;
  readWorkspaceDirectory: (path?: string) => Promise<WorkspaceDirectoryReadResult>;
  getWorkspaceMetadata: (path: string) => Promise<WorkspaceFileMetadataState>;
  readWorkspaceTextFile: (path: string) => Promise<WorkspaceTextFileReadResult>;
  deleteWorkspaceFile: (path: string) => Promise<void>;
  writeWorkspaceTextFile: (
    path: string,
    content: string,
    options?: { encoding?: AppTextEncoding; lineEnding?: AppTextLineEnding }
  ) => Promise<WorkspaceTextFileWriteResult>;
  refreshSkills: (forceReload?: boolean) => Promise<void>;
  toggleSkill: (skillPath: string, enabled: boolean) => Promise<void>;
  addSkillRoot: (root: string) => Promise<void>;
  removeSkillRoot: (root: string) => Promise<void>;
  refreshCodexConfigSwitcher: () => Promise<void>;
  importCurrentCodexConfigProfile: () => Promise<void>;
  activateCodexConfigProfile: (profileId: string) => Promise<void>;
  refreshMcp: () => Promise<void>;
  reloadMcpConfig: () => Promise<void>;
  toggleMcpEnabled: (serverKey: string, enabled: boolean) => Promise<void>;
  deleteMcpServer: (serverId: string) => Promise<void>;
  importMcpServersFromJson: (text: string) => Promise<{ imported: number; errors: string[] }>;
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
  const goalShutdownStore = useGoalShutdownStore(pinia);
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
  const codexProfilesStore = useCodexProfilesStore(pinia);
  const codexSkillRootsStore = useCodexSkillRootsStore(pinia);
  const codexConfigSwitcherStore = useCodexConfigSwitcherStore(pinia);
  const paperStore = usePaperStore(pinia);

  // 运行期缓存：会话恢复、历史分页、工作区<->服务映射、右侧面板快照。
  const resumedThreadIds = new Set<string>();
  const resumePromisesByThread = new Map<string, Promise<boolean>>();
  const replayCacheByThread = new Map<string, ThreadReplayCache>();
  const replayWindowStateByThread = new Map<string, ThreadReplayWindowState>();
  const replayRequestSeqByThread = new Map<string, number>();
  const olderHistoryLoadPromiseByThread = new Map<string, Promise<boolean>>();
  const LOCAL_THREAD_TTL_MS = 10 * 60_000;
  const threadStartConfigOverridesByThreadId = new Map<string, ThreadStartConfigOverrides>();
  const threadContentCacheByKey = new Map<string, ThreadContentCacheEntry>();

  const resolveCurrentInstructionProfile = (): CodexInstructionProfile => {
    return resolveCodexInstructionProfileForMainView(appShellStore.mainView, { paperMode: paperStore.mode });
  };
  const serverIdByWorkspace = new Map<string, string>();
  const workspaceByServerId = new Map<string, string>();
  const workspaceByThreadId = new Map<string, string>();
  const threadMetadataHydrationPromiseByWorkspace = new Map<string, Promise<void>>();
  const handoffDiagnosticsPromiseByThread = new Map<string, Promise<void>>();
  let warnedExperimentalApiUnavailable = false;
  let latestSwitchThreadSeq = 0;
  const skillsSnapshotByWorkspace = new Map<string, SkillsSnapshot>();
  const mcpSnapshotByWorkspace = new Map<string, McpSnapshot>();
  const skillsRefreshTimersByWorkspace = new Map<string, ReturnType<typeof setTimeout>>();
  const mcpStatusRefreshTimersByWorkspace = new Map<string, ReturnType<typeof setTimeout>>();
  const mcpStartupFailureToastKeys = new Set<string>();
  let globalConfigAutoLoadAttempted = false;
  const disposers: Array<() => void> = [];
  const THREAD_PREPARING_EVENT_ID = "local:threadPreparing";
  const threadPreparingEnvironmentText = () => translate("runtime.threadPreparingEnvironment");

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

  const upsertThreadPreparingEvent = (threadIdValue: string) => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId || threadId === APP_TIMELINE_ID) return;
    timelineStore.upsertEvent({
      threadId,
      id: THREAD_PREPARING_EVENT_ID,
      method: "local/thinking",
      paramsText: threadPreparingEnvironmentText(),
      params: { phase: "preparingEnvironment" },
      level: "info",
      localKind: "thinking",
      thinkingPhase: "preparing",
    });
  };

  const clearThreadPreparingEvent = (threadIdValue: string) => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId || threadId === APP_TIMELINE_ID) return;
    timelineStore.removeEvent({ threadId, id: THREAD_PREPARING_EVENT_ID });
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
    const instructionProfile = resolveCurrentInstructionProfile();
    const dynamicTools = buildBuiltinDynamicToolSpecs(
      buildDynamicToolNamesForInstructionProfile(instructionProfile)
    ) as ThreadStartParams["dynamicTools"];
    const developerInstructions = buildDeveloperInstructionsForProfile(instructionProfile);
    return {
      configOverrides,
      params: {
        model,
        cwd: workspace,
        approvalPolicy: approvalPolicy as ThreadStartParams["approvalPolicy"],
        approvalsReviewer: approvalsReviewer as ThreadStartParams["approvalsReviewer"],
        sandbox: sandboxKebabFromUi(normalizeSandboxMode(args.sandboxMode)),
        ...(configOverrides ? { config: configOverrides } : {}),
        ...(dynamicTools && dynamicTools.length > 0 ? { dynamicTools } : {}),
        ...(developerInstructions ? { developerInstructions } : {}),
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
      ...(server.env ? { env: { ...server.env } } : {}),
      ...(server.headers ? { headers: { ...server.headers } } : {}),
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
    if (!workspace) throw new Error(translate("runtime.workspaceRequired"));
    const path = resolveWorkspaceFsPath(workspace, inputPath);
    if (!path) throw new Error(translate("runtime.invalidFilePath"));
    if (!isWithinWorkspaceFsPath(workspace, path)) {
      throw new Error(translate("runtime.fileOutsideWorkspace"));
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
  const resetSidePanelStores = (statusText = translate("runtime.noService")) => {
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

  const findThreadListItem = (threadIdValue: string): ThreadHistoryItem | LocalThreadItem | undefined => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return undefined;
    return (
      threadStore.threadHistory.find((item) => item.id === threadId) ??
      threadStore.localThreads.find((item) => item.id === threadId)
    );
  };

  // 线程对应工作区的解析优先级：内存映射 > 历史记录 > 当前工作区。
  const getWorkspaceForThread = (threadIdValue: string): string => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return "";
    const mapped = normalizeWorkspacePath(workspaceByThreadId.get(threadId) ?? "");
    if (mapped) return mapped;
    const fromHistory = normalizeWorkspacePath(String(findThreadListItem(threadId)?.cwd ?? ""));
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
      resetSidePanelStores(translate("runtime.noService"));
      return "";
    }
    runtimeStore.setServer(serverId);
    appShellStore.setServerConnState("connected");
    return serverId;
  };

  const warnExperimentalApiUnavailableOnce = (detail: string) => {
    if (warnedExperimentalApiUnavailable) return;
    warnedExperimentalApiUnavailable = true;
    pushEvent("experimentalApi", detail || translate("runtime.experimentalApiUnavailableDetail"), {
      threadId: APP_TIMELINE_ID,
      level: "warn",
    });
    showToast({
      kind: "warn",
      title: translate("runtime.experimentalApiDisabledTitle"),
      message: detail || translate("runtime.experimentalApiUnavailableMessage"),
    });
  };

  // 启动成功后登记工作区与服务实例的双向映射。
  const registerServerForWorkspace = (workspacePathValue: string, serverIdValue: string) => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    const serverId = normalizeWorkspacePath(serverIdValue);
    if (!workspace || !serverId) return;
    serverIdByWorkspace.set(workspace, serverId);
    workspaceByServerId.set(serverId, workspace);
  };

  // 通过 serverId 回收映射并返回对应工作区。
  const clearServerById = (serverIdValue: string) => {
    const serverId = normalizeWorkspacePath(serverIdValue);
    if (!serverId) return "";
    const workspace = normalizeWorkspacePath(workspaceByServerId.get(serverId) ?? "");
    workspaceByServerId.delete(serverId);
    if (workspace) {
      const mapped = normalizeWorkspacePath(serverIdByWorkspace.get(workspace) ?? "");
      if (mapped === serverId) serverIdByWorkspace.delete(workspace);
    }
    return workspace;
  };

  const configRuntime = createConfigRuntime({
    requireActiveWorkspaceServerId,
    getWorkspacePath: () => String(runtimeStore.workspacePath ?? "").trim(),
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

  const ensureServerForThread = async (threadIdValue: string) => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return "";
    const workspace = getWorkspaceForThread(threadId);
    const serverId = await ensureServerForWorkspace(workspace);
    return serverId || "";
  };

  const threadGoalRuntime = createThreadGoalRuntime({
    appTimelineId: APP_TIMELINE_ID,
    runtimeStore,
    threadStore,
    goalShutdownStore,
    ensureServerForThread,
    translate,
    showToast,
  });
  const {
    refreshThreadGoal,
    promptAndSetCurrentThreadGoal,
    setCurrentThreadGoal,
    completeCurrentThreadGoal,
    clearCurrentThreadGoal,
  } = threadGoalRuntime;

  const skillsRuntime = createSkillsRuntime({
    requireActiveWorkspaceServerId,
    getServerIdForWorkspace,
    getWorkspacePath: () => String(runtimeStore.workspacePath ?? "").trim(),
    getExtraSkillRootsForWorkspace: (workspacePath) => codexSkillRootsStore.rootsForWorkspace(workspacePath),
  });
  const { requestSkillsList, writeSkillConfig } = skillsRuntime;

  const mcpRuntime = createMcpRuntime({
    requireActiveWorkspaceServerId,
    getWorkspacePath: () => String(runtimeStore.workspacePath ?? "").trim(),
    getWorkspaceForThread,
    ensureServerForWorkspace: (workspace) => ensureServerForWorkspace(workspace),
  });
  const { requestMcpStatusList, requestReloadMcpConfig, requestStartMcpOAuthLogin, requestMcpResourceRead } =
    mcpRuntime;

  const requestTurnInterrupt = async (
    threadIdValue: string,
    turnIdValue: string,
    opts?: { silentSuccess?: boolean }
  ): Promise<boolean> => {
    const threadId = String(threadIdValue ?? "").trim();
    const turnId = String(turnIdValue ?? "").trim();
    if (!threadId || !turnId) return false;
    const serverId = getServerIdForThread(threadId);
    if (!serverId) return false;
    try {
      await codexDesktop.codexServer.rpc({ serverId, method: "turn/interrupt", params: { threadId, turnId } });
      if (!opts?.silentSuccess) pushEvent("interrupt", translate("runtime.interruptRequested"), { threadId });
      return true;
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("interrupt:error", msg || "turn/interrupt failed", { threadId, level: "error" });
      return false;
    }
  };

  const historyReplayWindowRuntime = createHistoryReplayWindowRuntime({
    runtimeStore,
    threadStore,
    timelineStore,
    replayCacheByThread,
    replayWindowStateByThread,
    replayRequestSeqByThread,
    olderHistoryLoadPromiseByThread,
    historyReplayBatch: HISTORY_REPLAY_BATCH,
    historyReplayTurnSegments: HISTORY_REPLAY_TURN_SEGMENTS,
    timelineMaxVisibleTurns: TIMELINE_MAX_VISIBLE_TURNS,
    translate,
  });
  const { hydrateReplayFromCacheIfNeeded, loadHistoryMessages, loadOlderHistoryTurns } = historyReplayWindowRuntime;

  const threadMetadataRuntime = createThreadMetadataRuntime({
    appTimelineId: APP_TIMELINE_ID,
    threadStore,
    threadMetadataHydrationPromiseByWorkspace,
    handoffDiagnosticsPromiseByThread,
    threadMetadataPageSize: THREAD_METADATA_PAGE_SIZE,
    normalizeWorkspacePath,
    getServerIdForWorkspace,
    findThreadListItem,
    requestThreadRead,
  });
  const { hydrateThreadMetadataForWorkspace, hydrateThreadHandoffDiagnostics } = threadMetadataRuntime;

  const refreshGlobalConfig = async () => {
    if (!getServerIdForWorkspace(runtimeStore.workspacePath)) {
      configStore.resetState(translate("runtime.noService"));
      configRequirementsStore.resetState(translate("runtime.noService"));
      return;
    }
    configStore.setLoadState("loading", translate("runtime.readingConfig"));
    configRequirementsStore.setLoadState("loading", translate("runtime.readingRequirements"));

    const [configResult, requirementsResult] = await Promise.allSettled([
      requestConfigRead(),
      requestConfigRequirementsRead(),
    ]);

    if (configResult.status === "fulfilled") {
      const draft = extractGlobalConfigFromReadResult(configResult.value);
      configStore.applySnapshot(draft);
      configStore.setLoadState("ready", translate("runtime.configReadSynced"));
    } else {
      const error = configResult.reason;
      const msg = error?.message ? String(error.message) : String(error);
      configStore.setLoadState("error", translate("runtime.readFailedWithMessage", { message: msg }));
    }

    if (requirementsResult.status === "fulfilled") {
      const requirements = extractConfigRequirementsFromReadResult(requirementsResult.value);
      configRequirementsStore.setRequirements(requirements);
      configRequirementsStore.setLoadState(
        "ready",
        requirements ? translate("runtime.requirementsSynced") : translate("runtime.noRequirementsConfigured")
      );
      return;
    }

    const requirementsError = requirementsResult.reason;
    const rpcErr = parseJsonRpcError(requirementsError);
    const requirementsMsg = requirementsError?.message ? String(requirementsError.message) : String(requirementsError);
    configRequirementsStore.setRequirements(null);
    if (rpcErr?.code === -32601) {
      configRequirementsStore.setLoadState("ready", translate("runtime.requirementsUnsupported"));
      return;
    }
    configRequirementsStore.setLoadState(
      "error",
      translate("runtime.requirementsReadFailed", { message: requirementsMsg })
    );
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
      configStore.setLoadState("ready", translate("runtime.configReadSynced"));
      return;
    }
    configStore.setSaving(true);
    configStore.setLoadState("ready", translate("runtime.saving"));
    try {
      await requestConfigBatchWrite(changes);
      pushEvent("config", `saved ${changes.length} keys`, { threadId: APP_TIMELINE_ID });
      await refreshGlobalConfig();
      if (!silentSuccessToast) {
        showToast({
          kind: "success",
          title:
            source === "auto" ? translate("runtime.globalConfigAutoSaved") : translate("runtime.globalConfigSaved"),
          message: translate("runtime.configItemsWritten", { count: changes.length }),
        });
      }
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      configStore.setLoadState("error", translate("runtime.saveFailedWithMessage", { message: msg }));
      pushEvent("config:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({
        kind: "error",
        title:
          source === "auto"
            ? translate("runtime.globalConfigAutoSaveFailed")
            : translate("runtime.globalConfigSaveFailed"),
        message: msg,
      });
    } finally {
      configStore.setSaving(false);
      if (configStore.loadState !== "error") {
        configStore.setLoadState(
          "ready",
          configStore.isDirty ? translate("runtime.unsavedChanges") : translate("runtime.configReadSynced")
        );
      }
    }
  };

  const resetGlobalConfig = () => {
    configStore.resetToSnapshot();
    configStore.setLoadState(
      "ready",
      configStore.isDirty ? translate("runtime.unsavedChanges") : translate("runtime.configReadSynced")
    );
  };

  const codexProfileRuntime = createCodexProfileRuntime({
    appTimelineId: APP_TIMELINE_ID,
    codexProfilesStore,
    getWorkspacePath: () => String(runtimeStore.workspacePath ?? "").trim(),
    getServerIdForWorkspace,
    requestConfigBatchWrite,
    refreshGlobalConfig,
    pushEvent,
    translate,
    showToast,
  });
  const { applyCodexProfile } = codexProfileRuntime;

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
    if (!value) throw new Error(translate("runtime.externalUrlUnsupported"));
    await codexDesktop.app.openExternal({ url: value });
  };

  const workspaceFileRuntime = createWorkspaceFileRuntime(resolveWorkspacePathForFileAccess);
  const {
    readTextFile,
    writeTextFile,
    readWorkspaceDirectory,
    getWorkspaceMetadata,
    readWorkspaceTextFile,
    deleteWorkspaceFile,
    writeWorkspaceTextFile,
  } = workspaceFileRuntime;

  const refreshSkills = async (forceReload = false) => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!getServerIdForWorkspace(workspace)) {
      skillsStore.resetState(translate("runtime.noService"));
      return;
    }
    if (!workspace) {
      skillsStore.resetState(translate("runtime.noWorkspaceSelected"));
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

  const scheduleSkillsRefresh = (workspacePathValue: string) => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    if (!workspace) return;
    const existing = skillsRefreshTimersByWorkspace.get(workspace);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      skillsRefreshTimersByWorkspace.delete(workspace);
      if (normalizeWorkspacePath(runtimeStore.workspacePath) !== workspace) return;
      if (!getServerIdForWorkspace(workspace)) return;
      void refreshSkills(true);
    }, SKILLS_REFRESH_DEBOUNCE_MS);
    skillsRefreshTimersByWorkspace.set(workspace, timer);
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
      showToast({ kind: "error", title: translate("runtime.skillConfigFailedTitle"), message: msg });
      throw e;
    }
  };

  const addSkillRoot = async (root: string) => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!workspace) throw new Error(translate("runtime.workspaceRequired"));
    const normalizedRoot = String(root ?? "").trim();
    if (!normalizedRoot) throw new Error(translate("runtime.skillRootRequired"));
    try {
      await codexSkillRootsStore.addRootForWorkspace(workspace, normalizedRoot);
      invalidateSkillsSnapshot(workspace);
      pushEvent("skills:roots", `added\n${normalizedRoot}`, { threadId: APP_TIMELINE_ID });
      await refreshSkills(true);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("skills:roots:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({ kind: "error", title: translate("runtime.skillRootAddFailedTitle"), message: msg });
      throw e;
    }
  };

  const removeSkillRoot = async (root: string) => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!workspace) throw new Error(translate("runtime.workspaceRequired"));
    const normalizedRoot = String(root ?? "").trim();
    if (!normalizedRoot) return;
    try {
      await codexSkillRootsStore.removeRootForWorkspace(workspace, normalizedRoot);
      invalidateSkillsSnapshot(workspace);
      pushEvent("skills:roots", `removed\n${normalizedRoot}`, { threadId: APP_TIMELINE_ID });
      await refreshSkills(true);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("skills:roots:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({ kind: "error", title: translate("runtime.skillRootRemoveFailedTitle"), message: msg });
      throw e;
    }
  };

  const readEffectiveMcpServersFromCodexConfig = async () => {
    const configResult = await requestConfigRead();
    return normalizeCodexConfigSwitcherMcpServers((configResult.config as Record<string, unknown> | null)?.mcp_servers);
  };

  const refreshCodexConfigSwitcher = async () => {
    await codexConfigSwitcherStore.refresh();
  };

  const assertNoCcswitchManagedCodexConfig = () => {
    if (!codexConfigSwitcherStore.ccswitch.detected) return;
    const reason = codexConfigSwitcherStore.ccswitch.reasons.join(", ") || "detected";
    throw new Error(translate("runtime.ccswitchDetected", { reason }));
  };

  const writeCodexConfigSwitcherState = async (state: CodexConfigSwitcherState) => {
    assertNoCcswitchManagedCodexConfig();
    await codexConfigSwitcherStore.saveState(normalizeCodexConfigSwitcherState(state));
  };

  const skillToSwitcherEntry = (skill: SkillState): CodexConfigSwitcherSkillEntry | null => {
    const path = String(skill.path ?? "").trim();
    if (!path) return null;
    return {
      id: path,
      name: String(skill.displayName || skill.name || path).trim() || path,
      path,
      enabled: Boolean(skill.enabled),
    };
  };

  const collectCurrentSwitcherSkills = async () => {
    if (skillsStore.loadState !== "ready") await refreshSkills(true);
    const skills = skillsStore.items
      .map(skillToSwitcherEntry)
      .filter((item): item is CodexConfigSwitcherSkillEntry => Boolean(item));
    return {
      skills,
      enabledSkillIds: skills.filter((skill) => skill.enabled).map((skill) => skill.id),
    };
  };

  const syncSwitcherSkillsToCodex = async (profile: CodexConfigSwitcherProfile) => {
    const enabledIds = new Set(profile.skillIds);
    for (const skill of codexConfigSwitcherStore.state.skills) {
      const path = String(skill.path ?? "").trim();
      if (!path) continue;
      await writeSkillConfig(path, enabledIds.has(skill.id));
    }
  };

  const syncSwitcherProfileToCodex = async (profile: CodexConfigSwitcherProfile) => {
    assertNoCcswitchManagedCodexConfig();
    const activation = await codexDesktop.app.activateCodexConfigSwitcherProfile({ profileId: profile.id });
    codexConfigSwitcherStore.applySnapshot(activation);
    try {
      await requestConfigBatchWrite([{ keyPath: "mcp_servers", value: profile.mcpServers }]);
      await syncSwitcherSkillsToCodex(profile);
      await requestReloadMcpConfig();
      invalidateMcpSnapshot(runtimeStore.workspacePath);
      await refreshMcp();
      showToast({ kind: "success", title: translate("runtime.codexConfigSwitchedTitle"), message: profile.name });
    } catch (error) {
      await codexDesktop.app
        .restoreCodexConfigSwitcherBackup({ backupId: activation.backup.id })
        .catch(() => undefined);
      throw error;
    }
  };

  const getRequiredActiveSwitcherProfile = (): CodexConfigSwitcherProfile => {
    const profile = getActiveCodexConfigSwitcherProfile(codexConfigSwitcherStore.state);
    if (!profile) throw new Error(translate("runtime.importCodexConfigFirst"));
    return profile;
  };

  const importCurrentCodexConfigProfile = async () => {
    try {
      assertNoCcswitchManagedCodexConfig();
      const mcpServers = await readEffectiveMcpServersFromCodexConfig();
      const skills = await collectCurrentSwitcherSkills();
      const snapshot = await codexDesktop.app.importCurrentCodexConfigSwitcher({
        name: "Imported Codex",
        mcpServers,
        skills: skills.skills,
        enabledSkillIds: skills.enabledSkillIds,
      });
      codexConfigSwitcherStore.applySnapshot(snapshot);
      const profile = getRequiredActiveSwitcherProfile();
      await syncSwitcherProfileToCodex(profile);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      showToast({ kind: "error", title: translate("runtime.codexConfigImportFailedTitle"), message: msg });
      throw e;
    }
  };

  const activateCodexConfigProfile = async (profileId: string) => {
    assertNoCcswitchManagedCodexConfig();
    const profile =
      codexConfigSwitcherStore.state.profiles.find((item) => item.id === String(profileId ?? "").trim()) ?? null;
    if (!profile) throw new Error(translate("runtime.configProfileNotFound"));
    try {
      await syncSwitcherProfileToCodex(profile);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      showToast({ kind: "error", title: translate("runtime.codexConfigSwitchFailedTitle"), message: msg });
      throw e;
    }
  };

  const upsertActiveSwitcherMcpServers = async (servers: Record<string, Record<string, unknown>>) => {
    if (codexConfigSwitcherStore.loadState === "idle") await refreshCodexConfigSwitcher();
    assertNoCcswitchManagedCodexConfig();
    let profile = getActiveCodexConfigSwitcherProfile(codexConfigSwitcherStore.state);
    if (!profile) {
      const current = await readEffectiveMcpServersFromCodexConfig();
      const snapshot = await codexDesktop.app.importCurrentCodexConfigSwitcher({
        name: "Imported Codex",
        mcpServers: current,
      });
      codexConfigSwitcherStore.applySnapshot(snapshot);
      profile = getRequiredActiveSwitcherProfile();
    }
    const now = Date.now();
    const nextProfile: CodexConfigSwitcherProfile = {
      ...profile,
      mcpServers: {
        ...profile.mcpServers,
        ...servers,
      },
      updatedAt: now,
    };
    const nextState: CodexConfigSwitcherState = {
      ...codexConfigSwitcherStore.state,
      activeProfileId: nextProfile.id,
      profiles: codexConfigSwitcherStore.state.profiles.map((item) =>
        item.id === nextProfile.id ? nextProfile : item
      ),
    };
    await writeCodexConfigSwitcherState(nextState);
    await syncSwitcherProfileToCodex(nextProfile);
  };

  const refreshMcp = async () => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
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
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      if (hasVisibleData) {
        mcpStore.setLoadState("ready");
      } else {
        mcpStore.setLoadState("error", msg);
        mcpStore.setStatusText(translate("runtime.loadFailed"));
      }
    }
  };

  const scheduleMcpStatusRefresh = (workspacePathValue: string) => {
    const workspace = normalizeWorkspacePath(workspacePathValue);
    if (!workspace) return;
    const existing = mcpStatusRefreshTimersByWorkspace.get(workspace);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      mcpStatusRefreshTimersByWorkspace.delete(workspace);
      if (normalizeWorkspacePath(runtimeStore.workspacePath) !== workspace) return;
      if (!getServerIdForWorkspace(workspace)) return;
      void refreshMcp();
    }, MCP_STATUS_REFRESH_DEBOUNCE_MS);
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
    if (!workspace || !name || normalizeWorkspacePath(runtimeStore.workspacePath) !== workspace) return;

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
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!getServerIdForWorkspace(workspace)) return;
    try {
      await requestReloadMcpConfig();
      invalidateMcpSnapshot(workspace);
      pushEvent("mcp", translate("runtime.configReloaded"), { threadId: APP_TIMELINE_ID });
      await refreshMcp();
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("mcp:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({ kind: "error", title: translate("runtime.mcpReloadFailedTitle"), message: msg });
      throw e;
    }
  };

  const toggleMcpEnabled = async (serverKey: string, enabled: boolean) => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
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
      pushEvent("mcp", `enabled=${enabled ? "true" : "false"}\n${serverKey}`, { threadId: APP_TIMELINE_ID });
      await refreshMcp();
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("mcp:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({ kind: "error", title: translate("runtime.mcpConfigFailedTitle"), message: msg });
      throw e;
    }
  };

  const deleteMcpServer = async (serverId: string) => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
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
      pushEvent("mcp", `deleted\n${id}`, { threadId: APP_TIMELINE_ID });
      await refreshMcp();
      showToast({ kind: "success", title: translate("runtime.mcpDeletedTitle"), message: id });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("mcp:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({ kind: "error", title: translate("runtime.mcpDeleteFailedTitle"), message: msg });
      throw e;
    }
  };

  const importMcpServersFromJson = async (text: string): Promise<{ imported: number; errors: string[] }> => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!getServerIdForWorkspace(workspace)) throw new Error(translate("runtime.noServiceCannotWriteMcpConfig"));
    const parsed = parseCodexMcpJsonImport(text);
    if (parsed.servers.length === 0) return { imported: 0, errors: parsed.errors };
    try {
      await upsertActiveSwitcherMcpServers(
        Object.fromEntries(parsed.servers.map((server) => [server.id, codexMcpServerSpecToConfigValue(server)]))
      );
      invalidateMcpSnapshot(workspace);
      pushEvent("mcp", `imported ${parsed.servers.length} servers`, { threadId: APP_TIMELINE_ID });
      await refreshMcp();
      showToast({
        kind: "success",
        title: translate("runtime.mcpJsonImportedTitle"),
        message: translate("runtime.mcpServersImported", { count: parsed.servers.length }),
      });
      return { imported: parsed.servers.length, errors: parsed.errors };
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("mcp:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({ kind: "error", title: translate("runtime.mcpJsonImportFailedTitle"), message: msg });
      throw e;
    }
  };

  const startMcpOAuthLogin = async (serverKey: string) => {
    if (!getServerIdForWorkspace(runtimeStore.workspacePath)) return;
    try {
      const url = await requestStartMcpOAuthLogin(serverKey);
      await openExternalUrl(url);
      pushEvent("mcp", `oauth login started\nid=${serverKey}\nurl=${url}`, { threadId: APP_TIMELINE_ID });
      showToast({
        kind: "success",
        title: translate("runtime.browserOpenedTitle"),
        message: translate("runtime.mcpOauthStarted", { server: serverKey }),
      });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      pushEvent("mcp:error", msg, { threadId: APP_TIMELINE_ID, level: "error" });
      showToast({ kind: "error", title: translate("runtime.mcpOauthFailedTitle"), message: msg });
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
      registerServerForWorkspace(workspace, serverId);
      if (normalizeWorkspacePath(runtimeStore.workspacePath) === workspace) {
        runtimeStore.setServer(serverId);
        appShellStore.setServerConnState("connected");
      }
      if (requestedExperimentalApi && !experimentalApi) {
        warnExperimentalApiUnavailableOnce(translate("runtime.experimentalApiUnavailableDetail"));
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
      showToast({ kind: "error", title: translate("runtime.serverStartFailedTitle"), message: msg });
      return "";
    }
  };

  const startServer = async () => {
    const workspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    if (!workspace) {
      showToast({
        kind: "warn",
        title: translate("runtime.noWorkspaceSelected"),
        message: translate("runtime.selectWorkspaceBeforeStartingServer"),
      });
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
      showToast({
        kind: "info",
        title: translate("runtime.sendCanceledTitle"),
        message: translate("runtime.workspaceSelectionCanceledMessage"),
      });
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

  const threadRollbackRuntime = createThreadRollbackRuntime({
    runtimeStore,
    threadStore,
    timelineStore,
    normalizeWorkspacePath,
    getWorkspaceForThread,
    getServerIdForThread,
    ensureThreadResumed,
    pushEvent,
    translate,
    showToast,
  });
  const { requestThreadRollback, rollbackTurns } = threadRollbackRuntime;

  const historyRewriteRuntime = createHistoryRewriteRuntime({
    runtimeStore,
    threadStore,
    timelineStore,
    normalizeWorkspacePath,
    getWorkspaceForThread,
    getServerIdForThread,
    ensureThreadResumed,
    requestThreadRollback,
    requestTurnInterrupt,
    pushEvent,
    translate,
    showToast,
  });
  const { rollbackHistoryRewriteBeforeSend } = historyRewriteRuntime;

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
    if (!threadStore.hasLocalThread(threadId)) return false;
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
    const oldLocalThread = threadStore.localThreads.find((item) => item.id === oldThreadId);
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

    const oldTitle = String(existing?.title ?? oldLocalThread?.title ?? "").trim();
    const oldFallback = fallbackThreadTitle(oldThreadId);
    const nextTitle = oldTitle && oldTitle !== oldFallback ? oldTitle : fallbackThreadTitle(newThreadId);
    const now = Date.now();
    const nextLocalThread: LocalThreadItem = {
      ...(oldLocalThread ?? {}),
      id: newThreadId,
      title: nextTitle,
      meta: String(existing?.meta ?? oldLocalThread?.meta ?? workspace).trim() || translate("runtime.noWorkspace"),
      cwd: workspace || undefined,
      createdAt: oldLocalThread?.createdAt ?? now,
      updatedAt: now,
      running: false,
      status: "ready",
    };

    runtimeStore.moveThreadComposeState(oldThreadId, newThreadId);
    runtimeStore.movePendingThreadInitSendCount(oldThreadId, newThreadId);
    timelineStore.moveThread(oldThreadId, newThreadId);
    threadStore.replaceThreadId(oldThreadId, newThreadId);
    threadStore.replaceLocalThreadId(oldThreadId, newThreadId, nextLocalThread);
    messageQueueStore.moveThreadQueue(oldThreadId, newThreadId);
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
        return {
          ok: false,
          error: readErrorMessage(error) || translate("runtime.createImageGenerationDisabledThreadFailed"),
        };
      }
    }

    const resumed = await resumeThreadWithModelToolConfig({
      threadId,
      threadWorkspace: args.threadWorkspace,
      threadServerId: args.threadServerId,
      model,
      configOverrides,
    });
    if (resumed && hasThreadModelToolConfigForModel(threadId, model)) return { ok: true, threadId };

    return {
      ok: false,
      error: translate("runtime.cannotDisableOfficialImageGenerationForThread"),
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
    const previousTitleById = new Map(
      [...threadStore.threadHistory, ...threadStore.localThreads].map((item) => [
        String(item.id ?? "").trim(),
        String(item.title ?? "").trim(),
      ])
    );
    threadStore.localThreads = threadStore.localThreads.filter((item) => {
      const threadId = String(item.id ?? "").trim();
      if (!threadId || incomingThreadIds.has(threadId)) return false;
      const createdAt = Number(item.createdAt ?? item.updatedAt ?? now);
      return now - createdAt <= LOCAL_THREAD_TTL_MS;
    });
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

    threadStore.threadHistory = historyItems;
    for (const item of items) {
      const threadId = String(item.id ?? "").trim();
      if (!threadId) continue;
      const running = Boolean(item.running);
      const activeTurnId = running ? String(item.activeTurnId ?? "").trim() : "";
      threadStore.setThreadRunning(threadId, running);
      threadStore.setActiveTurn(threadId, activeTurnId);
    }
    for (const item of [...historyItems, ...threadStore.localThreads]) {
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
    showToast({
      kind: "info",
      title: translate("runtime.checkEnvironmentTitle"),
      message: translate("runtime.checkingCodexNodeNpm"),
    });

    try {
      const res = await codexDesktop.codexServer.getDiagnostics();
      const ready = Boolean(res.codex.ok) && Boolean(res.node.ok) && Boolean(res.npm.ok);
      const details = [
        translate("runtime.diagnosticLine", {
          name: "codex",
          status: res.codex.ok ? translate("runtime.diagnosticOk") : translate("runtime.diagnosticMissing"),
        }),
        String(res.codex.details ?? "").trim(),
        translate("runtime.diagnosticLine", {
          name: "node",
          status: res.node.ok ? translate("runtime.diagnosticOk") : translate("runtime.diagnosticMissing"),
        }),
        String(res.node.details ?? "").trim(),
        translate("runtime.diagnosticLine", {
          name: "npm",
          status: res.npm.ok ? translate("runtime.diagnosticOk") : translate("runtime.diagnosticMissing"),
        }),
        String(res.npm.details ?? "").trim(),
      ]
        .filter(Boolean)
        .join("\n");

      pushEvent("env", details, {
        threadId: APP_TIMELINE_ID,
        level: ready ? "info" : "error",
      });

      if (ready) {
        showToast({
          kind: "success",
          title: translate("runtime.environmentReadyTitle"),
          message: translate("runtime.codexNodeNpmReady"),
        });
        return;
      }

      appShellStore.openSettings("env");
      showToast({
        kind: "warn",
        title: translate("runtime.environmentNotReadyTitle"),
        message: translate("runtime.environmentInstallHint"),
      });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      showToast({ kind: "error", title: translate("runtime.checkFailedTitle"), message: msg });
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
    const optimisticLocalThread: LocalThreadItem = {
      id: optimisticThreadId,
      title: translate("runtime.creating"),
      meta: workspaceBeforeStart || translate("runtime.noWorkspace"),
      cwd: workspaceBeforeStart || undefined,
      createdAt: optimisticCreatedAt,
      updatedAt: optimisticCreatedAt,
      running: false,
      status: "creating",
    };
    threadStore.upsertLocalThread(optimisticLocalThread);
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
            showToast({
              kind: "warn",
              title: translate("runtime.threadCreateFailedTitle"),
              message: translate("runtime.pendingContentRestored"),
            });
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
            showToast({
              kind: "warn",
              title: translate("runtime.threadCreateFailedTitle"),
              message: translate("runtime.pendingContentRestored"),
            });
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
      const finalizedLocalThread: LocalThreadItem = {
        id,
        title: `Thread ${id.slice(-8)}`,
        meta: workspace || translate("runtime.noWorkspace"),
        cwd: workspace || undefined,
        createdAt: optimisticCreatedAt,
        updatedAt: Date.now(),
        running: false,
        status: "ready",
      };
      threadStore.replaceThreadId(optimisticThreadId, id);
      threadStore.replaceLocalThreadId(optimisticThreadId, id, finalizedLocalThread);
      messageQueueStore.moveThreadQueue(optimisticThreadId, id);
      resumedThreadIds.add(id);
      setThreadWorkspace(id, workspace);
      clearThreadWorkspace(optimisticThreadId);
      pushEvent("thread", translate("runtime.threadCreated"), { threadId: id });
      appendDebugLog("thread.create", "local state applied", {
        attemptId,
        threadId: id,
        threadHistorySize: threadStore.threadHistory.length,
        localThreadSize: threadStore.localThreads.length,
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
            showToast({
              kind: "warn",
              title: translate("runtime.threadCreateFailedTitle"),
              message: translate("runtime.pendingContentRestored"),
            });
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
    const target = findThreadListItem(id);
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
      void refreshThreadGoal(id);
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
    const hasHistoryThread = threadStore.threadHistory.some((item) => item.id === id);
    if (!hasHistoryThread && threadStore.hasLocalThread(id)) {
      invalidateThreadContentCache(threadContentCacheByKey, id);
      clearThreadRuntimeState(id);
      pushEvent("history", translate("runtime.localSessionRemoved"), { threadId: APP_TIMELINE_ID });
      return;
    }
    try {
      await codexDesktop.history.deleteThread({ threadId: id });
      invalidateThreadContentCache(threadContentCacheByKey, id);
      clearThreadRuntimeState(id);
      pushEvent("history", translate("runtime.sessionDeleted"), { threadId: APP_TIMELINE_ID });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      showToast({ kind: "error", title: translate("runtime.deleteFailedTitle"), message: msg });
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
      pushEvent("steer:error", translate("runtime.missingActiveTurnForSteer"), { threadId, level: "error" });
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
    getComposeMode: () => runtimeStore.composeMode,
    getModel: () => runtimeStore.model,
    getReasoningEffort: () => runtimeStore.reasoningEffort,
    getReasoningSummary: () => runtimeStore.reasoningSummary,
    getSandboxMode: () => runtimeStore.sandboxMode,
    getApprovalPolicy: () => configStore.draft.approvalPolicy,
    getApprovalsReviewer: () => configStore.draft.approvalsReviewer,
    getInstructionProfile: resolveCurrentInstructionProfile,
    toCodexUserInputs,
  });
  const { startTurnWithInput } = turnStartRuntime;

  type SendDraft = {
    anchorTurnId?: string;
    composeInput: string;
    composeAttachments: ComposeImageAttachment[];
    composeFileMentions: ComposeWorkspaceFileMention[];
    model?: string;
    reasoningEffort?: string;
    sandboxMode?: string;
    composeMode?: "default" | "plan";
  };

  function cloneComposeAttachmentsForSend(items: ComposeImageAttachment[]): ComposeImageAttachment[] {
    return items.map((item: ComposeImageAttachment) => ({
      ...item,
      input: { ...item.input },
    }));
  }

  function cloneComposeMentionsForSend(items: ComposeWorkspaceFileMention[]): ComposeWorkspaceFileMention[] {
    return items.map((item: ComposeWorkspaceFileMention) => ({ ...item }));
  }

  function runtimeStoreSendDraft(): SendDraft {
    return {
      composeInput: String(runtimeStore.composeInput ?? ""),
      composeAttachments: runtimeStore.composeAttachments,
      composeFileMentions: runtimeStore.composeFileMentions,
      model: runtimeStore.model,
      reasoningEffort: runtimeStore.reasoningEffort,
      sandboxMode: runtimeStore.sandboxMode,
      composeMode: runtimeStore.composeMode,
    };
  }

  function clearRuntimeStoreDraftAfterSend() {
    runtimeStore.composeInput = "";
    runtimeStore.clearComposeAttachments();
    runtimeStore.clearComposeFileMentions();
    runtimeStore.endHistoryRewrite();
  }

  const sendOrQueueDraft = async (
    mode: "auto" | "steer",
    draft: SendDraft,
    opts?: { clearRuntimeDraftOnAccept?: boolean }
  ): Promise<boolean> => {
    const clearRuntimeDraftOnAccept = opts?.clearRuntimeDraftOnAccept ?? false;
    const composeInput = String(draft.composeInput ?? "");
    const composeAttachments = cloneComposeAttachmentsForSend(draft.composeAttachments);
    const composeFileMentions = cloneComposeMentionsForSend(draft.composeFileMentions);
    const requestedModel = String(draft.model ?? runtimeStore.model ?? "").trim();
    const requestedReasoningEffort = String(draft.reasoningEffort ?? runtimeStore.reasoningEffort ?? "").trim();
    const requestedSandboxMode = String(draft.sandboxMode ?? runtimeStore.sandboxMode ?? "").trim();
    const requestedComposeMode = draft.composeMode ?? runtimeStore.composeMode;
    const input = buildUserTurnInput(composeInput, composeAttachments, composeFileMentions);
    if (input.length === 0) return false;
    const localUserMessage = summarizeLocalUserMessage(input);
    const visibleText = String(localUserMessage.payload.text ?? "").trim();
    const queueText = String(localUserMessage.payload.text ?? "");

    const workspaceReady = await ensureWorkspaceForSend();
    if (!workspaceReady) {
      showToast({
        kind: "error",
        title: translate("runtime.cannotSendTitle"),
        message: translate("runtime.workspaceUnavailable"),
      });
      return false;
    }
    const activeWorkspace = normalizeWorkspacePath(runtimeStore.workspacePath);
    const activeServerId = await ensureServerForWorkspace(activeWorkspace);
    if (!activeServerId) {
      showToast({
        kind: "error",
        title: translate("runtime.cannotSendTitle"),
        message: translate("runtime.serviceUnavailable"),
      });
      return false;
    }
    if (!runtimeStore.currentThreadId) {
      void createThread();
    }
    let threadId = String(runtimeStore.currentThreadId ?? "").trim();
    if (!threadId) {
      showToast({
        kind: "error",
        title: translate("runtime.cannotSendTitle"),
        message: translate("runtime.threadNotReadyRetry"),
      });
      return false;
    }
    if (isPendingThreadId(threadId)) {
      const prevCount = runtimeStore.pendingThreadInitSendCountByThread.get(threadId) ?? 0;
      const nextCount = Number.isFinite(prevCount) ? Math.max(0, Math.round(prevCount)) + 1 : 1;
      runtimeStore.setPendingThreadInitSendCount(threadId, nextCount);

      if (clearRuntimeDraftOnAccept) clearRuntimeStoreDraftAfterSend();

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
      upsertThreadPreparingEvent(threadId);
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
      return true;
    }
    let threadWorkspace = normalizeWorkspacePath(getWorkspaceForThread(threadId) || runtimeStore.workspacePath);
    let threadServerId = await ensureServerForWorkspace(threadWorkspace);
    if (!threadServerId) {
      showToast({
        kind: "error",
        title: translate("runtime.cannotSendTitle"),
        message: translate("runtime.threadServiceUnavailable"),
      });
      return false;
    }
    setThreadWorkspace(threadId, threadWorkspace);

    const compatibility = await ensureThreadModelToolCompatibility({
      threadId,
      threadWorkspace,
      threadServerId,
      model: requestedModel,
    });
    if (!compatibility.ok) {
      showToast({ kind: "warn", title: translate("runtime.threadMustBeRecreatedTitle"), message: compatibility.error });
      pushEvent("turn:error", compatibility.error, { threadId, level: "error" });
      return false;
    }
    if (compatibility.threadId !== threadId) {
      threadId = compatibility.threadId;
      threadWorkspace = normalizeWorkspacePath(getWorkspaceForThread(threadId) || threadWorkspace);
      threadServerId = await ensureServerForWorkspace(threadWorkspace);
      if (!threadServerId) {
        showToast({
          kind: "error",
          title: translate("runtime.cannotSendTitle"),
          message: translate("runtime.threadServiceUnavailable"),
        });
        return false;
      }
      setThreadWorkspace(threadId, threadWorkspace);
    }

    {
      const existing = findThreadListItem(threadId);
      const currentTitle = String(existing?.title ?? "").trim();
      const placeholder = fallbackThreadTitle(threadId);
      const titleSeedText =
        visibleText ||
        (composeFileMentions.length > 0
          ? translate("runtime.fileCount", { count: composeFileMentions.length })
          : translate("runtime.imageCount", { count: composeAttachments.length }));
      if (!currentTitle || currentTitle === placeholder) {
        if (!isBootstrapThreadTitleSource(titleSeedText)) {
          const nextTitle = titleFromFirstUserMessage(titleSeedText) || placeholder;
          const titlePatch = {
            id: threadId,
            title: nextTitle,
            meta: String(existing?.meta ?? threadWorkspace ?? "").trim() || translate("runtime.noWorkspace"),
            cwd: String(existing?.cwd ?? threadWorkspace ?? "").trim() || undefined,
            modelProvider: String(existing?.modelProvider ?? "").trim() || undefined,
            updatedAt: Date.now(),
            running: threadStore.runningThreadIds.has(threadId),
          };
          if (threadStore.hasLocalThread(threadId)) {
            threadStore.patchLocalThread(threadId, titlePatch);
          } else {
            threadStore.upsertThreadHistory(titlePatch);
          }
        }
      }
    }

    const overrideAnchorTurnId = String(draft.anchorTurnId ?? "").trim();
    const rewroteHistoryBeforeSend =
      Boolean(overrideAnchorTurnId) ||
      (runtimeStore.historyRewriteActive && runtimeStore.historyRewriteSource === "history");
    const historyRewriteReady = await rollbackHistoryRewriteBeforeSend(threadId, {
      anchorTurnId: overrideAnchorTurnId,
      force: Boolean(overrideAnchorTurnId),
    });
    if (!historyRewriteReady) return false;
    if (!rewroteHistoryBeforeSend) {
      const resumed = await ensureThreadResumed(threadId);
      if (!resumed) {
        showToast({
          kind: "error",
          title: translate("runtime.cannotSendTitle"),
          message: translate("runtime.threadResumeFailed"),
        });
        return false;
      }
    }

    for (const event of timelineStore.eventsForThread(threadId)) {
      if (event.method !== "local/contextCompaction") continue;
      timelineStore.removeEvent({ threadId, id: event.id });
    }

    if (clearRuntimeDraftOnAccept) clearRuntimeStoreDraftAfterSend();

    const running = threadStore.runningThreadIds.has(threadId);
    if (running && mode === "auto") {
      messageQueueStore.enqueue({
        threadId,
        text: queueText,
        inputs: input,
        displayText: localUserMessage.displayText,
      });
      return true;
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
        return false;
      }
      setLocalUserEventState("sent", "info", turnIdValue || undefined);
      return true;
    }

    setLocalUserEventState("sending", "info");
    if (threadStore.hasLocalThread(threadId)) {
      upsertThreadPreparingEvent(threadId);
    }
    const started = await startTurnWithInput({
      threadId,
      threadWorkspace,
      threadServerId,
      input,
      model: requestedModel,
      effort: requestedReasoningEffort,
      sandboxMode: requestedSandboxMode,
      composeModeOverride: requestedComposeMode,
    });
    if (started.ok) {
      setLocalUserEventState("sent", "info");
      return true;
    }
    clearThreadPreparingEvent(threadId);
    pushEvent("turn:error", started.error, { threadId, level: "error" });
    threadStore.setThreadRunning(threadId, false);
    setLocalUserEventState("failed", "error");
    return false;
  };

  const messageQueueRuntime = createMessageQueueRuntime({
    runtimeStore,
    threadStore,
    timelineStore,
    messageQueueStore,
    normalizeWorkspacePath,
    getWorkspaceForThread,
    ensureServerForWorkspace,
    ensureThreadResumed,
    ensureThreadModelToolCompatibility,
    requestTurnSteer,
    startTurnWithInput,
    clearThreadPreparingEvent,
    upsertThreadPreparingEvent,
    cloneUserTurnInputs,
    buildComposeAttachmentsFromUserTurnInputs,
    buildTimelineUserMessagePayload,
    fileNameFromPathLike,
    pushEvent,
    translate,
    showToast,
  });
  const { flushQueueForThread, sendQueuedMessageNow, editQueuedMessage, removeQueuedMessage } = messageQueueRuntime;

  const notifyCompletedTurnIfBackground = async (threadIdValue: string) => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId) return;
    const historyItem = findThreadListItem(threadId);
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
    return await sendOrQueueDraft("auto", runtimeStoreSendDraft(), { clearRuntimeDraftOnAccept: true });
  };

  const sendHistoryRewriteDraft: RuntimeOrchestrator["sendHistoryRewriteDraft"] = async (draft) => {
    const anchorTurnId = String(draft?.anchorTurnId ?? "").trim();
    if (!anchorTurnId) {
      showToast({
        kind: "error",
        title: translate("runtime.rewriteUnavailableTitle"),
        message: translate("runtime.rewriteTurnNotFound"),
      });
      return false;
    }
    return await sendOrQueueDraft("auto", {
      anchorTurnId,
      composeInput: String(draft?.composeInput ?? ""),
      composeAttachments: Array.isArray(draft?.composeAttachments) ? draft.composeAttachments : [],
      composeFileMentions: Array.isArray(draft?.composeFileMentions) ? draft.composeFileMentions : [],
      model: String(draft?.model ?? ""),
      reasoningEffort: String(draft?.reasoningEffort ?? ""),
      sandboxMode: String(draft?.sandboxMode ?? ""),
      composeMode: draft?.composeMode === "plan" ? "plan" : "default",
    });
  };

  const steerNow = async () => {
    await sendOrQueueDraft("steer", runtimeStoreSendDraft(), { clearRuntimeDraftOnAccept: true });
  };

  const interruptTurn = async () => {
    const threadId = runtimeStore.currentThreadId;
    if (!threadId) return;
    const turnIdValue = String(threadStore.activeTurnIdByThread.get(threadId) ?? "").trim();
    if (!turnIdValue) {
      pushEvent("interrupt:error", translate("runtime.missingActiveTurnForInterrupt"), { threadId, level: "error" });
      return;
    }
    await requestTurnInterrupt(threadId, turnIdValue);
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

  const threadMemoryRuntime = createThreadMemoryRuntime({
    appTimelineId: APP_TIMELINE_ID,
    runtimeStore,
    getServerIdForWorkspace,
    getServerIdForThread,
    pushEvent,
    translate,
    showToast,
  });
  const { resetCodexMemory, setCurrentThreadMemoryMode } = threadMemoryRuntime;

  const promptResponseRuntime = createPromptResponseRuntime({
    appTimelineId: APP_TIMELINE_ID,
    runtimeStore,
    approvalStore,
    userInputStore,
    respond: (args) => codexDesktop.codexServer.respond(args as Parameters<typeof codexDesktop.codexServer.respond>[0]),
    pushEvent,
    translate,
    showToast,
  });
  const {
    submitUserInputPromptForThread,
    cancelUserInputPromptForThread,
    submitActiveUserInputPrompt,
    cancelActiveUserInputPrompt,
    submitActiveApprovalPrompt,
    dismissActiveApprovalPrompt,
  } = promptResponseRuntime;

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
            workspaceFilesStore.scheduleGitStatusRefresh(500);
            setTimeout(() => {
              if (!threadStore.runningThreadIds.has(threadId)) void flushQueueForThread(threadId);
            }, 120);
          }
          return;
        }

        if (msg.method === "turn/started") {
          return;
        }

        if (msg.method === "skills/changed") {
          const eventServerId = normalizeWorkspacePath(payload?.serverId ?? "");
          const workspace = normalizeWorkspacePath(
            workspaceByServerId.get(eventServerId) ??
              (eventServerId && eventServerId === runtimeStore.serverId ? runtimeStore.workspacePath : "")
          );
          if (workspace) invalidateSkillsSnapshot(workspace);
          if (workspace && normalizeWorkspacePath(runtimeStore.workspacePath) === workspace)
            scheduleSkillsRefresh(workspace);
          return;
        }

        if (msg.method === "mcpServer/startupStatus/updated") {
          const eventServerId = normalizeWorkspacePath(payload?.serverId ?? "");
          const workspace = normalizeWorkspacePath(
            workspaceByServerId.get(eventServerId) ??
              (eventServerId && eventServerId === runtimeStore.serverId ? runtimeStore.workspacePath : "")
          );
          const params = (msg.params ?? {}) as Record<string, unknown>;
          const name = String(params.name ?? "").trim();
          const status = String(params.status ?? "").trim();
          const error = String(params.error ?? "").trim();
          if (workspace) {
            invalidateMcpSnapshot(workspace);
            applyMcpStartupStatusNotification({ workspace, name, status, error });
            if (status === "ready" || status === "failed" || status === "cancelled") {
              scheduleMcpStatusRefresh(workspace);
            }
          }
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
          resetSidePanelStores(translate("runtime.noService"));
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
  resetSidePanelStores(translate("runtime.noService"));

  runtimeOrchestrator = {
    dispose() {
      // 窗口卸载/热重载时强制落盘输入草稿与线程级参数，避免防抖计时器未触发导致丢失。
      try {
        runtimeStore.flushPendingComposeStateSaves();
      } catch {}
      for (const timer of skillsRefreshTimersByWorkspace.values()) clearTimeout(timer);
      skillsRefreshTimersByWorkspace.clear();
      for (const timer of mcpStatusRefreshTimersByWorkspace.values()) clearTimeout(timer);
      mcpStatusRefreshTimersByWorkspace.clear();
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
    sendHistoryRewriteDraft,
    steerNow,
    sendQueuedMessageNow,
    editQueuedMessage,
    removeQueuedMessage,
    interruptTurn,
    compactThread,
    resetCodexMemory,
    setCurrentThreadMemoryMode,
    refreshThreadGoal,
    promptAndSetCurrentThreadGoal,
    setCurrentThreadGoal,
    completeCurrentThreadGoal,
    clearCurrentThreadGoal,
    refreshGlobalConfig,
    saveGlobalConfig,
    resetGlobalConfig,
    applyCodexProfile,
    openExternalUrl,
    readTextFile,
    writeTextFile,
    readWorkspaceDirectory,
    getWorkspaceMetadata,
    readWorkspaceTextFile,
    deleteWorkspaceFile,
    writeWorkspaceTextFile,
    refreshSkills,
    toggleSkill,
    addSkillRoot,
    removeSkillRoot,
    refreshCodexConfigSwitcher,
    importCurrentCodexConfigProfile,
    activateCodexConfigProfile,
    refreshMcp,
    reloadMcpConfig,
    toggleMcpEnabled,
    deleteMcpServer,
    importMcpServersFromJson,
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
