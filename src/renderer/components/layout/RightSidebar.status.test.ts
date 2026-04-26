import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const rightSidebarPath = "src/renderer/components/layout/RightSidebar.vue";
const appVue = read("src/renderer/App.vue");
const sidebarCss = readFileSync("src/renderer/styles/layout/sidebar/workspace.css", "utf8");
const shellCss = read("src/renderer/styles/foundation/shell.css");
const centerLayoutCss = read("src/renderer/styles/layout/center/layout.css");
const responsiveLayoutCss = read("src/renderer/styles/responsive/layout.css");
const localSettings = read("src/shared/localSettings.ts");

describe("right sidebar status overview removal", () => {
  it("removes the right status sidebar source file", () => {
    expect(existsSync(rightSidebarPath)).toBe(false);
  });

  it("does not keep status overview labels in production UI files", () => {
    const productionUi = [appVue, sidebarCss, shellCss, centerLayoutCss, responsiveLayoutCss].join("\n");
    for (const label of ["计划概览", "总步骤", "当前任务", "工具状态", "关键指标", "chat-status-sidebar"]) {
      expect(productionUi).not.toContain(label);
    }
  });

  it("removes right sidebar layout hooks", () => {
    const layoutCss = [shellCss, centerLayoutCss, responsiveLayoutCss].join("\n");

    for (const marker of ["has-right-sidebar", "right-sidebar-host", "sash-right", "--right-sidebar-w"]) {
      expect(layoutCss).not.toContain(marker);
    }
  });

  it("removes persisted right sidebar preference fields", () => {
    for (const marker of [
      "rightSidebarVisible",
      "rightSidebarWidthPx",
      "rightSidebarPanels",
      "LocalSettingsRightSidebarPanelsState",
      "DEFAULT_RIGHT_SIDEBAR_PANELS_STATE",
    ]) {
      expect(localSettings).not.toContain(marker);
    }
  });
});
