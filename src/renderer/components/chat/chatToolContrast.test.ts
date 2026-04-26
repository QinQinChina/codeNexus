import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const commandRow = readFileSync("src/renderer/components/chat/ChatCommandActionRow.vue", "utf8");
const fileChangeCard = readFileSync("src/renderer/components/timeline/cards/FileChangeCardContent.vue", "utf8");

describe("chat tool contrast styles", () => {
  it("keeps command action primary status readable in the chat timeline", () => {
    expect(commandRow).not.toMatch(/chat-terminal-action-line[^\"]*\bdim\b/);
    expect(commandRow).toContain("chat-terminal-action-icon--success");
    expect(commandRow).toContain("chat-terminal-action-icon--danger");
    expect(commandRow).toContain("chat-terminal-action-status--success");
    expect(commandRow).toContain("chat-terminal-action-status--danger");
    expect(commandRow).toContain("commandStatusClass");
    expect(commandRow).not.toContain("drop-shadow");
    expect(commandRow).not.toContain("#34f5a8");
    expect(commandRow).not.toContain("#ff6f86");
    expect(commandRow).not.toContain("#67e8f9");
    expect(commandRow).toContain("--chat-tool-success-fg");
    expect(commandRow).toContain("--chat-tool-danger-fg");
    expect(commandRow).toContain("--chat-tool-running-fg");
    expect(commandRow).toContain("color-mix(in srgb, var(--success, var(--fg-success))");
    expect(commandRow).toContain("color-mix(in srgb, var(--danger, var(--fg-danger))");
  });

  it("uses theme-strengthened, non-glowing file change line statistics", () => {
    expect(fileChangeCard).toContain("font-weight: 700");
    expect(fileChangeCard).toContain("--file-change-add-fg");
    expect(fileChangeCard).toContain("--file-change-del-fg");
    expect(fileChangeCard).toContain(":global(.timeline-pane--chat)");
    expect(fileChangeCard).not.toContain("text-shadow");
    expect(fileChangeCard).not.toContain("#34f5a8");
    expect(fileChangeCard).not.toContain("#ff6f86");
    expect(fileChangeCard).toContain("color-mix(in srgb, var(--success, var(--fg-success))");
    expect(fileChangeCard).toContain("color-mix(in srgb, var(--danger, var(--fg-danger))");
  });
});
