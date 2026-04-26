import { describe, expect, it } from "vitest";
import { resolveHistoryRewriteRollback } from "./historyRewriteRollback";

describe("history rewrite rollback", () => {
  it("rolls back the anchor turn and every completed turn after it", () => {
    expect(
      resolveHistoryRewriteRollback(
        [
          { turnId: "turn-1", diffText: "", completedAt: 1 },
          { turnId: "turn-2", diffText: "diff-2", completedAt: 2 },
          { turnId: "turn-3", diffText: "diff-3", completedAt: 3 },
        ],
        "turn-2"
      )
    ).toEqual({
      count: 2,
      turnIds: ["turn-2", "turn-3"],
      combinedDiff: "diff-3\n\ndiff-2",
    });
  });

  it("returns null when the anchor turn is not checkpointed", () => {
    expect(resolveHistoryRewriteRollback([{ turnId: "turn-1", diffText: "", completedAt: 1 }], "turn-x")).toBeNull();
  });
});
