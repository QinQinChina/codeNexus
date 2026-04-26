import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chatPane = readFileSync("src/renderer/components/layout/ChatPane.vue", "utf8");
const rowRenderer = readFileSync("src/renderer/components/layout/ChatRowRenderer.vue", "utf8");

describe("chat pane timeline row spacing styles", () => {
  it("does not generate malformed nested chat-pane selectors", () => {
    expect(chatPane).not.toContain("+ .chat-pane");
    expect(chatPane).not.toContain("chat-virtual");
    expect(chatPane).not.toMatch(/\.chat-row--bundle-child\s*\{/);
  });

  it("keeps plain timeline row spacing and child component state styles scoped through deep selectors", () => {
    expect(chatPane).toContain(".chat-pane :deep(.chat-timeline-row + .chat-timeline-row)");
    expect(chatPane).not.toContain("chat-row--bundle-child");
    expect(chatPane).not.toContain("isCollapsedTurnOpen");
    expect(rowRenderer).not.toContain("collapsedTurn");
    expect(rowRenderer).not.toContain("chat-non-body-bundle-summary");
    expect(chatPane).toContain(".chat-pane :deep(.chat-activity-dot.is-ok)");
    expect(chatPane).toContain(".chat-pane :deep(.chat-activity-dot.is-running::after)");
  });

  it("keeps plan execution option labels parseable", () => {
    expect(chatPane).toContain('{ value: "low", label: "低" }');
    expect(chatPane).toContain('{ value: "read-only", label: "只读" }');
    expect(rowRenderer).toContain('return source ? renderMarkdownToSafeHtml(source) : "<p>（空）</p>";');
  });

  it("does not pass row flex layout classes into the file change card internals", () => {
    expect(rowRenderer).not.toMatch(/<ChatFileChangeCard[^>]*class="chat-row chat-row--tool flex/);
    expect(rowRenderer).toContain("<div v-else-if=\"renderedRow.kind === 'fileChange'\"");
    expect(rowRenderer).toContain('class="chat-row chat-row--tool flex min-w-0 m-0"');
  });
});
