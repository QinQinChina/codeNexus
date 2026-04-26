import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appVue = readFileSync("src/renderer/App.vue", "utf8");
const leftSidebarVue = readFileSync("src/renderer/components/layout/LeftSidebar.vue", "utf8");
const stylesIndexCss = readFileSync("src/renderer/styles/index.css", "utf8");

describe("AI flowchart workbench removal", () => {
  it("does not mount the removed flowchart workbench in the main shell", () => {
    expect(appVue).not.toContain("FlowchartWorkbenchPage");
    expect(appVue).not.toContain("isFlowchartWorkbench");
  });

  it("does not expose the removed flowchart rail pane", () => {
    expect(leftSidebarVue).not.toContain("btn-rail-flowcharts");
    expect(leftSidebarVue).not.toContain("FlowchartPane");
    expect(leftSidebarVue).not.toContain("flowcharts");
  });

  it("does not import flowchart-only styles globally", () => {
    expect(stylesIndexCss).not.toContain("./features/flowcharts.css");
  });
});
