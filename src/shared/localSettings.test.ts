import { describe, expect, test } from "vitest";
import { BUILTIN_DYNAMIC_TOOL_NAMES } from "./dynamicTools";
import { mergeUserLocalSettings, normalizeUserLocalSettings } from "./localSettings";

describe("localSettings removed left rail panes", () => {
  test("drops the removed AI flowchart rail pane when reading cached settings", () => {
    const settings = normalizeUserLocalSettings({
      ui: {
        leftRailActivePane: "flowcharts",
      },
    });

    expect("leftRailActivePane" in settings.ui).toBe(false);
  });

  test("ignores the removed AI flowchart rail pane when merging patches", () => {
    const legacyPatch = { ui: { leftRailActivePane: "flowcharts" } } as unknown as Parameters<
      typeof mergeUserLocalSettings
    >[1];
    const settings = mergeUserLocalSettings({}, legacyPatch);

    expect("leftRailActivePane" in settings.ui).toBe(false);
  });

  test("drops the removed Git rail pane when reading cached settings", () => {
    const settings = normalizeUserLocalSettings({
      ui: {
        leftRailActivePane: "git",
      },
    });

    expect("leftRailActivePane" in settings.ui).toBe(false);
  });

  test("ignores the removed Git rail pane when merging patches", () => {
    const legacyPatch = { ui: { leftRailActivePane: "git" } } as unknown as Parameters<
      typeof mergeUserLocalSettings
    >[1];
    const settings = mergeUserLocalSettings({}, legacyPatch);

    expect("leftRailActivePane" in settings.ui).toBe(false);
  });
});

describe("localSettings main view", () => {
  test("migrates the removed team main view to chat when reading cached settings", () => {
    const settings = normalizeUserLocalSettings({
      ui: {
        mainView: "team",
      },
    });

    expect(settings.ui.mainView).toBe("chat");
  });

  test("migrates the removed team main view to chat when merging patches", () => {
    const legacyPatch = { ui: { mainView: "team" } } as unknown as Parameters<typeof mergeUserLocalSettings>[1];
    const settings = mergeUserLocalSettings({}, legacyPatch);

    expect(settings.ui.mainView).toBe("chat");
  });
});

describe("localSettings right sidebar preferences", () => {
  test("drops removed right sidebar preferences when reading cached settings", () => {
    const settings = normalizeUserLocalSettings({
      ui: {
        rightSidebarVisible: false,
        rightSidebarWidthPx: 480,
        rightSidebarPanels: {
          context: false,
          globalConfig: false,
          notificationSound: false,
        },
      },
    });

    expect("rightSidebarVisible" in settings.ui).toBe(false);
    expect("rightSidebarWidthPx" in settings.ui).toBe(false);
    expect("rightSidebarPanels" in settings.ui).toBe(false);
  });

  test("ignores removed right sidebar preferences when merging patches", () => {
    const legacyPatch = {
      ui: {
        rightSidebarVisible: false,
        rightSidebarWidthPx: 480,
        rightSidebarPanels: {
          context: false,
          globalConfig: false,
          notificationSound: false,
        },
      },
    } as unknown as Parameters<typeof mergeUserLocalSettings>[1];

    const settings = mergeUserLocalSettings({}, legacyPatch);

    expect("rightSidebarVisible" in settings.ui).toBe(false);
    expect("rightSidebarWidthPx" in settings.ui).toBe(false);
    expect("rightSidebarPanels" in settings.ui).toBe(false);
  });
});

describe("localSettings shell sidebars", () => {
  test("defaults to visible thread and files sidebars", () => {
    const settings = normalizeUserLocalSettings({});

    expect(settings.ui.leftSidebarVisible).toBe(true);
    expect(settings.ui.filesSidebarVisible).toBe(true);
    expect(settings.ui.filesSidebarWidthPx).toBe(300);
  });

  test("normalizes sidebar visibility and files width when reading cached settings", () => {
    const settings = normalizeUserLocalSettings({
      ui: {
        leftSidebarVisible: false,
        filesSidebarVisible: false,
        filesSidebarWidthPx: 420,
      },
    });

    expect(settings.ui.leftSidebarVisible).toBe(false);
    expect(settings.ui.filesSidebarVisible).toBe(false);
    expect(settings.ui.filesSidebarWidthPx).toBe(420);
  });

  test("merges sidebar visibility and files width patches", () => {
    const settings = mergeUserLocalSettings(
      {},
      {
        ui: {
          leftSidebarVisible: false,
          filesSidebarVisible: false,
          filesSidebarWidthPx: 360,
        },
      }
    );

    expect(settings.ui.leftSidebarVisible).toBe(false);
    expect(settings.ui.filesSidebarVisible).toBe(false);
    expect(settings.ui.filesSidebarWidthPx).toBe(360);
  });
});

describe("localSettings typography font presets", () => {
  test("normalizes bundled Chinese UI font presets", () => {
    expect(normalizeUserLocalSettings({ ui: { fontFamilyPreset: "source-han-sans-sc" } }).ui.fontFamilyPreset).toBe(
      "source-han-sans-sc"
    );
    expect(normalizeUserLocalSettings({ ui: { fontFamilyPreset: "alibaba-puhuiti" } }).ui.fontFamilyPreset).toBe(
      "alibaba-puhuiti"
    );
  });

  test("migrates legacy font style presets to Alibaba PuHuiTi", () => {
    for (const preset of ["system", "serif", "mono", "cursive", "fangsong", "unknown"]) {
      expect(normalizeUserLocalSettings({ ui: { fontFamilyPreset: preset } }).ui.fontFamilyPreset).toBe(
        "alibaba-puhuiti"
      );
    }
  });
});

describe("localSettings dynamic tools", () => {
  test("has no builtin dynamic tools after removing workflow tools", () => {
    const settings = normalizeUserLocalSettings({});

    expect(BUILTIN_DYNAMIC_TOOL_NAMES).toEqual([]);
    expect(settings.dynamicTools.enabledByName).toEqual({});
  });

  test("drops legacy workflow dynamic tool flags", () => {
    const settings = normalizeUserLocalSettings({
      dynamicTools: {
        enabledByName: {
          workflow_task_list: false,
          workflow_task_create: true,
          unknown_tool: false,
        },
      },
    });

    expect(settings.dynamicTools.enabledByName).toEqual({});
    expect("unknown_tool" in settings.dynamicTools.enabledByName).toBe(false);
  });

  test("ignores legacy workflow dynamic tool patches", () => {
    const settings = mergeUserLocalSettings(
      {
        dynamicTools: {
          enabledByName: {
            workflow_task_list: false,
            workflow_task_create: true,
          },
        },
      },
      {
        dynamicTools: {
          enabledByName: {
            workflow_task_create: false,
          },
        },
      }
    );

    expect(settings.dynamicTools.enabledByName).toEqual({});
  });
});
