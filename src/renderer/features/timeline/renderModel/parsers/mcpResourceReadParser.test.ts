import { describe, expect, it } from "vitest";
import type { TimelineEventItem } from "../../../../domain/types";
import {
  normalizeMcpResourceSourceTab,
  parseMcpResourceParameterEntries,
  parseMcpResourceReadEvent,
  resolveMcpResourceReadStatus,
  summarizeMcpResourceMimeTypes,
  summarizeMcpResourcePreviewText,
  toMcpResourceLookupKey,
} from "./mcpResourceReadParser";

function event(overrides: Partial<TimelineEventItem>): TimelineEventItem {
  return {
    id: "event-1",
    method: "mcp/resourceRead",
    paramsText: "",
    createdAt: 123,
    level: "info",
    ...overrides,
  };
}

describe("mcpResourceReadParser", () => {
  it("builds lookup keys and normalizes source tabs", () => {
    expect(toMcpResourceLookupKey(" server ", " uri ")).toBe("server::uri");
    expect(toMcpResourceLookupKey("", "uri")).toBe("");
    expect(normalizeMcpResourceSourceTab(" templates ")).toBe("templates");
    expect(normalizeMcpResourceSourceTab("resources")).toBe("resources");
  });

  it("parses parameter entries defensively", () => {
    expect(
      parseMcpResourceParameterEntries([{ key: " owner ", value: "openai" }, { key: "", value: "ignored" }, null])
    ).toEqual([{ key: "owner", value: "openai" }]);
  });

  it("summarizes preview text and mime types", () => {
    expect(
      summarizeMcpResourcePreviewText([
        { uri: "file://a.txt", mimeType: "text/plain", kind: "text", previewText: " first line ", sizeBytes: 10 },
      ])
    ).toBe("first line");
    expect(
      summarizeMcpResourcePreviewText([
        { uri: "file://image.png", mimeType: "image/png", kind: "blob", previewText: "", sizeBytes: 10 },
      ])
    ).toBe("图片 ｜ image/png");
    expect(
      summarizeMcpResourceMimeTypes([
        { uri: "a", mimeType: "text/plain", kind: "text", previewText: "", sizeBytes: null },
        { uri: "b", mimeType: "text/plain", kind: "text", previewText: "", sizeBytes: null },
        { uri: "c", mimeType: "", kind: "blob", previewText: "", sizeBytes: null },
      ])
    ).toBe("text/plain ×2 ｜ application/octet-stream");
  });

  it("resolves resource read status", () => {
    expect(resolveMcpResourceReadStatus("running", false)).toBe("running");
    expect(resolveMcpResourceReadStatus("done", false)).toBe("completed");
    expect(resolveMcpResourceReadStatus("done", true)).toBe("failed");
    expect(resolveMcpResourceReadStatus("unknown", false)).toBe("completed");
  });

  it("parses mcp resource read events from object params", () => {
    expect(
      parseMcpResourceReadEvent(
        event({
          threadId: "thread-from-event",
          turnId: "turn-from-event",
          params: {
            threadId: "thread-1",
            server: "server-1",
            uri: "file://settings.json",
            sourceTab: "templates",
            templateKey: "file://{name}",
            status: "success",
            fetchedAt: 10.6,
            resourceLabel: " Settings ",
            toolNames: [" read ", ""],
            parameterEntries: [{ key: "name", value: "settings.json" }],
            contents: [
              {
                uri: " file://settings.json ",
                mimeType: " text/plain ",
                kind: "text",
                previewText: " ok ",
                sizeBytes: 4.4,
              },
            ],
          },
        })
      )
    ).toEqual({
      threadId: "thread-1",
      turnId: "turn-from-event",
      server: "server-1",
      uri: "file://settings.json",
      sourceTab: "templates",
      templateKey: "file://{name}",
      status: "completed",
      fetchedAt: 11,
      resourceLabel: "Settings",
      toolNames: ["read"],
      parameterEntries: [{ key: "name", value: "settings.json" }],
      contents: [
        {
          uri: "file://settings.json",
          mimeType: "text/plain",
          kind: "text",
          previewText: "ok",
          sizeBytes: 4,
        },
      ],
      previewText: "ok",
      mimeSummary: "text/plain",
      errorText: "",
      createdAt: 123,
    });
  });

  it("parses mcp resource read events from JSON paramsText and rejects incomplete payloads", () => {
    const parsed = parseMcpResourceReadEvent(
      event({
        paramsText: JSON.stringify({
          threadId: "thread-1",
          serverKey: "server-1",
          uri: "file://image.png",
          status: "running",
          contents: [{ uri: "file://image.png", mimeType: "image/png", kind: "blob", sizeBytes: -3 }],
        }),
      })
    );

    expect(parsed?.status).toBe("running");
    expect(parsed?.contents[0]?.sizeBytes).toBe(0);
    expect(parsed?.previewText).toBe("图片 ｜ image/png");
    expect(parseMcpResourceReadEvent(event({ params: { server: "server-1", uri: "file://a" } }))).toBeNull();
  });
});
