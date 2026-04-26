import { describe, expect, it } from "vitest";
import type { TimelineEventItem } from "../../../domain/types";
import { buildTimelineRenderNodes } from "./buildTimelineNodes";

function event(overrides: Partial<TimelineEventItem>): TimelineEventItem {
  return {
    id: "event-1",
    method: "item/commandExecution/terminalInteraction",
    paramsText: "",
    createdAt: 100,
    level: "info",
    threadId: "thread-1",
    turnId: "turn-1",
    ...overrides,
  };
}

describe("stream notification visibility", () => {
  it("keeps fileChange output delta as a visible event node", () => {
    const nodes = buildTimelineRenderNodes({
      events: [
        event({
          method: "item/fileChange/outputDelta",
          paramsText: "Applying patch...",
          params: { threadId: "thread-1", turnId: "turn-1", itemId: "patch-1", delta: "Applying patch..." },
        }),
      ],
      timelineKey: "thread-1",
      workspaceRoot: "D:\\repo",
      debug: false,
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual(
      expect.objectContaining({ kind: "event", event: expect.objectContaining({ method: "item/fileChange/outputDelta" }) })
    );
  });

  it("merges terminal interaction into the command action output", () => {
    const nodes = buildTimelineRenderNodes({
      events: [
        event({
          id: "started",
          method: "item/started",
          createdAt: 90,
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            item: { type: "commandExecution", id: "cmd-1", status: "inProgress", command: "python app.py" },
          },
        }),
        event({
          id: "stdin",
          method: "item/commandExecution/terminalInteraction",
          createdAt: 100,
          params: { threadId: "thread-1", turnId: "turn-1", itemId: "cmd-1", processId: "p1", stdin: "y\n" },
          paramsText: "y\n",
        }),
      ],
      timelineKey: "thread-1",
      workspaceRoot: "D:\\repo",
      debug: false,
    });

    const commandNode = nodes.find((node) => node.kind === "commandAction");
    expect(commandNode?.item.item.outputFull).toContain("stdin");
    expect(commandNode?.item.item.outputFull).toContain("y");
  });
});
