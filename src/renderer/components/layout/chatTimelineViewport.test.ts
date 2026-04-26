import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chatPane = readFileSync("src/renderer/components/layout/ChatPane.vue", "utf8");
const viewport = readFileSync("src/renderer/components/layout/ChatTimelineViewport.vue", "utf8");
const chatTypes = readFileSync("src/renderer/components/layout/chat.types.ts", "utf8");
const chatRenderModel = readFileSync("src/renderer/components/layout/useChatRenderModel.ts", "utf8");
const rowRendererPath = "src/renderer/components/layout/ChatRowRenderer.vue";

describe("chat timeline viewport integration", () => {
  it("routes rendered chat rows through the plain timeline viewport", () => {
    expect(chatPane).toContain('import ChatTimelineViewport from "./ChatTimelineViewport.vue"');
    expect(chatPane).toContain("<ChatTimelineViewport");
    expect(chatPane).toContain(':rows="chatRenderedRows"');
    expect(chatPane).toContain('#default="{ row: renderedRow }"');
  });

  it("renders every chat row without virtualization", () => {
    expect(viewport).toContain('v-for="row in rows"');
    expect(viewport).toContain(':key="row.id"');
    expect(viewport).toContain('class="chat-timeline-row"');
    expect(viewport).toContain('<slot :row="row" />');
    expect(viewport).not.toContain('from "@tanstack/vue-virtual"');
    expect(viewport).not.toContain("useVirtualizer");
    expect(viewport).not.toContain("measureElement");
    expect(viewport).not.toContain("getTotalSize()");
    expect(viewport).not.toContain("chat-virtual");
  });

  it("does not keep virtualizer layout revision or estimated height plumbing", () => {
    expect(chatPane).not.toContain("layoutRevision?: number");
    expect(chatPane).not.toContain(':layoutRevision="layoutRevision"');
    expect(viewport).not.toContain("layoutRevision");
    expect(viewport).not.toContain("rowIdentitySignature");
    expect(viewport).not.toContain("measureVirtualizer");
    expect(chatTypes).not.toContain("estimatedHeight");
    expect(chatRenderModel).not.toContain("withEstimatedChatRowHeight");
  });

  it("delegates visible row rendering to a focused row renderer", () => {
    const rowRenderer = readFileSync(rowRendererPath, "utf8");

    expect(chatPane).toContain('import ChatRowRenderer from "./ChatRowRenderer.vue"');
    expect(chatPane).toContain("<ChatRowRenderer");
    expect(chatPane).not.toContain("<ChatUserMessage");
    expect(rowRenderer).toContain("<ChatUserMessage");
    expect(rowRenderer).not.toContain("getChatRenderedEntries");
  });
});
