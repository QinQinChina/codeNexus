import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layoutCss = readFileSync("src/renderer/styles/layout/center/layout.css", "utf8");

describe("main content width", () => {
  const cssBlockFor = (selector: string) => {
    const selectorIndex = layoutCss.indexOf(selector);
    expect(selectorIndex).toBeGreaterThanOrEqual(0);
    return layoutCss.slice(selectorIndex, layoutCss.indexOf("}", selectorIndex));
  };

  it("lets the workbench fill available space while constraining the inner chat column", () => {
    expect(layoutCss).toContain("--chat-content-max-w: 1000px");
    expect(layoutCss).toContain("--chat-column-w:");
    expect(layoutCss).toContain("--timeline-inline-pad:");
    expect(layoutCss).toContain("--timeline-scrollbar-gutter-w:");
    expect(layoutCss).toContain("100cqw");
    expect(layoutCss).not.toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)");
    expect(layoutCss).not.toContain("grid-column: 2");
  });

  it("lets the timeline scroll shell span the full center area", () => {
    const paneBlock = cssBlockFor(".timeline-pane--chat {");
    const block = cssBlockFor(".timeline-pane--chat #timeline");

    expect(paneBlock).toContain("padding: 0");
    expect(block).toContain("width: 100%");
    expect(block).toContain("height: 100%");
    expect(block).toContain("margin-left: 0");
    expect(block).toContain("margin-right: 0");
    expect(block).toContain("border: 0");
    expect(block).toContain("background: transparent");
    expect(block).toContain("box-shadow: none");
    expect(block).toContain("var(--composer-dock-space");
    expect(block).toContain("scrollbar-gutter: stable both-edges");
    expect(block).not.toContain("var(--chat-content-max-w)");
  });

  it("uses the same centered max-width for plan, chat content, and empty state", () => {
    for (const selector of [
      ".timeline-pane--chat #timeline > .plan-summary",
      ".timeline-pane--chat #timeline > .chat-pane",
      ".timeline-pane--chat #timeline > .timeline-empty-state-shell",
    ]) {
      const block = cssBlockFor(selector);
      expect(block).toContain("width: var(--chat-column-w)");
      expect(block).toContain("margin-left: auto");
      expect(block).toContain("margin-right: auto");
    }
  });

  it("keeps the composer docked over the full-height timeline", () => {
    const block = cssBlockFor(".timeline-pane--chat > .composer");

    expect(block).toContain("position: absolute");
    expect(block).toContain("bottom:");
    expect(block).toContain("left: 50%");
    expect(block).toContain("transform: translateX(-50%)");
    expect(block).toContain("width: var(--chat-column-w)");
  });

  it("keeps the plan summary sticky inside the timeline scrollport", () => {
    const block = cssBlockFor(".timeline-pane--chat #timeline > .plan-summary");

    expect(block).toContain("position: sticky");
    expect(block).toContain("top:");
    expect(block).toContain("z-index:");
    expect(block).toContain("width: var(--chat-column-w)");
    expect(block).toContain("margin-left: auto");
    expect(block).toContain("margin-right: auto");
  });
});
