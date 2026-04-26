import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const themeSeedsCss = readFileSync("src/renderer/theme/theme-seeds.css", "utf8");
const tokensCss = readFileSync("src/renderer/theme/tokens.css", "utf8");
const componentTokensCss = readFileSync("src/renderer/theme/component-tokens.css", "utf8");
const centerCss = readFileSync("src/renderer/styles/layout/center/layout.css", "utf8");
const sidebarWorkspaceCss = readFileSync("src/renderer/styles/layout/sidebar/workspace.css", "utf8");
const composerCss = readFileSync("src/renderer/styles/composer.css", "utf8");

const lightSeedBlock = themeSeedsCss.slice(
  themeSeedsCss.indexOf(':root[data-theme="light"] {'),
  themeSeedsCss.indexOf(':root[data-theme="dark"] {')
);

describe("low-glare light theme", () => {
  it("defines a professional low-glare seed palette", () => {
    expect(lightSeedBlock).toContain("--theme-seed-bg: rgb(241 246 250);");
    expect(lightSeedBlock).toContain("--theme-seed-surface-1: rgb(248 251 253);");
    expect(lightSeedBlock).toContain("--theme-seed-elevated: rgb(255 255 255);");
    expect(lightSeedBlock).toContain("--theme-seed-accent: rgb(8 145 178);");
  });

  it("derives legacy-compatible semantic light tokens from seed tokens", () => {
    expect(tokensCss).toContain("--light-shell-bg: var(--theme-seed-bg);");
    expect(tokensCss).toContain("--light-panel-bg: var(--theme-seed-surface-1);");
    expect(tokensCss).toContain("--light-elevated-bg: var(--theme-seed-elevated);");
    expect(tokensCss).toContain("--button-primary-text: var(--theme-seed-accent-contrast);");
  });

  it("uses semantic light surfaces for global regions", () => {
    expect(componentTokensCss).toContain("--sidebar-bg: linear-gradient(180deg, var(--surface-1)");
    expect(componentTokensCss).toContain("--center-bg: linear-gradient(180deg, var(--bg)");
    expect(componentTokensCss).toContain("--topbar-bg: var(--surface-1);");
  });

  it("has light-specific chat and composer treatments", () => {
    expect(centerCss).toContain(':root[data-theme="light"] .timeline-pane--chat');
    expect(centerCss).toContain("var(--chat-pane-bg)");
    expect(composerCss).toContain(':root[data-theme="light"] .composer-shell');
    expect(composerCss).toContain("var(--light-elevated-bg)");
  });

  it("shares the chat pane surface with the light chat timeline", () => {
    expect(tokensCss).toContain("--chat-pane-bg");
    expect(centerCss).toContain("background: var(--chat-pane-bg);");
    expect(sidebarWorkspaceCss).not.toContain("chat-status");
  });
});
