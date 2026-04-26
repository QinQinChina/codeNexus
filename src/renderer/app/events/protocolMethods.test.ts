import { describe, expect, it } from "vitest";
import { classifyServerRequest, isServerRequest } from "./requestHandlers";
import { isServerNotificationMethod } from "./protocolMethods";

describe("Codex 0.124 protocol methods", () => {
  it("accepts new 0.124 server notifications needed for compatibility", () => {
    expect(isServerNotificationMethod("item/fileChange/patchUpdated")).toBe(true);
    expect(isServerNotificationMethod("externalAgentConfig/import/completed")).toBe(true);
    expect(isServerNotificationMethod("model/verification")).toBe(true);
    expect(isServerNotificationMethod("warning")).toBe(true);
    expect(isServerNotificationMethod("guardianWarning")).toBe(true);
    expect(isServerNotificationMethod("thread/realtime/transcript/done")).toBe(true);
  });

  it("keeps current 0.124 server requests recognized and classified safely", () => {
    const request = {
      kind: "request",
      method: "item/tool/call",
      id: "request-1",
      params: { threadId: "thread-1", turnId: "turn-1", callId: "call-1" },
    };

    expect(isServerRequest(request)).toBe(true);
    expect(classifyServerRequest("item/tool/call").kind).toBe("toolCall");
  });
});
