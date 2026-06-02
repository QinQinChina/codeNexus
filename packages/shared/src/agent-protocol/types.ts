export const AGENT_PROTOCOL_VERSION = "codenexus.agent.v1" as const;

export type AgentProtocolVersion = typeof AGENT_PROTOCOL_VERSION;

export type AgentRuntimeKind = "codex" | "openai-compatible" | "claude" | "internal";

export type AgentEventType =
  | "agent/threadStarted"
  | "agent/threadUpdated"
  | "agent/threadClosed"
  | "agent/turnStarted"
  | "agent/turnCompleted"
  | "agent/turnFailed"
  | "agent/turnInterrupted"
  | "agent/messageStarted"
  | "agent/messageDelta"
  | "agent/messageCompleted"
  | "agent/reasoningDelta"
  | "agent/reasoningSummaryDelta"
  | "agent/planUpdated"
  | "agent/toolStarted"
  | "agent/toolDelta"
  | "agent/toolCompleted"
  | "agent/toolFailed"
  | "agent/fileChangeStarted"
  | "agent/fileChangeDelta"
  | "agent/fileChangeSnapshot"
  | "agent/fileChangeCompleted"
  | "agent/turnDiffUpdated"
  | "agent/commandStarted"
  | "agent/commandOutputDelta"
  | "agent/commandCompleted"
  | "agent/commandUpdated"
  | "agent/approvalResolved"
  | "agent/filesChanged"
  | "agent/runtimeWarning"
  | "agent/runtimeError"
  | "agent/runtimeStatusChanged";

export type AgentRequestType = "agent/approvalRequested" | "agent/userInputRequested";

export type AgentApprovalKind = "fileChange" | "command" | "permission" | "userInput";

export type AgentRuntimeCapabilities = {
  commandExecution: boolean;
  fileChanges: boolean;
  mcp: boolean;
  rollback: boolean;
  streamingPatch: boolean;
};

export type AgentEventBase<T extends AgentEventType = AgentEventType> = {
  protocol: AgentProtocolVersion;
  kind: "event";
  type: T;
  runtimeId: string;
  createdAt: number;
  eventId?: string;
  threadId?: string;
  turnId?: string;
  itemId?: string;
  source?: AgentRuntimeKind;
};

export type AgentDeltaEvent = AgentEventBase<
  | "agent/messageDelta"
  | "agent/reasoningDelta"
  | "agent/reasoningSummaryDelta"
  | "agent/toolDelta"
  | "agent/fileChangeDelta"
  | "agent/commandOutputDelta"
> & {
  delta: string;
};

export type AgentFileChangeSnapshotEvent = AgentEventBase<"agent/fileChangeSnapshot"> & {
  changes: Array<{
    path: string;
    kind: "add" | "delete" | "update";
    diff: string;
    movePath?: string | null;
  }>;
};

export type AgentTurnDiffUpdatedEvent = AgentEventBase<"agent/turnDiffUpdated"> & {
  diff: string;
};

export type AgentRuntimeNoticeEvent = AgentEventBase<"agent/runtimeWarning" | "agent/runtimeError"> & {
  message: string;
};

export type AgentGenericEvent = AgentEventBase<
  Exclude<
    AgentEventType,
    AgentDeltaEvent["type"] | "agent/fileChangeSnapshot" | "agent/turnDiffUpdated" | AgentRuntimeNoticeEvent["type"]
  >
>;

export type AgentEvent =
  | AgentDeltaEvent
  | AgentFileChangeSnapshotEvent
  | AgentTurnDiffUpdatedEvent
  | AgentRuntimeNoticeEvent
  | AgentGenericEvent;

export type AgentRequestBase<T extends AgentRequestType = AgentRequestType> = {
  protocol: AgentProtocolVersion;
  kind: "request";
  type: T;
  requestId: string;
  runtimeId: string;
  createdAt: number;
  threadId?: string;
  turnId?: string;
  itemId?: string;
};

export type AgentApprovalRequest = AgentRequestBase<"agent/approvalRequested"> & {
  approvalKind: AgentApprovalKind;
  title: string;
  body: string;
};

export type AgentUserInputRequest = AgentRequestBase<"agent/userInputRequested"> & {
  prompt: string;
};

