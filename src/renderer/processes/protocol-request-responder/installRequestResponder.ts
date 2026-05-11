import type { Pinia } from "pinia";
import { codexDesktop } from "../../api/codexDesktopClient";
import {
  buildAuthRefreshNotImplementedError,
  buildInvalidUserInputPayloadError,
  buildRequestMethodNotImplementedError,
  classifyServerRequest,
  getServerRequestThreadId,
  isServerRequest,
  respondRequestError,
} from "../../app/events/requestHandlers";
import { buildApprovalPromptFromRequest } from "../../app/events/approvalPrompts";
import { useTimelineStore } from "../../stores/timeline.store";
import { useUserInputStore } from "../../stores/userInput.store";
import { useApprovalStore } from "../../stores/approval.store";
import { normalizeUserInputPrompt } from "../../domain/userInputInterop";
import { safeJsonStringify } from "../../utils/safeJson";
import { isCodexServerRequestMessage } from "../../../shared/codex-protocol";
import {
  IMAGE_GENERATION_DYNAMIC_TOOL_NAME,
  IMAGE_GENERATION_DYNAMIC_TOOL_NAMESPACE,
} from "../../../shared/dynamicTools";
import type { DynamicToolCallParams } from "../../../generated/codex-app-server/v2/DynamicToolCallParams";
import type { DynamicToolCallResponse } from "../../../generated/codex-app-server/v2/DynamicToolCallResponse";

