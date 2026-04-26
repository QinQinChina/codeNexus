import { describe, expect, it } from "vitest";
import type { HistoryThreadContentResult } from "../../../shared/ipc/contracts";
import {
  cloneHistoryThreadContentResult,
  invalidateThreadContentCache,
  normalizeCacheCount,
  pruneExpiredThreadContentCache,
  toRendererCacheItem,
  toThreadContentCacheKey,
  type ThreadContentCacheEntry,
} from "./rendererCacheRuntime";

function makeThreadContentResult(): HistoryThreadContentResult {
  return {
    found: true,
    threadId: " thread-1 ",
    thread: { id: "thread-1", title: "Thread" } as any,
    messages: [{ id: "message-1", role: "user", content: "hello" } as any],
    eventsPage: {
      entries: [{ id: "event-1", method: "turn/completed" } as any],
      total: 2.4,
      loaded: -1,
      hasMore: 1 as any,
    },
  };
}

describe("rendererCacheRuntime", () => {
  it("normalizes counts to non-negative integers", () => {
    expect(normalizeCacheCount(1.6)).toBe(2);
    expect(normalizeCacheCount(-5)).toBe(0);
    expect(normalizeCacheCount("bad")).toBe(0);
  });

  it("builds stable thread content cache keys", () => {
    expect(
      toThreadContentCacheKey({
        threadId: " thread-1 ",
        messageLimit: 10.4,
        eventLimit: 20.6,
        eventBefore: Number.NaN,
        includeAux: false,
      })
    ).toBe("thread-1|10|21||noAux");
  });

  it("clones thread content results before cache reuse", () => {
    const source = makeThreadContentResult();
    const cloned = cloneHistoryThreadContentResult(source);

    expect(cloned).toEqual({
      ...source,
      threadId: "thread-1",
      thread: source.thread,
      messages: source.messages,
      eventsPage: {
        entries: source.eventsPage.entries,
        total: 2,
        loaded: 0,
        hasMore: true,
      },
    });
    expect(cloned.thread).not.toBe(source.thread);
    expect(cloned.messages[0]).not.toBe(source.messages[0]);
    expect(cloned.eventsPage.entries[0]).not.toBe(source.eventsPage.entries[0]);
  });

  it("prunes expired entries and invalidates by thread", () => {
    const now = 1_000;
    const cache = new Map<string, ThreadContentCacheEntry>([
      ["thread-1|a", { threadId: "thread-1", expiresAt: now + 1, result: makeThreadContentResult() }],
      ["thread-2|a", { threadId: "thread-2", expiresAt: now - 1, result: makeThreadContentResult() }],
    ]);

    pruneExpiredThreadContentCache(cache, now);
    expect([...cache.keys()]).toEqual(["thread-1|a"]);

    invalidateThreadContentCache(cache, "thread-1");
    expect(cache.size).toBe(0);
  });

  it("normalizes renderer cache stats", () => {
    expect(
      toRendererCacheItem(
        "markdown",
        { namespace: "markdown", getStats: () => ({ items: 0, bytes: 0 }), clear: () => undefined },
        { items: 1.2, bytes: -4, note: " cached " },
        123
      )
    ).toEqual({
      namespace: "markdown",
      scope: "renderer",
      clearable: true,
      items: 1,
      bytes: 0,
      updatedAt: 123,
      note: "cached",
    });
  });
});
