import { describe, expect, test } from "vitest";
import { buildNewThreadComposeSeed } from "./newThreadComposeSeed";

describe("new thread compose seed", () => {
  test("preserves runtime model when sending from empty state", () => {
    expect(
      buildNewThreadComposeSeed({
        previousThreadId: "",
        runtime: {
          composeMode: "default",
          model: "gpt-5.3-codex-spark",
          reasoningEffort: "xhigh",
          reasoningSummary: "none",
          sandboxMode: "read-only",
        },
        global: {
          model: "gpt-5.2",
          reasoningEffort: "high",
          reasoningSummary: "auto",
          sandboxMode: "danger-full-access",
        },
      })
    ).toEqual({
      composeMode: "default",
      model: "gpt-5.3-codex-spark",
      reasoningEffort: "xhigh",
      reasoningSummary: "none",
      sandboxMode: "read-only",
    });
  });

  test("uses global defaults when creating from an existing thread", () => {
    expect(
      buildNewThreadComposeSeed({
        previousThreadId: "thread-1",
        runtime: {
          composeMode: "plan",
          model: "gpt-5.3-codex-spark",
          reasoningEffort: "xhigh",
          reasoningSummary: "none",
          sandboxMode: "read-only",
        },
        global: {
          model: "gpt-5.2",
          reasoningEffort: "high",
          reasoningSummary: "auto",
          sandboxMode: "danger-full-access",
        },
      })
    ).toEqual({
      composeMode: "plan",
      model: "gpt-5.2",
      reasoningEffort: "high",
      reasoningSummary: "auto",
      sandboxMode: "danger-full-access",
    });
  });
});
