import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const appVue = read("src/renderer/App.vue");
const appShellStore = read("src/renderer/stores/appShell.store.ts");
const leftSidebarVue = read("src/renderer/components/layout/LeftSidebar.vue");
const topBarVue = read("src/renderer/components/layout/TopBar.vue");
const shellCss = read("src/renderer/styles/foundation/shell.css");

describe("sidebar and file pane refactor", () => {
  it("removes the old left rail and workspace pane from the left sidebar", () => {
    expect(leftSidebarVue).not.toContain("lsb-rail");
    expect(leftSidebarVue).not.toContain("btn-rail-workspace");
    expect(leftSidebarVue).not.toContain("btn-rail-settings");
    expect(leftSidebarVue).not.toContain("WorkspacePane");
    expect(leftSidebarVue).toContain("ThreadHistoryPane");
  });

  it("removes the old workspace-pane source after moving files to the right sidebar", () => {
    expect(existsSync("src/renderer/components/layout/left-sidebar/WorkspacePane.vue")).toBe(false);
  });

  it("mounts the workspace file tree as a right files sidebar without restoring rightSidebar state", () => {
    expect(appVue).toContain('import WorkspaceFilesSidebar from "./components/layout/WorkspaceFilesSidebar.vue"');
    expect(appVue).toContain("<WorkspaceFilesSidebar");
    expect(appVue).toContain("showFilesSidebar");
    expect(appVue).toContain("--files-sidebar-w");
    expect(appVue).not.toContain("<RightSidebar");
    expect(appShellStore).not.toContain("rightSidebarVisible");
    expect(appShellStore).not.toContain("rightSidebarWidthPx");
    expect(appShellStore).not.toContain("rightSidebarPanels");
  });

  it("persists independent left thread and right files sidebar state", () => {
    for (const marker of [
      "leftSidebarVisible",
      "filesSidebarVisible",
      "filesSidebarWidthPx",
      "setLeftSidebarVisible",
      "setFilesSidebarVisible",
      "setFilesSidebarWidthPx",
    ]) {
      expect(appShellStore).toContain(marker);
    }
  });

  it("exposes topbar controls for thread pane, file pane, and settings", () => {
    for (const marker of [
      "btn-toggle-thread-pane",
      "btn-toggle-files-pane",
      "btn-open-settings",
      "appShellStore.openSettings",
    ]) {
      expect(topBarVue).toContain(marker);
    }
  });

  it("defines shell columns for both side panes and keeps settings full-width", () => {
    expect(shellCss).toContain("grid-template-areas: \"tasks center files\"");
    expect(shellCss).toContain("var(--files-sidebar-w)");
    expect(shellCss).toContain(".main.has-settings");
    expect(shellCss).toContain("grid-template-areas: \"center\"");
  });
});
