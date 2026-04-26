import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const useChatRenderModel = readFileSync("src/renderer/components/layout/useChatRenderModel.ts", "utf8");
const eventPipeline = readFileSync("src/renderer/processes/protocol-event-pipeline/installEventPipeline.ts", "utf8");

describe("stream notification activity rows", () => {
  it("does not drop fileChange output delta before it reaches the renderer", () => {
    expect(eventPipeline).not.toContain('if (n.method === "item/fileChange/outputDelta") return;');
  });

  it("renders ungrouped stream notifications as chat activity rows", () => {
    for (const method of [
      "item/fileChange/outputDelta",
      "command/exec/outputDelta",
      "item/commandExecution/terminalInteraction",
    ]) {
      expect(useChatRenderModel).toContain(method);
    }
    expect(useChatRenderModel).toContain("streamNotificationActivityText");
  });
});
