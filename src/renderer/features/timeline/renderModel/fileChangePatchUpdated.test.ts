import { describe, expect, it } from "vitest";
import type { TimelineEventItem } from "../../../domain/types";
import { buildTimelineRenderNodes } from "./buildTimelineNodes";

function event(overrides: Partial<TimelineEventItem>): TimelineEventItem {
  return {
    id: "event-1",
    method: "item/fileChange/patchUpdated",
    paramsText: "",
    createdAt: 100,
    level: "info",
    ...overrides,
  };
}

function fileChangeNodes(events: TimelineEventItem[]) {
  return buildTimelineRenderNodes({
    events,
    timelineKey: "thread-1",
    workspaceRoot: "D:\\repo",
    debug: false,
  }).filter((node) => node.kind === "fileChange");
}

describe("fileChange patchUpdated render nodes", () => {
  it("creates a running file change node from patchUpdated alone", () => {
    const nodes = fileChangeNodes([
      event({
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "patch-1",
          changes: [{ path: "D:\\repo\\src\\app.ts", kind: { type: "update" }, diff: "diff --git a/src/app.ts b/src/app.ts\n+new" }],
        },
      }),
    ]);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].item.status).toBe("running");
    expect(nodes[0].item.files[0]).toEqual(
      expect.objectContaining({ pathRel: "src\\app.ts", kind: "modify", diffText: expect.stringContaining("+new") })
    );
  });

  it("merges started, patchUpdated, and completed into one completed node", () => {
    const nodes = fileChangeNodes([
      event({
        id: "started",
        method: "item/started",
        createdAt: 90,
        params: { threadId: "thread-1", turnId: "turn-1", item: { type: "fileChange", id: "patch-1", status: "running", changes: [] } },
      }),
      event({
        id: "patch",
        createdAt: 100,
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "patch-1",
          changes: [{ path: "D:\\repo\\src\\app.ts", kind: { type: "update" }, diff: "diff --git a/src/app.ts b/src/app.ts\n+newer" }],
        },
      }),
      event({
        id: "completed",
        method: "item/completed",
        createdAt: 110,
        params: { threadId: "thread-1", turnId: "turn-1", item: { type: "fileChange", id: "patch-1", status: "completed", changes: [] } },
      }),
    ]);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].item.status).toBe("completed");
    expect(nodes[0].item.files[0].diffText).toContain("+newer");
  });

  it("uses the latest patchUpdated diff for the same path", () => {
    const nodes = fileChangeNodes([
      event({
        id: "patch-1",
        createdAt: 100,
        params: { threadId: "thread-1", turnId: "turn-1", itemId: "patch-1", changes: [{ path: "D:\\repo\\a.ts", kind: { type: "update" }, diff: "old" }] },
      }),
      event({
        id: "patch-2",
        createdAt: 101,
        params: { threadId: "thread-1", turnId: "turn-1", itemId: "patch-1", changes: [{ path: "D:\\repo\\a.ts", kind: { type: "update" }, diff: "latest" }] },
      }),
    ]);

    expect(nodes[0].item.files[0].diffText).toBe("latest");
  });

  it("tracks streaming metadata across patch updates and completion", () => {
    const nodes = fileChangeNodes([
      event({
        id: "patch-1",
        createdAt: 100,
        params: { threadId: "thread-1", turnId: "turn-1", itemId: "patch-1", changes: [{ path: "D:\\repo\\a.ts", kind: { type: "update" }, diff: "first" }] },
      }),
      event({
        id: "patch-2",
        createdAt: 120,
        params: { threadId: "thread-1", turnId: "turn-1", itemId: "patch-1", changes: [{ path: "D:\\repo\\a.ts", kind: { type: "update" }, diff: "second" }] },
      }),
      event({
        id: "completed",
        method: "item/completed",
        createdAt: 130,
        params: { threadId: "thread-1", turnId: "turn-1", item: { type: "fileChange", id: "patch-1", status: "completed", changes: [] } },
      }),
    ]);

    expect(nodes[0].item).toEqual(
      expect.objectContaining({
        streamUpdateCount: 2,
        lastPatchUpdatedAt: 120,
        isStreaming: false,
        settledAt: 130,
      })
    );
  });

  it("sorts streaming files by the most recent patch update", () => {
    const nodes = fileChangeNodes([
      event({
        id: "patch-a",
        createdAt: 100,
        params: { threadId: "thread-1", turnId: "turn-1", itemId: "patch-1", changes: [{ path: "D:\\repo\\a.ts", kind: { type: "update" }, diff: "old a" }] },
      }),
      event({
        id: "patch-b",
        createdAt: 110,
        params: { threadId: "thread-1", turnId: "turn-1", itemId: "patch-1", changes: [{ path: "D:\\repo\\b.ts", kind: { type: "update" }, diff: "new b" }] },
      }),
      event({
        id: "patch-a-latest",
        createdAt: 120,
        params: { threadId: "thread-1", turnId: "turn-1", itemId: "patch-1", changes: [{ path: "D:\\repo\\a.ts", kind: { type: "update" }, diff: "new a" }] },
      }),
    ]);

    expect(nodes[0].item.files.map((file) => file.pathRel)).toEqual(["a.ts", "b.ts"]);
    expect(nodes[0].item.files.map((file) => file.updatedAt)).toEqual([120, 110]);
  });

  it("preserves rename target paths from patchUpdated changes", () => {
    const nodes = fileChangeNodes([
      event({
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "patch-1",
          changes: [{ path: "D:\\repo\\old.ts", kind: { type: "update", move_path: "D:\\repo\\new.ts" }, diff: "rename diff" }],
        },
      }),
    ]);

    expect(nodes[0].item.files[0]).toEqual(
      expect.objectContaining({ kind: "rename", pathRel: "old.ts", pathRelTo: "new.ts" })
    );
  });
});
