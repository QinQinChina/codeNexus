import type {
  ClientNotification,
  ClientRequest,
  InitializeResponse,
  ServerNotification,
  ServerRequest,
} from "../../generated/codex-app-server";
import type { CancelLoginAccountResponse } from "../../generated/codex-app-server/v2/CancelLoginAccountResponse";
import type { ConfigReadResponse } from "../../generated/codex-app-server/v2/ConfigReadResponse";
import type { ConfigRequirementsReadResponse } from "../../generated/codex-app-server/v2/ConfigRequirementsReadResponse";
import type { ConfigWriteResponse } from "../../generated/codex-app-server/v2/ConfigWriteResponse";
import type { ExperimentalFeatureEnablementSetResponse } from "../../generated/codex-app-server/v2/ExperimentalFeatureEnablementSetResponse";
import type { EnvironmentAddResponse } from "../../generated/codex-app-server/v2/EnvironmentAddResponse";
import type { ListMcpServerStatusResponse } from "../../generated/codex-app-server/v2/ListMcpServerStatusResponse";
import type { AppsListResponse } from "../../generated/codex-app-server/v2/AppsListResponse";
import type { CollaborationModeListResponse } from "../../generated/codex-app-server/v2/CollaborationModeListResponse";
import type { CommandExecResponse } from "../../generated/codex-app-server/v2/CommandExecResponse";
import type { CommandExecResizeResponse } from "../../generated/codex-app-server/v2/CommandExecResizeResponse";
import type { CommandExecTerminateResponse } from "../../generated/codex-app-server/v2/CommandExecTerminateResponse";
import type { CommandExecWriteResponse } from "../../generated/codex-app-server/v2/CommandExecWriteResponse";
import type { ExperimentalFeatureListResponse } from "../../generated/codex-app-server/v2/ExperimentalFeatureListResponse";
import type { FsCopyResponse } from "../../generated/codex-app-server/v2/FsCopyResponse";
import type { FsCreateDirectoryResponse } from "../../generated/codex-app-server/v2/FsCreateDirectoryResponse";
import type { FsGetMetadataResponse } from "../../generated/codex-app-server/v2/FsGetMetadataResponse";
import type { FsReadDirectoryResponse } from "../../generated/codex-app-server/v2/FsReadDirectoryResponse";
import type { FsReadFileResponse } from "../../generated/codex-app-server/v2/FsReadFileResponse";
import type { FsRemoveResponse } from "../../generated/codex-app-server/v2/FsRemoveResponse";
import type { FsUnwatchResponse } from "../../generated/codex-app-server/v2/FsUnwatchResponse";
import type { FsWatchResponse } from "../../generated/codex-app-server/v2/FsWatchResponse";
import type { FsWriteFileResponse } from "../../generated/codex-app-server/v2/FsWriteFileResponse";
import type { ExternalAgentConfigDetectResponse } from "../../generated/codex-app-server/v2/ExternalAgentConfigDetectResponse";
import type { ExternalAgentConfigImportResponse } from "../../generated/codex-app-server/v2/ExternalAgentConfigImportResponse";
import type { FeedbackUploadResponse } from "../../generated/codex-app-server/v2/FeedbackUploadResponse";
import type { GetAccountRateLimitsResponse } from "../../generated/codex-app-server/v2/GetAccountRateLimitsResponse";
import type { GetAccountResponse } from "../../generated/codex-app-server/v2/GetAccountResponse";
import type { HooksListResponse } from "../../generated/codex-app-server/v2/HooksListResponse";
import type { LoginAccountResponse } from "../../generated/codex-app-server/v2/LoginAccountResponse";
import type { LogoutAccountResponse } from "../../generated/codex-app-server/v2/LogoutAccountResponse";
import type { MarketplaceAddResponse } from "../../generated/codex-app-server/v2/MarketplaceAddResponse";
import type { MarketplaceRemoveResponse } from "../../generated/codex-app-server/v2/MarketplaceRemoveResponse";
import type { MarketplaceUpgradeResponse } from "../../generated/codex-app-server/v2/MarketplaceUpgradeResponse";
import type { MemoryResetResponse } from "../../generated/codex-app-server/v2/MemoryResetResponse";
import type { McpServerOauthLoginResponse } from "../../generated/codex-app-server/v2/McpServerOauthLoginResponse";
import type { McpResourceReadResponse } from "../../generated/codex-app-server/v2/McpResourceReadResponse";
import type { McpServerRefreshResponse } from "../../generated/codex-app-server/v2/McpServerRefreshResponse";
import type { McpServerToolCallResponse } from "../../generated/codex-app-server/v2/McpServerToolCallResponse";
import type { ModelListResponse } from "../../generated/codex-app-server/v2/ModelListResponse";
import type { ModelProviderCapabilitiesReadResponse } from "../../generated/codex-app-server/v2/ModelProviderCapabilitiesReadResponse";
import type { MockExperimentalMethodResponse } from "../../generated/codex-app-server/v2/MockExperimentalMethodResponse";
import type { PluginInstallResponse } from "../../generated/codex-app-server/v2/PluginInstallResponse";
import type { PluginListResponse } from "../../generated/codex-app-server/v2/PluginListResponse";
import type { PluginReadResponse } from "../../generated/codex-app-server/v2/PluginReadResponse";
import type { PluginShareDeleteResponse } from "../../generated/codex-app-server/v2/PluginShareDeleteResponse";
import type { PluginShareCheckoutResponse } from "../../generated/codex-app-server/v2/PluginShareCheckoutResponse";
import type { PluginShareListResponse } from "../../generated/codex-app-server/v2/PluginShareListResponse";
import type { PluginShareSaveResponse } from "../../generated/codex-app-server/v2/PluginShareSaveResponse";
import type { PluginShareUpdateTargetsResponse } from "../../generated/codex-app-server/v2/PluginShareUpdateTargetsResponse";
import type { PluginSkillReadResponse } from "../../generated/codex-app-server/v2/PluginSkillReadResponse";
import type { PluginUninstallResponse } from "../../generated/codex-app-server/v2/PluginUninstallResponse";
import type { ProcessKillResponse } from "../../generated/codex-app-server/v2/ProcessKillResponse";
import type { ProcessResizePtyResponse } from "../../generated/codex-app-server/v2/ProcessResizePtyResponse";
import type { ProcessSpawnResponse } from "../../generated/codex-app-server/v2/ProcessSpawnResponse";
import type { ProcessWriteStdinResponse } from "../../generated/codex-app-server/v2/ProcessWriteStdinResponse";
import type { RemoteControlDisableResponse } from "../../generated/codex-app-server/v2/RemoteControlDisableResponse";
import type { RemoteControlEnableResponse } from "../../generated/codex-app-server/v2/RemoteControlEnableResponse";
import type { RemoteControlStatusReadResponse } from "../../generated/codex-app-server/v2/RemoteControlStatusReadResponse";
import type { ReviewStartResponse } from "../../generated/codex-app-server/v2/ReviewStartResponse";
import type { SendAddCreditsNudgeEmailResponse } from "../../generated/codex-app-server/v2/SendAddCreditsNudgeEmailResponse";
import type { SkillsConfigWriteResponse } from "../../generated/codex-app-server/v2/SkillsConfigWriteResponse";
import type { SkillsListResponse } from "../../generated/codex-app-server/v2/SkillsListResponse";
import type { ThreadApproveGuardianDeniedActionResponse } from "../../generated/codex-app-server/v2/ThreadApproveGuardianDeniedActionResponse";
import type { ThreadArchiveResponse } from "../../generated/codex-app-server/v2/ThreadArchiveResponse";
import type { ThreadBackgroundTerminalsCleanResponse } from "../../generated/codex-app-server/v2/ThreadBackgroundTerminalsCleanResponse";
import type { ThreadCompactStartResponse } from "../../generated/codex-app-server/v2/ThreadCompactStartResponse";
import type { ThreadDecrementElicitationResponse } from "../../generated/codex-app-server/v2/ThreadDecrementElicitationResponse";
import type { ThreadForkResponse } from "../../generated/codex-app-server/v2/ThreadForkResponse";
import type { ThreadGoalClearResponse } from "../../generated/codex-app-server/v2/ThreadGoalClearResponse";
import type { ThreadGoalGetResponse } from "../../generated/codex-app-server/v2/ThreadGoalGetResponse";
import type { ThreadGoalSetResponse } from "../../generated/codex-app-server/v2/ThreadGoalSetResponse";
import type { ThreadIncrementElicitationResponse } from "../../generated/codex-app-server/v2/ThreadIncrementElicitationResponse";
import type { ThreadInjectItemsResponse } from "../../generated/codex-app-server/v2/ThreadInjectItemsResponse";
import type { ThreadListResponse } from "../../generated/codex-app-server/v2/ThreadListResponse";
import type { ThreadLoadedListResponse } from "../../generated/codex-app-server/v2/ThreadLoadedListResponse";
import type { ThreadMemoryModeSetResponse } from "../../generated/codex-app-server/v2/ThreadMemoryModeSetResponse";
import type { ThreadMetadataUpdateResponse } from "../../generated/codex-app-server/v2/ThreadMetadataUpdateResponse";
import type { ThreadReadResponse } from "../../generated/codex-app-server/v2/ThreadReadResponse";
import type { ThreadRealtimeAppendAudioResponse } from "../../generated/codex-app-server/v2/ThreadRealtimeAppendAudioResponse";
import type { ThreadRealtimeAppendTextResponse } from "../../generated/codex-app-server/v2/ThreadRealtimeAppendTextResponse";
import type { ThreadRealtimeListVoicesResponse } from "../../generated/codex-app-server/v2/ThreadRealtimeListVoicesResponse";
import type { ThreadRealtimeStartResponse } from "../../generated/codex-app-server/v2/ThreadRealtimeStartResponse";
import type { ThreadRealtimeStopResponse } from "../../generated/codex-app-server/v2/ThreadRealtimeStopResponse";
import type { ThreadResumeResponse } from "../../generated/codex-app-server/v2/ThreadResumeResponse";
import type { ThreadRollbackResponse } from "../../generated/codex-app-server/v2/ThreadRollbackResponse";
import type { ThreadSetNameResponse } from "../../generated/codex-app-server/v2/ThreadSetNameResponse";
import type { ThreadShellCommandResponse } from "../../generated/codex-app-server/v2/ThreadShellCommandResponse";
import type { ThreadStartResponse } from "../../generated/codex-app-server/v2/ThreadStartResponse";
import type { ThreadTurnsItemsListResponse } from "../../generated/codex-app-server/v2/ThreadTurnsItemsListResponse";
import type { ThreadTurnsListResponse } from "../../generated/codex-app-server/v2/ThreadTurnsListResponse";
import type { ThreadUnarchiveResponse } from "../../generated/codex-app-server/v2/ThreadUnarchiveResponse";
import type { ThreadUnsubscribeResponse } from "../../generated/codex-app-server/v2/ThreadUnsubscribeResponse";
import type { TurnInterruptResponse } from "../../generated/codex-app-server/v2/TurnInterruptResponse";
import type { TurnStartResponse } from "../../generated/codex-app-server/v2/TurnStartResponse";
import type { TurnSteerResponse } from "../../generated/codex-app-server/v2/TurnSteerResponse";
import type { WindowsSandboxReadinessResponse } from "../../generated/codex-app-server/v2/WindowsSandboxReadinessResponse";
import type { WindowsSandboxSetupStartResponse } from "../../generated/codex-app-server/v2/WindowsSandboxSetupStartResponse";

