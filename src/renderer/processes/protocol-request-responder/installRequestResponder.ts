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

function toPrettyJson(value: unknown): string {
  return safeJsonStringify(value ?? {}, { space: 2 });
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
      userInputStore.enqueuePrompt(
        resolvedThreadId === String(prompt.threadId ?? "").trim() ? prompt : { ...prompt, threadId: resolvedThreadId },
        { threadIdFallback: resolvedThreadId }
      );
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
