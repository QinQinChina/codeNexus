import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const composerVue = readFileSync("src/renderer/components/layout/ComposerPanel.vue", "utf8");
const composerCss = readFileSync("src/renderer/styles/composer.css", "utf8");
const componentTokensCss = readFileSync("src/renderer/theme/component-tokens.css", "utf8");

describe("composer mode visual states", () => {
  it("marks both agent and plan modes on the shell", () => {
    expect(composerVue).toContain("'is-agent': composeMode === 'default'");
    expect(composerVue).toContain("'is-plan': composeMode === 'plan'");
  });

  it("defines separate semantic tokens for agent and plan appearances", () => {
    for (const token of [
      "--composer-bg",
      "--composer-agent-bg",
      "--composer-agent-border",
      "--composer-agent-focus-ring",
      "--composer-plan-bg",
      "--composer-plan-border",
      "--composer-plan-focus-ring",
    ]) {
      expect(componentTokensCss).toContain(token);
    }
  });

  it("styles shell and mode toggle differently for agent and plan", () => {
    expect(composerCss).toContain(".composer-shell.is-agent");
    expect(composerCss).toContain(".composer-shell.is-plan");
    expect(composerCss).toContain(".composer-shell.is-agent .composer-mode-thumb");
    expect(composerCss).toContain(".composer-shell.is-plan .composer-mode-thumb");
    expect(composerCss).toContain(".composer-mode-button.is-agent.is-active");
    expect(composerCss).toContain(".composer-mode-button.is-plan.is-active");
  });

  it("keeps the composer shell visually docked instead of floating", () => {
    const shellClass = composerVue.match(/class="composer-shell[^"]+"/s)?.[0] ?? "";

    expect(shellClass).not.toContain("backdrop-blur");
    expect(shellClass).not.toContain("shadow-[");
    expect(shellClass).not.toContain("hover:shadow");
    expect(shellClass).not.toContain("focus-within:shadow");
    expect(composerCss).not.toContain("0 12px 48px");
    expect(composerCss).not.toContain("var(--composer-shell-shadow)");
    expect(composerCss).not.toContain("var(--light-shadow-md)");
    expect(composerCss).toContain("box-shadow: none !important");
  });
});
