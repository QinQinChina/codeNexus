import { describe, expect, it } from "vitest";
import type { McpServerState } from "../types";
import {
  analyzeMcpTemplateVariables,
  buildMcpResourceReadSummary,
  buildResolvedMcpTemplateUri,
  estimateBase64ByteLength,
  summarizeMcpResourceMimeTypes,
  summarizeTextPreview,
  toMcpResourceSourceTab,
  toMcpResourceTimelineContents,
} from "./mcpResourceRuntime";

const server: McpServerState = {
  id: "server-1",
  enabled: true,
  state: "connected",
  tools: [{ name: "read_resource", title: " Read Resource ", inputSchema: {} }],
  resources: [{ uri: "file://settings.json", name: "settings", title: " Settings " }],
  resourceTemplates: [{ uriTemplate: "repo://{owner}/{repo}", name: "repo", title: " Repository " }],
};

describe("mcpResourceRuntime", () => {
  it("normalizes the selected resource source tab", () => {
    expect(toMcpResourceSourceTab(" templates ")).toBe("templates");
    expect(toMcpResourceSourceTab("unknown")).toBe("resources");
  });

  it("extracts simple and URI-template variable names", () => {
    expect(analyzeMcpTemplateVariables("repo://{owner}/{repo}{?ref,page}{/path*}")).toEqual([
      "owner",
      "repo",
      "ref",
      "page",
      "path",
    ]);
  });

  it("resolves simple template variables with URI encoding", () => {
    expect(buildResolvedMcpTemplateUri("repo://{owner}/{repo}", { owner: "open ai", repo: "codex" })).toBe(
      "repo://open%20ai/codex"
    );
  });

  it("builds read summaries for resources and templates", () => {
    expect(
      buildMcpResourceReadSummary({
        serverKey: "server-1",
        uri: "file://settings.json",
        sourceTab: "resources",
        templateKey: "",
        servers: [server],
        getTemplateDraft: () => undefined,
      })
    ).toEqual({
      resourceLabel: "Settings",
      toolNames: ["Read Resource"],
      parameterEntries: [],
    });

    expect(
      buildMcpResourceReadSummary({
        serverKey: "server-1",
        uri: "repo://openai/codex",
        sourceTab: "templates",
        templateKey: "repo://{owner}/{repo}",
        servers: [server],
        getTemplateDraft: () => ({ values: { owner: "openai", repo: "codex" }, manualUri: "" }),
      })
    ).toEqual({
      resourceLabel: "Repository",
      toolNames: ["Read Resource"],
      parameterEntries: [
        { key: "owner", value: "openai" },
        { key: "repo", value: "codex" },
        { key: "resolvedUri", value: "repo://openai/codex" },
      ],
    });
  });

  it("summarizes resource contents for timeline display", () => {
    const contents = toMcpResourceTimelineContents([
      { uri: "file://a.txt", mimeType: "text/plain", text: "first line\nsecond line" },
      { uri: "file://image.png", mimeType: "image/png", blob: "SGVsbG8=" },
      { uri: "file://data.bin", blob: "AA==" },
    ]);

    expect(contents).toEqual([
      {
        uri: "file://a.txt",
        mimeType: "text/plain",
        kind: "text",
        previewText: "first line",
        sizeBytes: 22,
      },
      {
        uri: "file://image.png",
        mimeType: "image/png",
        kind: "blob",
        previewText: "图片内容",
        sizeBytes: 5,
      },
      {
        uri: "file://data.bin",
        mimeType: "",
        kind: "blob",
        previewText: "",
        sizeBytes: 1,
      },
    ]);
    expect(summarizeMcpResourceMimeTypes(contents)).toBe("text/plain ｜ image/png ｜ application/octet-stream");
  });

  it("estimates base64 bytes and truncates long previews", () => {
    expect(estimateBase64ByteLength("SGVsbG8=")).toBe(5);
    expect(summarizeTextPreview("abcdef", 4)).toBe("abc…");
  });
});
