import type { ApprovalPrompt, ApprovalPromptKind } from "../../stores/approval.store";
import type { AppServerRequest } from "./requestHandlers";

const APPROVAL_KIND_BY_METHOD = {
  "item/fileChange/requestApproval": "fileChange",
  applyPatchApproval: "applyPatch",
  "item/commandExecution/requestApproval": "commandExecution",
  "item/permissions/requestApproval": "permissions",
  execCommandApproval: "execCommand",
} as const satisfies Record<ApprovalPrompt["method"], ApprovalPromptKind>;

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function approvalPromptKindForMethod(method: string): ApprovalPromptKind | null {
  return APPROVAL_KIND_BY_METHOD[method as ApprovalPrompt["method"]] ?? null;
}

export function buildApprovalPromptFromRequest(
  request: AppServerRequest,
  serverIdValue: string,
  paramsText: string,
  createdAt = Date.now()
): ApprovalPrompt | null {
  const method = toText(request?.method) as ApprovalPrompt["method"];
  const kind = approvalPromptKindForMethod(method);
  if (!kind) return null;

  const params = toRecord(request.params);
  const threadId = toText(params.threadId ?? params.conversationId) || "__app__";
  const turnId = toNullableText(params.turnId);
  const itemId = toNullableText(params.itemId ?? params.callId);

  return {
    kind,
    serverId: toText(serverIdValue),
    requestId: request.id,
    method,
    threadId,
    turnId,
    itemId,
    createdAt,
    params: request.params as ApprovalPrompt["params"],
    paramsText: String(paramsText ?? ""),
  } as ApprovalPrompt;
}
