import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/renderer/features/timeline/renderModel/diffSyntaxHighlight.ts", "utf8");

describe("diff syntax highlight styling", () => {
  it("does not dim added or deleted syntax-highlighted tokens", () => {
    expect(source).not.toContain("next.opacity");
    expect(source).not.toContain('opacity = tone === "light"');
    expect(source).toContain('next.fontWeight = "500"');
  });
});
