import { describe, expect, it } from "vitest";
import type { TimelineEventItem } from "../../../domain/types";
import { buildTimelineRenderNodes } from "./buildTimelineNodes";

function commandEvent(item: Record<string, unknown>): TimelineEventItem {
  return {
    id: "event-1",
    method: "item/completed",
    paramsText: JSON.stringify({ threadId: "thread-1", turnId: "turn-1", item }),
    params: { threadId: "thread-1", turnId: "turn-1", item },
    createdAt: 100,
    level: "info",
    threadId: "thread-1",
    turnId: "turn-1",
  } as TimelineEventItem;
}

function render(events: TimelineEventItem[]) {
  return buildTimelineRenderNodes({
    events,
    timelineKey: "thread-1",
    workspaceRoot: "D:\\repo",
    debug: false,
  });
}

describe("command visualization render nodes", () => {
  it("replaces a read command action with a read card node that counts output lines", () => {
    const nodes = render([
      commandEvent({
        id: "cmd-1",
        type: "commandExecution",
        status: "completed",
        command: "Get-Content -LiteralPath src\\app.ts",
        commandActions: [
          {
            type: "read",
            command: "Get-Content -LiteralPath src\\app.ts",
            name: "app.ts",
            path: "D:\\repo\\src\\app.ts",
          },
        ],
        aggregatedOutput: "alpha\nbeta\n",
        exitCode: 0,
        durationMs: 12,
      }),
    ]);

    expect(nodes.map((node) => node.kind)).toEqual(["commandRead"]);
    const node = nodes[0];
    expect(node.kind).toBe("commandRead");
    if (node.kind !== "commandRead") return;
    expect(node.item.path).toBe("src\\app.ts");
    expect(node.item.name).toBe("app.ts");
    expect(node.item.lineCount).toBe(2);
    expect(node.item.startLine).toBeNull();
    expect(node.item.endLine).toBeNull();
    expect(node.item.previewLines).toEqual(["alpha", "beta"]);
  });

  it("preserves explicit read line ranges for compact chat cards", () => {
    const nodes = render([
      commandEvent({
        id: "cmd-1",
        type: "commandExecution",
        status: "completed",
        command: "Get-Content -LiteralPath src\\app.ts",
        commandActions: [
          {
            type: "read",
            command: "Get-Content -LiteralPath src\\app.ts",
            name: "app.ts",
            path: "D:\\repo\\src\\app.ts",
            lineRange: "L10-42",
          },
        ],
        aggregatedOutput: "alpha\nbeta\n",
        exitCode: 0,
      }),
    ]);

    expect(nodes.map((node) => node.kind)).toEqual(["commandRead"]);
    const node = nodes[0];
    expect(node.kind).toBe("commandRead");
    if (node.kind !== "commandRead") return;
    expect(node.item.startLine).toBe(10);
    expect(node.item.endLine).toBe(42);
    expect(node.item.lineCount).toBe(2);
  });

  it("replaces a listFiles command action with a list card node", () => {
    const nodes = render([
      commandEvent({
        id: "cmd-1",
        type: "commandExecution",
        status: "completed",
        command: "rg --files src",
        commandActions: [{ type: "listFiles", command: "rg --files src", path: "src" }],
        aggregatedOutput: "src\\main.ts\nsrc\\App.vue\n",
        exitCode: 0,
      }),
    ]);

    expect(nodes.map((node) => node.kind)).toEqual(["commandList"]);
    const node = nodes[0];
    expect(node.kind).toBe("commandList");
    if (node.kind !== "commandList") return;
    expect(node.item.path).toBe("src");
    expect(node.item.filesCount).toBe(2);
    expect(node.item.files).toEqual(["src\\main.ts", "src\\App.vue"]);
  });

  it("replaces a search command action with a search card node", () => {
    const nodes = render([
      commandEvent({
        id: "cmd-1",
        type: "commandExecution",
        status: "completed",
        command: "rg Timeline src",
        commandActions: [{ type: "search", command: "rg Timeline src", query: "Timeline", path: "src" }],
        aggregatedOutput: "src\\a.ts:10:const Timeline = true\nsrc\\b.ts:4:Timeline()\n",
        exitCode: 0,
      }),
    ]);

    expect(nodes.map((node) => node.kind)).toEqual(["commandSearch"]);
    const node = nodes[0];
    expect(node.kind).toBe("commandSearch");
    if (node.kind !== "commandSearch") return;
    expect(node.item.query).toBe("Timeline");
    expect(node.item.path).toBe("src");
    expect(node.item.matchCount).toBe(2);
    expect(node.item.matches[0]).toMatchObject({ path: "src\\a.ts", line: 10, text: "const Timeline = true" });
  });

  it("keeps unknown commands as the existing command action node", () => {
    const nodes = render([
      commandEvent({
        id: "cmd-1",
        type: "commandExecution",
        status: "completed",
        command: "node scripts/build.mjs",
        commandActions: [{ type: "unknown", command: "node scripts/build.mjs" }],
        aggregatedOutput: "built",
        exitCode: 0,
      }),
    ]);

    expect(nodes.map((node) => node.kind)).toEqual(["commandAction"]);
  });

  it("falls back to command text when replayed history has no typed command actions", () => {
    const nodes = render([
      commandEvent({
        id: "cmd-1",
        type: "commandExecution",
        status: "completed",
        command: "Get-Content -LiteralPath src\\fallback.ts",
        commandActions: [{ command: "Get-Content -LiteralPath src\\fallback.ts" }],
        aggregatedOutput: "line one\nline two",
        exitCode: 0,
      }),
    ]);

    expect(nodes.map((node) => node.kind)).toEqual(["commandRead"]);
    const node = nodes[0];
    expect(node.kind).toBe("commandRead");
    if (node.kind !== "commandRead") return;
    expect(node.item.path).toBe("src\\fallback.ts");
    expect(node.item.lineCount).toBe(2);
  });
});