function toPrettyJson(value: unknown): string {
  return safeJsonStringify(value ?? {}, { space: 2 });
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function toIntegerInRange(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  return Math.max(min, Math.min(max, rounded));
}

function normalizeImageToolCallParams(value: unknown): DynamicToolCallParams | null {
  const params = toRecord(value);
  const threadId = toNullableText(params.threadId);
  const turnId = toNullableText(params.turnId);
  const callId = toNullableText(params.callId);
  const tool = toNullableText(params.tool);
  if (!threadId || !turnId || !callId || !tool) return null;
  return {
    threadId,
    turnId,
    callId,
    namespace: toNullableText(params.namespace),
    tool,
    arguments: (params.arguments ?? {}) as DynamicToolCallParams["arguments"],
  };
}

function buildImageGenerationEventId(params: DynamicToolCallParams): string {
  return `local:imageGeneration:${params.threadId}:${params.turnId}:${params.callId}`;
}

function buildImageGenerationItem(
  params: DynamicToolCallParams,
  status: string,
  extra?: { savedPaths?: string[]; revisedPrompt?: string | null; errorText?: string }
) {
  return {
    type: "imageGeneration",
    id: params.callId,
    status,
    revisedPrompt: extra?.revisedPrompt ?? null,
    result: "",
    savedPath: extra?.savedPaths?.[0] ?? "",
    savedPaths: extra?.savedPaths ?? [],
    errorText: extra?.errorText ?? "",
  };
}

function upsertImageGenerationEvent(
  timelineStore: ReturnType<typeof useTimelineStore>,
  params: DynamicToolCallParams,
  method: "item/started" | "item/completed",
  status: string,
  paramsText: string,
  extra?: { savedPaths?: string[]; revisedPrompt?: string | null; errorText?: string; level?: "info" | "error" }
) {
  timelineStore.upsertEvent({
    threadId: params.threadId,
    id: buildImageGenerationEventId(params),
    method,
    paramsText,
    params: {
      threadId: params.threadId,
      turnId: params.turnId,
      item: buildImageGenerationItem(params, status, extra),
    },
    turnId: params.turnId,
    level: extra?.level ?? "info",
  });
}

function buildFailedToolResponse(message: string): DynamicToolCallResponse {
  return {
    success: false,
    contentItems: [{ type: "inputText", text: message }],
  };
}

function normalizeToolCallArguments(params: DynamicToolCallParams) {
  const args = toRecord(params.arguments);
  return {
    prompt: toNullableText(args.prompt) ?? "",
    size: toNullableText(args.size),
    quality: toNullableText(args.quality),
    outputFormat: toNullableText(args.output_format ?? args.outputFormat),
    n: toIntegerInRange(args.n, 1, 1, 4),
  };
}

function isCodeNexusImageGenerationTool(params: DynamicToolCallParams): boolean {
  return (
    params.namespace === IMAGE_GENERATION_DYNAMIC_TOOL_NAMESPACE && params.tool === IMAGE_GENERATION_DYNAMIC_TOOL_NAME
  );
}

async function playPlanQnaNotificationSoundTwiceLazy() {
  const { playPlanQnaNotificationSoundTwice } = await import("../../features/notificationSound/player");
  await playPlanQnaNotificationSoundTwice();
}

export function installRequestResponder(pinia: Pinia) {
  const timelineStore = useTimelineStore(pinia);
  const userInputStore = useUserInputStore(pinia);
  const approvalStore = useApprovalStore(pinia);

  const unsubscribe = codexDesktop.codexServer.onEvent((payload) => {
    const msg = payload?.msg;
    if (!isCodexServerRequestMessage(msg)) return;
    if (!isServerRequest(msg)) {
      console.warn("[requestResponder] ignore invalid server request shape", msg);
      return;
    }

    const handling = classifyServerRequest(msg.method);
    const threadId = getServerRequestThreadId(msg) || "__app__";
    const paramsText = toPrettyJson(msg.params ?? {});

    if (handling.kind === "approval") {
      const method = String(msg.method ?? "").trim();
      const serverId = String(payload.serverId ?? "").trim();
      const prompt = buildApprovalPromptFromRequest(msg, serverId, paramsText);
      if (!serverId || !prompt) {
        timelineStore.appendEvent({
          threadId,
          method,
          paramsText: `${paramsText}\n[approval] invalid approval request`,
          params: msg.params,
          level: "error",
        });
        return;
      }

      approvalStore.enqueue(prompt);
      timelineStore.appendEvent({
        threadId: prompt.threadId || threadId,
        method,
        paramsText: `${paramsText}\n[approval] queued`,
        params: msg.params,
        level: "warn",
      });
      return;
    }

    if (handling.kind === "toolCall") {
      const toolParams = normalizeImageToolCallParams(msg.params);
      if (!toolParams || !isCodeNexusImageGenerationTool(toolParams)) {
        void codexDesktop.codexServer.respond(
          respondRequestError(payload.serverId, msg.id, buildRequestMethodNotImplementedError(msg.method))
        );
        timelineStore.appendEvent({
          threadId,
          method: msg.method,
          paramsText,
          params: msg.params,
          level: "error",
        });
        return;
      }

      void (async () => {
        const args = normalizeToolCallArguments(toolParams);
        upsertImageGenerationEvent(
          timelineStore,
          toolParams,
          "item/started",
          "running",
          args.prompt ? `prompt=${args.prompt}` : "prompt=<empty>"
        );

        try {
          if (!args.prompt) throw new Error("图片生成提示词不能为空。");
          const result = await codexDesktop.app.generateImage({
            threadId: toolParams.threadId,
            turnId: toolParams.turnId,
            callId: toolParams.callId,
            prompt: args.prompt,
            size: args.size,
            quality: args.quality,
            outputFormat: args.outputFormat,
            n: args.n,
          });
          const savedPaths = result.images.map((image) => image.path).filter(Boolean);
          const revisedPrompt = result.revisedPrompt ?? null;
          upsertImageGenerationEvent(
            timelineStore,
            toolParams,
            "item/completed",
            "completed",
            [`status=completed`, ...savedPaths.map((path, index) => `savedPath[${index + 1}]=${path}`)].join("\n"),
            { savedPaths, revisedPrompt }
          );
          await codexDesktop.codexServer.respond({
            serverId: payload.serverId,
            id: msg.id,
            result: {
              success: true,
              contentItems: [
                {
                  type: "inputText",
                  text: `Image generated and saved locally: ${savedPaths.join(", ")}`,
                },
                ...result.images.map((image) => ({ type: "inputImage" as const, imageUrl: image.dataUrl })),
              ],
            } satisfies DynamicToolCallResponse,
          });
        } catch (error: any) {
          const message = String(error?.message ?? error ?? "图片生成失败");
          upsertImageGenerationEvent(
            timelineStore,
            toolParams,
            "item/completed",
            `failed: ${message}`,
            message,
            { errorText: message, level: "error" }
          );
          await codexDesktop.codexServer.respond({
            serverId: payload.serverId,
            id: msg.id,
            result: buildFailedToolResponse(message),
          });
        }
      })();
      return;
    }

    if (handling.kind === "authRefresh") {
      void codexDesktop.codexServer.respond(
        respondRequestError(payload.serverId, msg.id, buildAuthRefreshNotImplementedError(msg.method))
      );
      timelineStore.appendEvent({
        threadId,
        method: msg.method,
        paramsText,
        params: msg.params,
        level: "error",
      });
      return;
    }

    if (handling.kind === "userInput") {
      const prompt = normalizeUserInputPrompt(msg, payload.serverId);
      if (!prompt) {
        void codexDesktop.codexServer.respond(
          respondRequestError(payload.serverId, msg.id, buildInvalidUserInputPayloadError(msg.method))
        );
        timelineStore.appendEvent({
          threadId,
          method: msg.method,
          paramsText,
          params: msg.params,
          level: "error",
        });
        return;
      }
      const resolvedThreadId = String(prompt.threadId || threadId).trim();
      if (!resolvedThreadId) return;
      const hadPendingUserInput = userInputStore.queueSizeForThread(resolvedThreadId) > 0;
      userInputStore.enqueuePrompt(
        resolvedThreadId === String(prompt.threadId ?? "").trim() ? prompt : { ...prompt, threadId: resolvedThreadId },
        { threadIdFallback: resolvedThreadId }
      );
      if (!hadPendingUserInput && userInputStore.queueSizeForThread(resolvedThreadId) > 0) {
        void playPlanQnaNotificationSoundTwiceLazy();
      }
      timelineStore.appendEvent({
        threadId: resolvedThreadId,
        method: msg.method,
        paramsText,
        params: msg.params,
      });
      return;
    }

    void codexDesktop.codexServer.respond(
      respondRequestError(payload.serverId, msg.id, buildRequestMethodNotImplementedError(msg.method))
    );
    timelineStore.appendEvent({
      threadId,
      method: msg.method,
      paramsText,
      params: msg.params,
      level: "error",
    });
  });
  return () => {
    unsubscribe();
  };
}
