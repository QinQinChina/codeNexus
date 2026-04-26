import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

const appVue = read("src/renderer/App.vue");
const centerPaneVue = read("src/renderer/components/layout/CenterPane.vue");
const debugSidebarPath = "src/renderer/components/layout/DebugTimelineSidebar.vue";
const debugSidebarVue = read(debugSidebarPath);

describe("debug timeline right sidebar placement", () => {
  it("provides a dedicated debug timeline sidebar component", () => {
    expect(existsSync(debugSidebarPath)).toBe(true);
    expect(debugSidebarVue).toContain("TimelinePane");
    expect(debugSidebarVue).toContain("debugTimelineStore.eventsForThread");
    expect(debugSidebarVue).toContain("setTimelineDebugEnabled(false)");
  });

  it("mounts the debug timeline in the existing right files-sidebar slot", () => {
    expect(appVue).toContain("DebugTimelineSidebar");
    expect(appVue).toContain("showDebugSidebar");
    expect(appVue).toContain('v-if="showDebugSidebar"');
    expect(appVue).toContain('v-else-if="showFilesSidebar"');
  });

  it("keeps the shortcut but removes the center overlay implementation", () => {
    expect(centerPaneVue).toContain("toggleTimelineDebugEnabled");
    expect(centerPaneVue).toContain('event.code === "KeyJ"');
    expect(centerPaneVue).not.toContain("debug-timeline-overlay");
    expect(centerPaneVue).not.toContain("debugOverlayEvents");
  });
});
