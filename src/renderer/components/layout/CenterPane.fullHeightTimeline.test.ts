import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const centerPane = readFileSync("src/renderer/components/layout/CenterPane.vue", "utf8");
const statusCss = readFileSync("src/renderer/styles/layout/center/status.css", "utf8");

describe("center pane full-height timeline layout", () => {
  it("renders the plan summary inside the timeline scroll container before chat content", () => {
    const timelineIndex = centerPane.indexOf('id="timeline"');
    const planSummaryIndex = centerPane.indexOf("<PlanSummaryPanel");
    const chatPaneIndex = centerPane.indexOf("<ChatPane");

    expect(timelineIndex).toBeGreaterThanOrEqual(0);
    expect(planSummaryIndex).toBeGreaterThan(timelineIndex);
    expect(chatPaneIndex).toBeGreaterThan(planSummaryIndex);
    expect(centerPane).toContain('class="timeline-plan-summary-sticky"');
  });

  it("keeps the composer outside the timeline scroll content", () => {
    const timelineIndex = centerPane.indexOf('id="timeline"');
    const timelineCloseIndex = centerPane.indexOf("</div>", centerPane.indexOf("<ChatPane"));
    const composerIndex = centerPane.indexOf("<ComposerPanel");

    expect(timelineIndex).toBeGreaterThanOrEqual(0);
    expect(timelineCloseIndex).toBeGreaterThan(timelineIndex);
    expect(composerIndex).toBeGreaterThan(timelineCloseIndex);
  });

  it("does not pass virtualizer layout revisions into the chat pane", () => {
    expect(centerPane).toContain('import { useTimelineScrollController } from "./useTimelineScrollController"');
    expect(centerPane).not.toContain(':layoutRevision="timelineLayoutRevision"');
    expect(centerPane).toContain("timelineScrollController");
    expect(centerPane).toContain("bumpTimelineLayoutRevision");
  });

  it("centralizes timeline scroll-to-bottom behavior in the scroll controller", () => {
    expect(centerPane).toContain("forceFollowBottom");
    expect(centerPane).not.toContain("function requestAutoScrollToBottom");
    expect(centerPane).not.toContain("let pendingAutoScrollRafId");
    expect(centerPane).not.toContain("el.scrollTo({ top: el.scrollHeight");
  });

  it("does not reserve separate grid rows for plan summary or composer in chat mode", () => {
    expect(statusCss).toContain(".timeline-pane.timeline-pane--with-plan");
    expect(statusCss).toContain(".timeline-pane.timeline-pane--no-plan");
    expect(statusCss).toContain("grid-template-rows: minmax(0, 1fr)");
    expect(statusCss).not.toContain("auto minmax(0, 1fr) auto");
    expect(statusCss).not.toContain("minmax(0, 1fr) auto");
  });
});