export type JsonRpcId = number | string;

type AssertNever<T extends never> = T;

type SupportedCodexRpcResultMap = {
  initialize: InitializeResponse;
  "thread/start": ThreadStartResponse;
  "thread/resume": ThreadResumeResponse;
  "thread/fork": ThreadForkResponse;
  "thread/archive": ThreadArchiveResponse;
  "thread/unsubscribe": ThreadUnsubscribeResponse;
  "thread/name/set": ThreadSetNameResponse;
  "thread/metadata/update": ThreadMetadataUpdateResponse;
  "thread/memoryMode/set": ThreadMemoryModeSetResponse;
  "memory/reset": MemoryResetResponse;
  "thread/unarchive": ThreadUnarchiveResponse;
  "thread/read": ThreadReadResponse;
  "thread/list": ThreadListResponse;
  "thread/loaded/list": ThreadLoadedListResponse;
  "thread/increment_elicitation": ThreadIncrementElicitationResponse;
  "thread/decrement_elicitation": ThreadDecrementElicitationResponse;
  "thread/goal/set": ThreadGoalSetResponse;
  "thread/goal/get": ThreadGoalGetResponse;
  "thread/goal/clear": ThreadGoalClearResponse;
  "thread/rollback": ThreadRollbackResponse;
  "thread/compact/start": ThreadCompactStartResponse;
  "thread/shellCommand": ThreadShellCommandResponse;
  "thread/approveGuardianDeniedAction": ThreadApproveGuardianDeniedActionResponse;
  "thread/backgroundTerminals/clean": ThreadBackgroundTerminalsCleanResponse;
  "turn/start": TurnStartResponse;
  "turn/steer": TurnSteerResponse;
  "turn/interrupt": TurnInterruptResponse;
  "thread/realtime/start": ThreadRealtimeStartResponse;
  "thread/realtime/appendAudio": ThreadRealtimeAppendAudioResponse;
  "thread/realtime/appendText": ThreadRealtimeAppendTextResponse;
  "thread/realtime/stop": ThreadRealtimeStopResponse;
  "thread/realtime/listVoices": ThreadRealtimeListVoicesResponse;
  "config/read": ConfigReadResponse;
  "config/value/write": ConfigWriteResponse;
  "config/batchWrite": ConfigWriteResponse;
  "configRequirements/read": ConfigRequirementsReadResponse;
  "skills/list": SkillsListResponse;
  "hooks/list": HooksListResponse;
  "skills/config/write": SkillsConfigWriteResponse;
  "marketplace/add": MarketplaceAddResponse;
  "marketplace/remove": MarketplaceRemoveResponse;
  "marketplace/upgrade": MarketplaceUpgradeResponse;
  "plugin/list": PluginListResponse;
  "plugin/read": PluginReadResponse;
  "plugin/skill/read": PluginSkillReadResponse;
  "plugin/share/save": PluginShareSaveResponse;
  "plugin/share/updateTargets": PluginShareUpdateTargetsResponse;
  "plugin/share/list": PluginShareListResponse;
  "plugin/share/delete": PluginShareDeleteResponse;
  "plugin/share/checkout": PluginShareCheckoutResponse;
  "plugin/install": PluginInstallResponse;
  "plugin/uninstall": PluginUninstallResponse;
  "app/list": AppsListResponse;
  "model/list": ModelListResponse;
  "modelProvider/capabilities/read": ModelProviderCapabilitiesReadResponse;
  "experimentalFeature/list": ExperimentalFeatureListResponse;
  "experimentalFeature/enablement/set": ExperimentalFeatureEnablementSetResponse;
  "remoteControl/enable": RemoteControlEnableResponse;
  "remoteControl/disable": RemoteControlDisableResponse;
  "remoteControl/status/read": RemoteControlStatusReadResponse;
  "collaborationMode/list": CollaborationModeListResponse;
  "environment/add": EnvironmentAddResponse;
  "mcpServerStatus/list": ListMcpServerStatusResponse;
  "config/mcpServer/reload": McpServerRefreshResponse;
  "mcpServer/oauth/login": McpServerOauthLoginResponse;
  "mcpServer/resource/read": McpResourceReadResponse;
  "mcpServer/tool/call": McpServerToolCallResponse;
  "review/start": ReviewStartResponse;
  "externalAgentConfig/detect": ExternalAgentConfigDetectResponse;
  "externalAgentConfig/import": ExternalAgentConfigImportResponse;
  "feedback/upload": FeedbackUploadResponse;
  "command/exec": CommandExecResponse;
  "command/exec/write": CommandExecWriteResponse;
  "command/exec/terminate": CommandExecTerminateResponse;
  "command/exec/resize": CommandExecResizeResponse;
  "process/spawn": ProcessSpawnResponse;
  "process/writeStdin": ProcessWriteStdinResponse;
  "process/kill": ProcessKillResponse;
  "process/resizePty": ProcessResizePtyResponse;
  "fs/readFile": FsReadFileResponse;
  "fs/writeFile": FsWriteFileResponse;
  "fs/createDirectory": FsCreateDirectoryResponse;
  "fs/getMetadata": FsGetMetadataResponse;
  "fs/readDirectory": FsReadDirectoryResponse;
  "fs/remove": FsRemoveResponse;
  "fs/copy": FsCopyResponse;
  "fs/watch": FsWatchResponse;
  "fs/unwatch": FsUnwatchResponse;
  "mock/experimentalMethod": MockExperimentalMethodResponse;
  "windowsSandbox/setupStart": WindowsSandboxSetupStartResponse;
  "windowsSandbox/readiness": WindowsSandboxReadinessResponse;
  "account/login/start": LoginAccountResponse;
  "account/login/cancel": CancelLoginAccountResponse;
  "account/logout": LogoutAccountResponse;
  "account/rateLimits/read": GetAccountRateLimitsResponse;
  "account/sendAddCreditsNudgeEmail": SendAddCreditsNudgeEmailResponse;
  "account/read": GetAccountResponse;
  "thread/turns/list": ThreadTurnsListResponse;
  "thread/turns/items/list": ThreadTurnsItemsListResponse;
  "thread/inject_items": ThreadInjectItemsResponse;
};

