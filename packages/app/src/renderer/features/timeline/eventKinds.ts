import type { TimelineEventItem } from "../../domain/types";

export function isLocalUserEvent(event: TimelineEventItem) {
  return event.localKind === "user" || event.method === "user";
}

export function isLocalThinkingEvent(event: TimelineEventItem) {
  return event.localKind === "thinking" || event.method === "local/thinking";
}

export function isReasoningStreamEvent(event: TimelineEventItem) {
  return event.method === "item/reasoning/summaryTextDelta";
}

export function isMarkdownEvent(event: TimelineEventItem) {
  return (
    event.method === "item/agentMessage/delta" ||
    event.method === "item/plan/delta" ||
    event.method === "item/reasoning/summaryTextDelta"
  );
}
