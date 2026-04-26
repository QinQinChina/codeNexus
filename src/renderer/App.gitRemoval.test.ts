import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Git management removal", () => {
  it("does not expose the removed Git rail pane", () => {
    const leftSidebarVue = read("src/renderer/components/layout/LeftSidebar.vue");

    expect(leftSidebarVue).not.toContain("btn-rail-git");
    expect(leftSidebarVue).not.toContain("GitPane");
    expect(leftSidebarVue).not.toContain("GitBranch");
  });

  it("does not expose the removed team Git updates pane", () => {
    const teamPagePath = "src/renderer/components/layout/TeamExecutionPage.vue";
    if (!existsSync(teamPagePath)) {
      expect(existsSync(teamPagePath)).toBe(false);
      return;
    }

    const teamExecutionPageVue = read(teamPagePath);

    expect(teamExecutionPageVue).not.toContain("TeamGitUpdatesPane");
    expect(teamExecutionPageVue).not.toContain("activeTeamTab === 'git'");
    expect(teamExecutionPageVue).not.toContain("Git 更新");
  });

  it("does not expose Git management APIs across process boundaries", () => {
    const preloadClient = read("src/preload/api/client.ts");
    const preloadChannels = read("src/preload/api/channels.ts");
    const ipcChannels = read("src/shared/ipc/channels.ts");
    const contracts = read("src/shared/ipc/contracts.ts");
    const mainHandlersIndex = read("src/main/ipc/handlers/index.ts");
    const mainEntry = read("src/main/main.ts");

    expect(preloadClient).not.toContain("createGitApi");
    expect(preloadClient).not.toContain("git:");
    expect(preloadChannels).not.toContain("IPC_GIT_CHANNELS");
    expect(ipcChannels).not.toContain("IPC_GIT_CHANNELS");
    expect(contracts).not.toContain("CodexDesktopGitApi");
    expect(contracts).not.toContain("git: CodexDesktopGitApi");
    expect(mainHandlersIndex).not.toContain("registerGitHandlers");
    expect(mainHandlersIndex).not.toContain("gitService");
    expect(mainEntry).not.toContain("GitService");
    expect(mainEntry).not.toContain("gitService");
  });

  it("removes Git management source files", () => {
    const removedPaths = [
      "src/renderer/components/layout/left-sidebar/GitPane.vue",
      "src/renderer/components/layout/left-sidebar/git/GitPreviewCard.vue",
      "src/renderer/stores/git.store.ts",
      "src/preload/api/client/git.ts",
      "src/shared/ipc/channels/git.ts",
      "src/main/ipc/handlers/git.handlers.ts",
      "src/main/services/GitService.ts",
    ];

    expect(removedPaths.filter((path) => existsSync(path))).toEqual([]);
  });
});
