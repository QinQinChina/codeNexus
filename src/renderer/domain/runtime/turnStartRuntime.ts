import { codexDesktop } from "../../api/codexDesktopClient";
import { sandboxPolicyFromUi } from "../../shared/sandboxPolicy";
import { showToast } from "../../ui/toast";
import type { TurnStartParams } from "../../../generated/codex-app-server/v2/TurnStartParams";
import type { UserInput as CodexUserInput } from "../../../generated/codex-app-server/v2/UserInput";
import type { UserTurnInput } from "../types";
import {
  normalizeApprovalPolicy,
  normalizeApprovalsReviewer,
  normalizeEffort,
  normalizeModelName,
  normalizeReasoningSummary,
  normalizeSandboxMode,
} from "../serverInterop";

type ComposeMode = "default" | "plan";

type JsonRpcErrorLike = {
  code: number;
  message: string;
};

export type TurnStartRuntimeDeps = {
  getServerExperimentalApi: (serverId: string) => boolean;
  setServerExperimentalApi: (serverId: string, enabled: boolean) => void;
  getComposeMode: () => ComposeMode;
  setComposeMode: (mode: ComposeMode) => void;
  getAssistantFinalMessageFormat: () => string;
  setAssistantFinalMessageFormat: (format: "markdown") => void;
  getModel: () => string;
  getReasoningEffort: () => string;
  getReasoningSummary: () => string;
  getSandboxMode: () => string;
  getApprovalPolicy: () => string;
  getApprovalsReviewer: () => unknown;
  toCodexUserInputs: (values: UserTurnInput[]) => CodexUserInput[];
  parseJsonRpcError: (error: unknown) => JsonRpcErrorLike | null;
  warnExperimentalApiUnavailableOnce: (detail: string) => void;
};

