import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync("src/renderer/components/chat/ChatReadFileCard.vue", "utf8");
const rowRenderer = readFileSync("src/renderer/components/layout/ChatRowRenderer.vue", "utf8");

describe("ChatReadFileCard", () => {
  it("renders read operations as compact chat cards with line ranges", () => {
    expect(component).toContain("chat-read-file-card");
    expect(component).toContain(">Read<");
    expect(component).toContain("lineRangeText");
    expect(component).toContain("explicitEnd ?? fallbackEnd");
    expect(component).toContain("`L${start}-${end}`");
  });

  it("uses the compact card only for commandRead rows", () => {
    expect(rowRenderer).toContain('import ChatReadFileCard from "../chat/ChatReadFileCard.vue"');
    expect(rowRenderer).toContain("<ChatReadFileCard :item=\"(renderedRow as any).item\" />");
    expect(rowRenderer).toContain("v-else-if=\"renderedRow.kind === 'commandList'\"");
    expect(rowRenderer).toContain("kind=\"list\"");
    expect(rowRenderer).toContain("v-else-if=\"renderedRow.kind === 'commandSearch'\"");
    expect(rowRenderer).toContain("kind=\"search\"");
  });
});