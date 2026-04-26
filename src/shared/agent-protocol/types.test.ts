import { describe, expect, it } from "vitest";
import {
  AGENT_PROTOCOL_VERSION,
  createDefaultAgentRuntimeCapabilities,
  isAgentEvent,
  isAgentRequest,
} from "./types";

describe("CodeNexus agent protocol guards", () => {
  it("accepts a valid assistant message delta event", () => {
    const event = {
      protocol: AGENT_PROTOCOL_VERSION,
      kind: "event",
      type: "agent/messageDelta",
      runtimeId: "runtime-1",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "message-1",
      delta: "hello",
      createdAt: 1,
    };

    expect(isAgentEvent(event)).toBe(true);
  });

  it("rejects malformed or unknown events", () => {
    expect(isAgentEvent({ kind: "event", type: "agent/messageDelta" })).toBe(false);
    expect(
      isAgentEvent({
        protocol: AGENT_PROTOCOL_VERSION,
        kind: "event",
        type: "codex/item/fileChange/patchUpdated",
        runtimeId: "runtime-1",
        createdAt: 1,
      })
    ).toBe(false);
  });

  it("accepts a valid file-change approval request", () => {
    const request = {
      protocol: AGENT_PROTOCOL_VERSION,
      kind: "request",
      type: "agent/approvalRequested",
      requestId: "request-1",
      runtimeId: "runtime-1",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "file-change-1",
      approvalKind: "fileChange",
      title: "Apply file changes?",
      body: "1 file will be updated.",
      createdAt: 1,
    };

    expect(isAgentRequest(request)).toBe(true);
  });

  it("creates conservative runtime capabilities by default", () => {
    expect(createDefaultAgentRuntimeCapabilities()).toEqual({
      commandExecution: false,
      fileChanges: false,
      mcp: false,
      rollback: false,
      streamingPatch: false,
    });
  });
});