export type CodexOfficialRpcMethod = ClientRequest["method"];
export type UnsupportedLegacyCodexRpcMethod =
  | "fuzzyFileSearch"
  | "fuzzyFileSearch/sessionStart"
  | "fuzzyFileSearch/sessionUpdate"
  | "fuzzyFileSearch/sessionStop"
  | "getConversationSummary"
  | "gitDiffToRemote"
  | "getAuthStatus";
export type CodexRpcMethod = Exclude<CodexOfficialRpcMethod, UnsupportedLegacyCodexRpcMethod>;
export type CodexClientNotificationMethod = ClientNotification["method"];
export type CodexServerRequestMethod = ServerRequest["method"];
export type CodexServerNotificationMethod = ServerNotification["method"];
export type OfficialCodexServerRequest = ServerRequest;
export type OfficialCodexServerNotification = ServerNotification;
export type CodexServerRequestMessage = { kind: "request" } & ServerRequest;
export type CodexServerNotificationMessage = { kind: "notification" } & ServerNotification;

type MissingCodexRpcResultMethods = Exclude<CodexRpcMethod, keyof SupportedCodexRpcResultMap>;
type ExtraCodexRpcResultMethods = Exclude<keyof SupportedCodexRpcResultMap, CodexRpcMethod>;
type UnknownUnsupportedLegacyCodexRpcMethods = Exclude<UnsupportedLegacyCodexRpcMethod, CodexOfficialRpcMethod>;
type _AssertNoMissingCodexRpcResultMethods = AssertNever<MissingCodexRpcResultMethods>;
type _AssertNoExtraCodexRpcResultMethods = AssertNever<ExtraCodexRpcResultMethods>;
type _AssertNoUnknownUnsupportedLegacyCodexRpcMethods = AssertNever<UnknownUnsupportedLegacyCodexRpcMethods>;

