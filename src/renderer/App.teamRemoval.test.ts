import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("team and workflow removal", () => {
  it("does not expose the removed team main view", () => {
    const appVue = read("src/renderer/App.vue");
    const topBarVue = read("src/renderer/components/layout/TopBar.vue");
    const localSettings = read("src/shared/localSettings.ts");

    expect(appVue).not.toContain("TeamExecutionPage");
    expect(appVue).not.toContain("mainView === 'team'");
    expect(topBarVue).not.toContain("团队");
    expect(topBarVue).not.toContain("setMainView('team')");
    expect(localSettings).not.toContain('"chat" | "team"');
  });

  it("does not expose workflow APIs across process boundaries", () => {
    const preloadClient = read("src/preload/api/client.ts");
    const preloadChannels = read("src/preload/api/channels.ts");
    const ipcChannels = read("src/shared/ipc/channels.ts");
    const contracts = read("src/shared/ipc/contracts.ts");
    const mainHandlersIndex = read("src/main/ipc/handlers/index.ts");
    const mainEntry = read("src/main/main.ts");

    expect(preloadClient).not.toContain("createWorkflowApi");
    expect(preloadClient).not.toContain("workflow:");
    expect(preloadChannels).not.toContain("IPC_WORKFLOW_CHANNELS");
    expect(ipcChannels).not.toContain("IPC_WORKFLOW_CHANNELS");
    expect(contracts).not.toContain("CodexDesktopWorkflowApi");
    expect(contracts).not.toContain("workflow: CodexDesktopWorkflowApi");
    expect(mainHandlersIndex).not.toContain("registerWorkflowHandlers");
    expect(mainHandlersIndex).not.toContain("workflowExecutionService");
    expect(mainEntry).not.toContain("WorkflowExecutionService");
    expect(mainEntry).not.toContain("workflowExecutionService");
  });

  it("does not inject removed workflow dynamic tools", () => {
    const dynamicTools = read("src/shared/dynamicTools.ts");
    const runtimeOrchestrator = read("src/renderer/domain/runtimeOrchestrator.ts");
    const requestResponder = read("src/renderer/processes/protocol-request-responder/installRequestResponder.ts");
    const settingsHeader = read("src/renderer/components/layout/SettingsHeader.vue");
    const settingsPage = read("src/renderer/components/layout/SettingsPage.vue");

    expect(dynamicTools).not.toContain("workflow_task_create");
    expect(dynamicTools).not.toContain("workflow_replace_steps");
    expect(runtimeOrchestrator).not.toContain("buildBuiltinDynamicToolSpecs");
    expect(runtimeOrchestrator).not.toContain("dynamicTools:");
    expect(requestResponder).not.toContain("workflow_");
    expect(settingsHeader).not.toContain("dynamicTools");
    expect(settingsPage).not.toContain("SettingsDynamicToolsTab");
  });

  it("removes team and workflow source files", () => {
    const removedPaths = [
      "src/renderer/components/layout/TeamExecutionPage.vue",
      "src/renderer/components/layout/team/TeamVisualWorkbenchPane.vue",
      "src/renderer/components/layout/team/TeamPlaceholderPane.vue",
      "src/renderer/stores/workflowDefinitions.store.ts",
      "src/renderer/stores/workflowTemplates.store.ts",
      "src/renderer/stores/dynamicTools.store.ts",
      "src/renderer/domain/workflow/workflowTemplateRepository.ts",
      "src/renderer/domain/workflow/workflowPromptTemplateRepository.ts",
      "src/renderer/domain/workflow/workflowStatePaths.ts",
      "src/renderer/features/workflow/teamWorkbenchEvents.ts",
      "src/renderer/components/layout/settings/SettingsDynamicToolsTab.vue",
      "src/preload/api/client/workflow.ts",
      "src/shared/ipc/channels/workflow.ts",
      "src/shared/workflow/template.ts",
      "src/shared/workflow/normalize.ts",
      "src/main/ipc/handlers/workflow.handlers.ts",
      "src/main/services/WorkflowExecutionService.ts",
    ];

    expect(removedPaths.filter((path) => existsSync(path))).toEqual([]);
  });
});
