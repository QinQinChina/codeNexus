import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("sleep feature removal", () => {
  it("does not expose the removed sleep UI from the app shell", () => {
    const appVue = read("src/renderer/App.vue");
    const bottomBarVue = read("src/renderer/components/layout/BottomBar.vue");
    const appShellStore = read("src/renderer/stores/appShell.store.ts");

    expect(appVue).not.toContain("SleepPopover");
    expect(appVue).not.toContain("SleepPage");
    expect(bottomBarVue).not.toContain("sleepPopoverOpen");
    expect(bottomBarVue).not.toContain("openSleepPopover");
    expect(bottomBarVue).not.toContain("toggleSleepPopover");
    expect(appShellStore).not.toContain("sleepPopoverOpen");
    expect(appShellStore).not.toContain("openSleepPopover");
    expect(appShellStore).not.toContain("toggleSleepPopover");
  });

  it("does not expose sleep APIs across process boundaries", () => {
    const preloadClient = read("src/preload/api/client.ts");
    const preloadChannels = read("src/preload/api/channels.ts");
    const ipcChannels = read("src/shared/ipc/channels.ts");
    const contracts = read("src/shared/ipc/contracts.ts");
    const events = read("src/shared/ipc/channels/events.ts");
    const mainHandlersIndex = read("src/main/ipc/handlers/index.ts");
    const mainEntry = read("src/main/main.ts");

    expect(preloadClient).not.toContain("createSleepApi");
    expect(preloadClient).not.toContain("sleep:");
    expect(preloadChannels).not.toContain("IPC_SLEEP_CHANNELS");
    expect(ipcChannels).not.toContain("IPC_SLEEP_CHANNELS");
    expect(contracts).not.toContain("CodexDesktopSleepApi");
    expect(contracts).not.toContain("sleep: CodexDesktopSleepApi");
    expect(events).not.toContain("sleepManifestUpdated");
    expect(events).not.toContain("sleepCacheState");
    expect(events).not.toContain("sleepCacheStatsUpdated");
    expect(mainHandlersIndex).not.toContain("registerSleepHandlers");
    expect(mainHandlersIndex).not.toContain("sleepService");
    expect(mainEntry).not.toContain("SleepIntegrationService");
    expect(mainEntry).not.toContain("main.sleep");
  });

  it("removes sleep source files while keeping notification sounds", () => {
    const removedPaths = [
      "src/renderer/components/layout/SleepPopover.vue",
      "src/renderer/components/layout/SleepPage.vue",
      "src/renderer/stores/sleep.store.ts",
      "src/renderer/features/sleep/types.ts",
      "src/renderer/features/sleep/audioEngine.ts",
      "src/preload/api/client/sleep.ts",
      "src/shared/ipc/channels/sleep.ts",
      "src/main/ipc/handlers/sleep.handlers.ts",
      "src/main/services/SleepIntegrationService.ts",
    ];

    expect(removedPaths.filter((path) => existsSync(path))).toEqual([]);
    expect(existsSync("src/renderer/stores/notificationSound.store.ts")).toBe(true);
    expect(existsSync("src/renderer/features/notificationSound/player.ts")).toBe(true);
  });
});