export type CodexRpcParams<M extends CodexRpcMethod> = M extends CodexRpcMethod
  ? Extract<ClientRequest, { method: M }> extends { params: infer P }
    ? P
    : undefined
  : unknown;

export type CodexRpcResult<M extends CodexRpcMethod> = M extends keyof SupportedCodexRpcResultMap
  ? SupportedCodexRpcResultMap[M]
  : unknown;

export type CodexNotifyParams<M extends string> = M extends ClientNotification["method"]
  ? Extract<ClientNotification, { method: M }> extends { params: infer P }
    ? P
    : undefined
  : unknown;

export type CodexRpcArgs<M extends CodexRpcMethod = CodexRpcMethod> =
  CodexRpcParams<M> extends undefined
    ? { serverId: string; method: M; params?: undefined }
    : { serverId: string; method: M; params: CodexRpcParams<M> };

export type CodexRpcResponse<M extends CodexRpcMethod = CodexRpcMethod> = {
  result: CodexRpcResult<M>;
};

export type CodexNotifyArgs<M extends string = string> =
  CodexNotifyParams<M> extends undefined
    ? { serverId: string; method: M; params?: undefined }
    : { serverId: string; method: M; params: CodexNotifyParams<M> };

export type CodexLocalEvent =
  | { kind: "local"; method: "codex/exit"; params: { code: number | null; signal: string | null; expected: boolean } }
  | { kind: "local"; method: "codex/stderr"; params: { text: string } }
  | { kind: "local"; method: "codex/parseError"; params: { line: string } }
  | { kind: "local"; method: "codex/unmatchedResponse"; params: CodexJsonRpcResponse }
  | { kind: "local"; method: "codex/protocolError"; params: { reason: string; message: unknown } };

export type CodexJsonRpcResponse = {
  id: JsonRpcId;
  result?: unknown;
  error?: unknown;
};

export type CodexJsonRpcResponseMessage = { kind: "response" } & CodexJsonRpcResponse;

export type CodexIncomingMessage =
  | CodexServerNotificationMessage
  | CodexServerRequestMessage
  | CodexJsonRpcResponseMessage
  | CodexLocalEvent;

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function isCodexServerNotificationMessage(value: unknown): value is CodexServerNotificationMessage {
  const record = toRecord(value);
  return record?.kind === "notification" && typeof record.method === "string";
}

export function isCodexServerRequestMessage(value: unknown): value is CodexServerRequestMessage {
  const record = toRecord(value);
  return record?.kind === "request" && typeof record.method === "string";
}

export function isCodexJsonRpcResponseMessage(value: unknown): value is CodexJsonRpcResponseMessage {
  const record = toRecord(value);
  return record?.kind === "response" && (typeof record.id === "string" || typeof record.id === "number");
}

export function isCodexLocalEventMessage(value: unknown): value is CodexLocalEvent {
  const record = toRecord(value);
  return record?.kind === "local" && typeof record.method === "string";
}
