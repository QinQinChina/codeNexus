import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const topBarVue = readFileSync("src/renderer/components/layout/TopBar.vue", "utf8");
const topBarApprovalMenuVue = readFileSync("src/renderer/components/layout/topbar/TopBarApprovalMenu.vue", "utf8");
const requestResponderSource = readFileSync(
  "src/renderer/processes/protocol-request-responder/installRequestResponder.ts",
  "utf8"
);
const runtimeOrchestratorSource = readFileSync("src/renderer/domain/runtimeOrchestrator.ts", "utf8");

describe("top bar approval entry", () => {
  it("mounts the approval menu as the approval request entry point", () => {
    expect(topBarVue).toContain("TopBarApprovalMenu");
    expect(topBarVue).toContain("approvalMenuOpen");
    expect(topBarVue).toContain('@toggle="toggleApprovalMenu"');
  });

  it("does not restore removed right-sidebar actions into the top bar", () => {
    expect(topBarVue).not.toContain("TopBarToolsMenu");
    expect(topBarVue).not.toContain("TopBarTurnDiffMenu");
    expect(topBarVue).not.toContain("TopBarMoreMenu");
  });

  it("queues approval requests instead of auto-declining them", () => {
    expect(requestResponderSource).toContain("useApprovalStore");
    expect(requestResponderSource).toContain("approvalStore.enqueue");
    expect(requestResponderSource).not.toContain("resolveAutoDeclineDecision");
    expect(requestResponderSource).not.toContain("permissions request declined automatically");
  });

  it("renders applyPatchApproval as a summary-first file list", () => {
    for (const text of ["申请原因", "授权根", "文件数", "applyPatchFileSummary", "applyPatchChangeBadgeText"]) {
      expect(topBarApprovalMenuVue).toContain(text);
    }
    expect(topBarApprovalMenuVue).toContain(':defaultOpen="false"');
  });

  it("closing the approval menu does not remove the active approval prompt", () => {
    expect(topBarApprovalMenuVue).toContain('@click="emit(\'close\')"');
    expect(topBarApprovalMenuVue).not.toContain("runtime.dismissActiveApprovalPrompt");
  });

  it("uses global approval config for new threads and turns", () => {
    expect(runtimeOrchestratorSource).toContain("configStore.draft.approvalPolicy");
    expect(runtimeOrchestratorSource).toContain("configStore.draft.approvalsReviewer");
    expect(runtimeOrchestratorSource).not.toContain('approvalPolicy: "never"');
  });
});
