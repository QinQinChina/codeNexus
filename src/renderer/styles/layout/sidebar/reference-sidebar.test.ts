import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const railCss = readFileSync("src/renderer/styles/layout/sidebar/rail.css", "utf8");
const threadsCss = readFileSync("src/renderer/styles/layout/sidebar/threads.css", "utf8");
const restoredRailCss = railCss.slice(railCss.indexOf("/* Reference restoration"));
const restoredThreadsCss = threadsCss.slice(threadsCss.indexOf("/* Reference restoration"));

describe("left sidebar reference restoration styles", () => {
  it("uses the compact dark thread sidebar palette without the old rail column", () => {
    expect(railCss).toContain("--lsb-reference-bg");
    expect(railCss).toContain("--lsb-reference-accent");
    expect(railCss).toContain("border-right: 1px solid var(--left-rail-divider)");
    expect(railCss).toContain(".lsb-shell--threads-only");
    expect(railCss).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(railCss).not.toContain("grid-template-columns: var(--lsb-rail-w) minmax(0, 1fr)");
    expect(railCss).not.toContain(".lsb-rail {");
  });

  it("keeps the thread header controls compact", () => {
    expect(railCss).toContain("padding: 12px 14px 8px");
    expect(railCss).toContain("font-size: 16px");
    expect(threadsCss).toContain("min-height: 36px");
    expect(threadsCss).toContain("width: 36px");
    expect(threadsCss).toContain("min-height: 34px");
  });

  it("keeps restored thread header colors theme-aware", () => {
    expect(restoredRailCss).toContain("color-mix(in srgb, var(--sidebar-bg)");
    expect(restoredThreadsCss).toContain("var(--lsb-reference-control-bg)");
    expect(`${restoredRailCss}
${restoredThreadsCss}`).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba\(/);
  });

  it("matches the reference spacing and selected thread card treatment", () => {
    expect(threadsCss).toContain("min-height: 38px");
    expect(threadsCss).toContain("border-radius: 8px");
    expect(threadsCss).toMatch(/box-shadow:\s*inset 3px 0 0 var\(--lsb-reference-accent\)/);
    expect(threadsCss).toContain("padding: 7px 10px");
  });
});