export type TurnStartRuntime = {
  startTurnWithInput: (params: {
    threadId: string;
    threadWorkspace: string;
    threadServerId: string;
    input: UserTurnInput[];
    model?: string;
    effort?: string;
    summary?: string;
    approvalPolicy?: string;
    approvalsReviewer?: TurnStartParams["approvalsReviewer"];
    sandboxMode?: string;
    composeModeOverride?: ComposeMode;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

function isExperimentalApiCapabilityError(error: unknown): boolean {
  const msg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  const normalized = msg.toLowerCase();
  return (
    normalized.includes("requires experimentalapi capability") || normalized.includes("experimentalapi capability")
  );
}

export function createTurnStartRuntime(deps: TurnStartRuntimeDeps): TurnStartRuntime {
  const isOutputSchemaUnsupportedError = (error: unknown): boolean => {
    const rpcErr = deps.parseJsonRpcError(error);
    const msg = rpcErr?.message
      ? String(rpcErr.message ?? "")
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error ?? "");
    const normalized = msg.toLowerCase();
    return normalized.includes("outputschema") || normalized.includes("output_schema");
  };

  const startTurnWithInput: TurnStartRuntime["startTurnWithInput"] = async (params) => {
    const hasExperimentalApi = deps.getServerExperimentalApi(params.threadServerId);
    const composeMode = params.composeModeOverride ?? deps.getComposeMode();
    const wantsPlan = composeMode === "plan";
    const wantsStructuredFinalAnswer = !wantsPlan && deps.getAssistantFinalMessageFormat() === "structured-json-v1";
    const requestedModel = normalizeModelName(params.model ?? deps.getModel());
    const requestedEffort = normalizeEffort(params.effort ?? deps.getReasoningEffort());
    const requestedSummary = normalizeReasoningSummary(params.summary ?? deps.getReasoningSummary());
    const hasApprovalPolicyOverride = String(params.approvalPolicy ?? "").trim().length > 0;
    const requestedApprovalPolicy = normalizeApprovalPolicy(
      hasApprovalPolicyOverride ? params.approvalPolicy : deps.getApprovalPolicy()
    );
    const hasApprovalsReviewerOverride = params.approvalsReviewer != null;
    const requestedApprovalsReviewer = hasApprovalsReviewerOverride
      ? normalizeApprovalsReviewer(params.approvalsReviewer)
      : normalizeApprovalsReviewer(deps.getApprovalsReviewer());
    const requestedSandboxMode = normalizeSandboxMode(params.sandboxMode ?? deps.getSandboxMode());

    // collaborationMode 会影响“本回合及后续回合”的行为，因此即使切回 Agent 也要显式发送 default。
    const shouldSendCollaborationMode = hasExperimentalApi;
    const collaborationMode = shouldSendCollaborationMode
      ? {
          mode: composeMode,
          settings: {
            model: requestedModel,
            reasoning_effort: requestedEffort,
            developer_instructions: null,
          },
        }
      : null;

    const structuredFinalAnswerOutputSchema = wantsStructuredFinalAnswer
      ? (await import("../structuredFinalAnswer")).STRUCTURED_FINAL_ANSWER_OUTPUT_SCHEMA_V1
      : null;

    const buildTurnStartParams = (options?: { omitOutputSchema?: boolean }): TurnStartParams => {
      const sandboxPolicy = sandboxPolicyFromUi(requestedSandboxMode, params.threadWorkspace, "camel");
      const input = deps.toCodexUserInputs(params.input);
      return {
        threadId: params.threadId,
        input,
        cwd: params.threadWorkspace,
        approvalPolicy: requestedApprovalPolicy as TurnStartParams["approvalPolicy"],
        approvalsReviewer: requestedApprovalsReviewer as TurnStartParams["approvalsReviewer"],
        sandboxPolicy: sandboxPolicy as TurnStartParams["sandboxPolicy"],
        model: requestedModel,
        effort: requestedEffort,
        ...(requestedSummary !== "auto" ? { summary: requestedSummary } : {}),
        ...(structuredFinalAnswerOutputSchema && !options?.omitOutputSchema
          ? { outputSchema: structuredFinalAnswerOutputSchema }
          : {}),
      };
    };

    let includeCollaborationMode = shouldSendCollaborationMode;
    let includeOutputSchema = wantsStructuredFinalAnswer;
    let collaborationModeFallbackAttempted = false;
    let outputSchemaFallbackAttempted = false;

    for (let attemptIndex = 0; attemptIndex < 3; attemptIndex += 1) {
      try {
        const baseParams = buildTurnStartParams({ omitOutputSchema: !includeOutputSchema });
        await codexDesktop.codexServer.rpc({
          serverId: params.threadServerId,
          method: "turn/start",
          params: includeCollaborationMode ? { ...baseParams, collaborationMode } : baseParams,
        });
        return { ok: true as const };
      } catch (error: any) {
        if (
          includeCollaborationMode &&
          !collaborationModeFallbackAttempted &&
          isExperimentalApiCapabilityError(error)
        ) {
          collaborationModeFallbackAttempted = true;
          includeCollaborationMode = false;
          deps.setServerExperimentalApi(params.threadServerId, false);
          if (wantsPlan) {
            deps.setComposeMode("default");
            deps.warnExperimentalApiUnavailableOnce(
              "当前 Codex 服务不支持 Plan（experimentalApi 未启用），已自动切回 Agent 模式。建议升级 codex。"
            );
          } else {
            deps.warnExperimentalApiUnavailableOnce(
              "当前 Codex 服务未启用 experimentalApi，部分高级能力将自动降级，建议升级 codex。"
            );
          }
          continue;
        }

        if (includeOutputSchema && !outputSchemaFallbackAttempted && isOutputSchemaUnsupportedError(error)) {
          outputSchemaFallbackAttempted = true;
          includeOutputSchema = false;
          deps.setAssistantFinalMessageFormat("markdown");
          showToast({
            kind: "warn",
            title: "结构化输出不可用",
            message: "当前服务不支持 outputSchema，已自动切回 Markdown 输出。",
          });
          continue;
        }

        const msg = error?.message ? String(error.message) : String(error);
        return { ok: false as const, error: msg || "turn/start failed" };
      }
    }

    return { ok: false as const, error: "turn/start failed" };
  };

  return { startTurnWithInput };
}
