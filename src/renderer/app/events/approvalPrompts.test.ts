import { describe, expect, it } from "vitest";
import type { AppServerRequest } from "./requestHandlers";
import { buildApprovalPromptFromRequest } from "./approvalPrompts";

describe("approval prompt interop", () => {
  it("normalizes legacy applyPatchApproval into a queued approval prompt", () => {
    const request = {
      kind: "request",
      method: "applyPatchApproval",
      id: "approval-1",
      params: {
        conversationId: "thread-1",
        callId: "patch-call-1",
        fileChanges: {
          "src/example.ts": {
            type: "update",
            unified_diff: "@@ -1 +1 @@\n-old\n+new",
            move_path: null,
          },
        },
        reason: "需要写入工作区",
        grantRoot: "D:\\Desktop\\codex\\electron",
      },
    } as AppServerRequest;

    const prompt = buildApprovalPromptFromRequest(request, "server-1", "pretty-json", 1234);

    expect(prompt).toMatchObject({
      kind: "applyPatch",
      serverId: "server-1",
      requestId: "approval-1",
      method: "applyPatchApproval",
      threadId: "thread-1",
      turnId: null,
      itemId: "patch-call-1",
      createdAt: 1234,
      paramsText: "pretty-json",
    });
    expect(prompt?.params).toBe(request.params);
  });

  it("maps all supported approval request methods to queue prompt kinds", () => {
    const cases: Array<{ request: AppServerRequest; kind: string; threadId: string; turnId: string | null; itemId: string | null }> = [
      {
        request: {
          kind: "request",
          method: "item/fileChange/requestApproval",
          id: "file-change",
          params: { threadId: "thread-a", turnId: "turn-a", itemId: "item-a", reason: null, grantRoot: null },
        } as AppServerRequest,
        kind: "fileChange",
        threadId: "thread-a",
        turnId: "turn-a",
        itemId: "item-a",
      },
      {
        request: {
          kind: "request",
          method: "item/commandExecution/requestApproval",
          id: "command-execution",
          params: { threadId: "thread-b", turnId: "turn-b", itemId: "item-b", command: "pnpm test" },
        } as AppServerRequest,
        kind: "commandExecution",
        threadId: "thread-b",
        turnId: "turn-b",
        itemId: "item-b",
      },
      {
        request: {
          kind: "request",
          method: "item/permissions/requestApproval",
          id: "permissions",
          params: { threadId: "thread-c", turnId: "turn-c", itemId: "item-c", cwd: "D:\\repo", reason: null, permissions: {} },
        } as AppServerRequest,
        kind: "permissions",
        threadId: "thread-c",
        turnId: "turn-c",
        itemId: "item-c",
      },
      {
        request: {
          kind: "request",
          method: "execCommandApproval",
          id: "exec-command",
          params: {
            conversationId: "thread-d",
            callId: "call-d",
            approvalId: null,
            command: ["pnpm", "test"],
            cwd: "D:\\repo",
            reason: null,
            parsedCmd: [],
          },
        } as AppServerRequest,
        kind: "execCommand",
        threadId: "thread-d",
        turnId: null,
        itemId: "call-d",
      },
    ];

    for (const item of cases) {
      const prompt = buildApprovalPromptFromRequest(item.request, "server-1", "{}", 1);
      expect(prompt).toMatchObject({
        kind: item.kind,
        threadId: item.threadId,
        turnId: item.turnId,
        itemId: item.itemId,
      });
    }
  });
});
