import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const timelineCss = readFileSync("src/renderer/styles/timeline.css", "utf8");

describe("removed chat bundle footer", () => {
  it("does not ship the turn tool summary component or styles", () => {
    expect(existsSync("src/renderer/components/chat/ChatBundleFooter.vue")).toBe(false);
    expect(timelineCss).not.toContain("chat-bundle-");
  });
});

