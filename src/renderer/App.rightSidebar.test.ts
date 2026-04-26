import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appVue = readFileSync("src/renderer/App.vue", "utf8");
const appShellStore = readFileSync("src/renderer/stores/appShell.store.ts", "utf8");

describe("app right sidebar removal", () => {
  it("does not mount the removed right status sidebar in the chat shell", () => {
    expect(appVue).not.toContain('import RightSidebar from "./components/layout/RightSidebar.vue"');
    expect(appVue).not.toContain("<RightSidebar");
    expect(appVue).not.toContain("showChatRightSidebar");
    expect(appVue).not.toContain("right-sidebar-host");
    expect(appVue).not.toContain("has-right-sidebar");
    expect(appVue).not.toContain("--right-sidebar-w");
  });

  it("does not keep unused right sidebar shell state or actions", () => {
    for (const marker of [
      "rightSidebarVisible",
      "rightSidebarWidthPx",
      "rightSidebarPanels",
      "DEFAULT_RIGHT_SIDEBAR_WIDTH_PX",
      "setRightSidebarVisible",
      "toggleRightSidebarVisible",
      "setRightSidebarWidthPx",
    ]) {
      expect(appShellStore).not.toContain(marker);
    }
  });
});
