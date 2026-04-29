import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync("src/renderer/components/timeline/cards/CommandVisualCardContent.vue", "utf8");

describe("CommandVisualCardContent", () => {
  it("does not render the raw output section for search cards", () => {
    expect(component).toContain("v-if=\"item.outputFull && kind === 'list'\"");
    expect(component).not.toContain("v-if=\"item.outputFull && kind !== 'read'\"");
  });
});
