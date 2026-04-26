import type {
  CodexServerNotificationMethod as OfficialServerNotificationMethod,
  CodexServerRequestMethod as OfficialServerRequestMethod,
} from "../../../shared/codex-protocol";

export type ServerRequestMethod = OfficialServerRequestMethod;
export type ServerNotificationMethod = OfficialServerNotificationMethod;

export const SERVER_REQUEST_METHODS: readonly ServerRequestMethod[] = [
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/tool/requestUserInput",
  "mcpServer/elicitation/request",
  "item/permissions/requestApproval",
  "item/tool/call",
  "account/chatgptAuthTokens/refresh",
  "applyPatchApproval",
  "execCommandApproval",
];

export const SERVER_NOTIFICATION_METHODS: readonly ServerNotificationMethod[] = [
  "error",
  "thread/started",
  "thread/status/changed",
  "thread/archived",
  "thread/unarchived",
  "thread/closed",
  "skills/changed",
  "thread/name/updated",
  "thread/tokenUsage/updated",
  "turn/started",
  "hook/started",
  "turn/completed",
  "hook/completed",
  "turn/diff/updated",
  "turn/plan/updated",
  "item/started",
  "item/autoApprovalReview/started",
  "item/autoApprovalReview/completed",
  "item/completed",
  "rawResponseItem/completed",
  "item/agentMessage/delta",
  "item/plan/delta",
  "command/exec/outputDelta",
  "item/commandExecution/outputDelta",
  "item/commandExecution/terminalInteraction",
  "item/fileChange/outputDelta",
  "item/fileChange/patchUpdated",
  "serverRequest/resolved",
  "item/mcpToolCall/progress",
  "mcpServer/oauthLogin/completed",
  "mcpServer/startupStatus/updated",
  "account/updated",
  "account/rateLimits/updated",
  "app/list/updated",
  "externalAgentConfig/import/completed",
  "fs/changed",
  "item/reasoning/summaryTextDelta",
  "item/reasoning/summaryPartAdded",
  "item/reasoning/textDelta",
  "thread/compacted",
  "model/rerouted",
  "model/verification",
  "warning",
  "guardianWarning",
  "deprecationNotice",
  "configWarning",
  "fuzzyFileSearch/sessionUpdated",
  "fuzzyFileSearch/sessionCompleted",
  "thread/realtime/started",
  "thread/realtime/itemAdded",
  "thread/realtime/transcript/delta",
  "thread/realtime/transcript/done",
  "thread/realtime/outputAudio/delta",
  "thread/realtime/sdp",
  "thread/realtime/error",
  "thread/realtime/closed",
  "windows/worldWritableWarning",
  "windowsSandbox/setupCompleted",
  "account/login/completed",
];

const SERVER_REQUEST_METHOD_SET = new Set<string>(SERVER_REQUEST_METHODS);
const SERVER_NOTIFICATION_METHOD_SET = new Set<string>(SERVER_NOTIFICATION_METHODS);

export function isServerRequestMethod(method: string): method is ServerRequestMethod {
  return SERVER_REQUEST_METHOD_SET.has(method);
}

export function isServerNotificationMethod(method: string): method is ServerNotificationMethod {
  return SERVER_NOTIFICATION_METHOD_SET.has(method);
}
