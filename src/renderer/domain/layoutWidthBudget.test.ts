import { describe, expect, it } from "vitest";
import { CENTER_BASE_MIN_WIDTH_PX, resolveShellWidths } from "./layoutWidthBudget";

describe("layout width budget", () => {
  it("keeps center width above the hard minimum when thread and files sidebars are visible", () => {
    const widths = resolveShellWidths({
      containerWidth: 920,
      leftVisible: true,
      filesVisible: true,
      rightVisible: false,
      leftPreferredWidth: 320,
      filesPreferredWidth: 300,
      rightPreferredWidth: 0,
      centerHardMinWidth: CENTER_BASE_MIN_WIDTH_PX,
      prioritySide: "left",
    });

    expect(widths.centerWidth).toBeGreaterThanOrEqual(CENTER_BASE_MIN_WIDTH_PX);
    expect(widths.leftWidth).toBeGreaterThan(0);
    expect(widths.filesWidth).toBeGreaterThan(0);
    expect(widths.rightWidth).toBe(0);
  });

  it("collapses the left side to zero when the thread sidebar is hidden", () => {
    const widths = resolveShellWidths({
      containerWidth: 1280,
      leftVisible: false,
      filesVisible: true,
      rightVisible: false,
      leftPreferredWidth: 320,
      filesPreferredWidth: 300,
      rightPreferredWidth: 0,
      centerHardMinWidth: CENTER_BASE_MIN_WIDTH_PX,
    });

    expect(widths.leftWidth).toBe(0);
    expect(widths.filesWidth).toBeGreaterThan(0);
  });
});