export type AgentRequest = AgentApprovalRequest | AgentUserInputRequest;

export const AGENT_EVENT_TYPES = [
  "agent/threadStarted",
  "agent/threadUpdated",
  "agent/threadClosed",
  "agent/turnStarted",
  "agent/turnCompleted",
  "agent/turnFailed",
  "agent/turnInterrupted",
  "agent/messageStarted",
  "agent/messageDelta",
  "agent/messageCompleted",
  "agent/reasoningDelta",
  "agent/reasoningSummaryDelta",
  "agent/planUpdated",
  "agent/toolStarted",
  "agent/toolDelta",
  "agent/toolCompleted",
  "agent/toolFailed",
  "agent/fileChangeStarted",
  "agent/fileChangeDelta",
  "agent/fileChangeSnapshot",
  "agent/fileChangeCompleted",
  "agent/turnDiffUpdated",
  "agent/commandStarted",
  "agent/commandOutputDelta",
  "agent/commandCompleted",
  "agent/commandUpdated",
  "agent/approvalResolved",
  "agent/filesChanged",
  "agent/runtimeWarning",
  "agent/runtimeError",
  "agent/runtimeStatusChanged",
] as const satisfies readonly AgentEventType[];

export const AGENT_REQUEST_TYPES = [
  "agent/approvalRequested",
  "agent/userInputRequested",
] as const satisfies readonly AgentRequestType[];

const AGENT_EVENT_TYPE_SET = new Set<string>(AGENT_EVENT_TYPES);
const AGENT_REQUEST_TYPE_SET = new Set<string>(AGENT_REQUEST_TYPES);
const DELTA_EVENT_TYPE_SET = new Set<string>([
  "agent/messageDelta",
  "agent/reasoningDelta",
  "agent/reasoningSummaryDelta",
  "agent/toolDelta",
  "agent/fileChangeDelta",
  "agent/commandOutputDelta",
]);
const APPROVAL_KIND_SET = new Set<string>(["fileChange", "command", "permission", "userInput"]);

export function createDefaultAgentRuntimeCapabilities(): AgentRuntimeCapabilities {
  return {
    commandExecution: false,
    fileChanges: false,
    mcp: false,
    rollback: false,
    streamingPatch: false,
  };
}

export function isAgentEvent(value: unknown): value is AgentEvent {
  const record = toRecord(value);
  if (!record) return false;
  if (record.protocol !== AGENT_PROTOCOL_VERSION) return false;
  if (record.kind !== "event") return false;
  if (!isNonEmptyString(record.type) || !AGENT_EVENT_TYPE_SET.has(record.type)) return false;
  if (!isNonEmptyString(record.runtimeId)) return false;
  if (!isFiniteNumber(record.createdAt)) return false;
  if (DELTA_EVENT_TYPE_SET.has(record.type) && typeof record.delta !== "string") return false;
  if (record.type === "agent/fileChangeSnapshot" && !Array.isArray(record.changes)) return false;
  if (record.type === "agent/turnDiffUpdated" && typeof record.diff !== "string") return false;
  if (
    (record.type === "agent/runtimeWarning" || record.type === "agent/runtimeError") &&
    !isNonEmptyString(record.message)
  ) {
    return false;
  }
  return true;
}

export function isAgentRequest(value: unknown): value is AgentRequest {
  const record = toRecord(value);
  if (!record) return false;
  if (record.protocol !== AGENT_PROTOCOL_VERSION) return false;
  if (record.kind !== "request") return false;
  if (!isNonEmptyString(record.type) || !AGENT_REQUEST_TYPE_SET.has(record.type)) return false;
  if (!isNonEmptyString(record.requestId)) return false;
  if (!isNonEmptyString(record.runtimeId)) return false;
  if (!isFiniteNumber(record.createdAt)) return false;
  if (record.type === "agent/approvalRequested") {
    return (
      isNonEmptyString(record.approvalKind) &&
      APPROVAL_KIND_SET.has(record.approvalKind) &&
      isNonEmptyString(record.title) &&
      isNonEmptyString(record.body)
    );
  }
  if (record.type === "agent/userInputRequested") {
    return isNonEmptyString(record.prompt);
  }
  return false;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
