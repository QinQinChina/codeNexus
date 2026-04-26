import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cardVue = readFileSync("src/renderer/components/timeline/cards/FileChangeCardContent.vue", "utf8");
const diffViewerVue = readFileSync("src/renderer/components/timeline/cards/UnifiedDiffViewer.vue", "utf8");
const chatCardVue = readFileSync("src/renderer/components/chat/ChatFileChangeCard.vue", "utf8");
const timelinePaneVue = readFileSync("src/renderer/components/layout/TimelinePane.vue", "utf8");

describe("streaming file change card UI", () => {
  it("exposes streaming metadata and a full-width chat mode", () => {
    expect(cardVue).toContain('mode?: "timeline" | "chat"');
    expect(cardVue).toContain("streamUpdateCount?: number");
    expect(cardVue).toContain("lastPatchUpdatedAt?: number | null");
    expect(cardVue).toContain("settledAt?: number | null");
    expect(cardVue).toContain("file-change-stream-strip");
  });

  it("renders file changes expanded by default without a collapsed preview", () => {
    expect(cardVue).toContain("file-change-card-header");
    expect(cardVue).toContain("file-change-card-meta");
    expect(cardVue).toContain("file-change-card-actions");
    expect(cardVue).toContain("<UnifiedDiffViewer");
    expect(cardVue).not.toContain("file-change-card-toggle");
    expect(cardVue).not.toContain("ChevronDown");
    expect(cardVue).not.toContain("aria-expanded");
    expect(cardVue).not.toContain("file-change-inline-preview");
    expect(cardVue).not.toContain("showInlinePreview");
    expect(cardVue).not.toContain("previewLines");
    expect(cardVue).not.toContain("isExpanded");
    expect(cardVue).not.toContain("inline-size: min(100%, 760px)");
    expect(cardVue).not.toContain('{{ isExpanded ? "收起" : "显示" }}');
  });

  it("passes live metadata from chat and timeline renderers", () => {
    expect(chatCardVue).toContain('mode="chat"');
    expect(chatCardVue).toContain(":streamUpdateCount=\"item.streamUpdateCount\"");
    expect(chatCardVue).toContain(":lastPatchUpdatedAt=\"item.lastPatchUpdatedAt\"");
    expect(chatCardVue).toContain(":settledAt=\"item.settledAt\"");

    expect(timelinePaneVue).toContain('mode="timeline"');
    expect(timelinePaneVue).toContain(":streamUpdateCount=\"node.item.streamUpdateCount\"");
    expect(timelinePaneVue).toContain(":lastPatchUpdatedAt=\"node.item.lastPatchUpdatedAt\"");
    expect(timelinePaneVue).toContain(":settledAt=\"node.item.settledAt\"");
  });

  it("disables diff line wrapping only for timeline file change cards", () => {
    expect(cardVue).toContain("wrapDiffLines?: boolean");
    expect(cardVue).toContain("wrapDiffLines: true");
    expect(cardVue).toContain(":wrapLines=\"wrapDiffLines\"");

    expect(timelinePaneVue).toContain(":wrapDiffLines=\"false\"");
    expect(chatCardVue).not.toContain("wrapDiffLines");
  });

  it("passes file kind into the diff viewer so raw added files can use added-line styling", () => {
    expect(cardVue).toContain(":fileKind=\"file.kind\"");
    expect(diffViewerVue).toContain("fileKind?: string");
    expect(diffViewerVue).toContain("isRawAddedFile");
    expect(diffViewerVue).toContain("displayLineKind");
    expect(diffViewerVue).toContain("!parsed.value.isUnified");
    expect(diffViewerVue).toContain('props.fileKind === "add"');
    expect(diffViewerVue).toContain('if (line.kind === "add" || line.kind === "del")');
    expect(diffViewerVue).not.toContain('if (kind === "add" || kind === "del")');
  });

  it("keeps diff rows tight to the left edge", () => {
    expect(diffViewerVue).not.toContain('class="grid items-start px-1.5 py-[1px]"');
    expect(diffViewerVue).toContain('class="grid items-start py-[1px]"');
    expect(diffViewerVue).toContain("grid-cols-[24px_minmax(0,1fr)]");
    expect(diffViewerVue).toContain("grid-cols-[30px_minmax(0,1fr)]");
    expect(diffViewerVue).toContain('compact ? "gap-1 text-[10.5px] leading-[1.34]"');
  });
});
