import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const themeSeedsCss = readIfExists("src/renderer/theme/theme-seeds.css");
const semanticTokensCss = readFileSync("src/renderer/theme/tokens.css", "utf8");
const componentTokensCss = readIfExists("src/renderer/theme/component-tokens.css");
const stylesIndexCss = readFileSync("src/renderer/styles/index.css", "utf8");
const tailwindConfig = readFileSync("tailwind.config.cjs", "utf8");

const rawColorPattern = /(?<![\w-])#[0-9a-fA-F]{3,8}(?![\w-])|\brgba?\((?!from\s+var\()/g;
const allowedRawColorFiles = new Set([
  "src/renderer/theme/theme-seeds.css",
  "src/renderer/ui/confetti.ts",
  "src/renderer/components/ui/WaterBallProgress.vue",
]);

function readFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    const normalizedPath = path.replace(/\\/g, "/");
    if (normalizedPath.includes("/dist/")) return [];
    if (entry.isDirectory()) return readFiles(path);
    if (!entry.isFile()) return [];
    if (entry.name.endsWith(".test.ts")) return [];
    if (!/\.(css|ts|vue)$/.test(entry.name)) return [];
    return [normalizedPath];
  });
}

function cssBlock(source: string, selector: string): string {
  const match = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[\\s\\S]*?\\}`).exec(source);
  return match?.[0] ?? "";
}

describe("theme color system", () => {
  it("uses a layered CSS token import order", () => {
    const order = [
      '@import "../theme/theme-seeds.css";',
      '@import "../theme/tokens.css";',
      '@import "../theme/component-tokens.css";',
      '@import "../theme/app-themes.css";',
    ];

    let lastIndex = -1;
    for (const importLine of order) {
      const nextIndex = stylesIndexCss.indexOf(importLine);
      expect(nextIndex).toBeGreaterThan(lastIndex);
      lastIndex = nextIndex;
    }
  });

  it("defines light and dark seed palettes with blue-cyan accents", () => {
    expect(themeSeedsCss).toContain(':root[data-theme="light"]');
    expect(themeSeedsCss).toContain(':root[data-theme="dark"]');
    expect(themeSeedsCss).toContain("--theme-seed-accent: rgb(8 145 178);");
    expect(themeSeedsCss).toContain("--theme-seed-accent: rgb(45 180 196);");
    expect(themeSeedsCss).toContain("--theme-seed-bg");
    expect(themeSeedsCss).toContain("--theme-seed-surface-1");
    expect(themeSeedsCss).toContain("--theme-seed-text");
  });

  it("derives semantic and component tokens from seed tokens", () => {
    for (const token of ["--bg", "--surface-1", "--surface-2", "--surface-3", "--text", "--border", "--accent"]) {
      expect(semanticTokensCss).toContain(`${token}:`);
    }

    for (const token of [
      "--topbar-bg",
      "--sidebar-bg",
      "--center-bg",
      "--composer-bg",
      "--chat-pane-bg",
      "--timeline-item-bg",
      "--button-bg",
      "--card-bg",
    ]) {
      expect(componentTokensCss).toContain(`${token}:`);
    }
  });

  it("exposes semantic colors to Tailwind utilities", () => {
    for (const token of ["ui-bg", "ui-surface", "ui-muted", "ui-border", "ui-accent"]) {
      expect(tailwindConfig).toContain(`"${token}"`);
    }
  });

  it("keeps raw UI colors inside theme seed files or documented algorithmic exceptions", () => {
    const offenders = readFiles("src/renderer")
      .filter((file) => !allowedRawColorFiles.has(file))
      .flatMap((file) => {
        const text = readFileSync(file, "utf8");
        return Array.from(text.matchAll(rawColorPattern), (match) => {
          const line = text.slice(0, match.index).split(/\r?\n/).length;
          return `${relative(process.cwd(), file)}:${line} ${match[0]}`;
        });
      });

    expect(offenders).toEqual([]);
  });

  it("does not pass gradient tokens into color-mix", () => {
    expect(componentTokensCss).not.toMatch(/color-mix\([\s\S]*?var\(--panel-bg\)/);
  });

  it("uses theme-specific solid semantic mixes for file change diff row backgrounds", () => {
    const lightBlock = cssBlock(componentTokensCss, ':root[data-theme="light"]');
    const darkBlock = cssBlock(componentTokensCss, ':root[data-theme="dark"]');

    expect(lightBlock).toContain("--diff-add-bg: color-mix(in srgb, var(--success) 16%, var(--surface-1) 84%);");
    expect(lightBlock).toContain("--diff-del-bg: color-mix(in srgb, var(--danger) 14%, var(--surface-1) 86%);");
    expect(darkBlock).toContain("--diff-add-bg: color-mix(in srgb, var(--success) 24%, var(--bg) 76%);");
    expect(darkBlock).toContain("--diff-del-bg: color-mix(in srgb, var(--danger) 24%, var(--bg) 76%);");
    expect(componentTokensCss).not.toContain("--diff-add-bg: rgb(from var(--success) r g b /");
    expect(componentTokensCss).not.toContain("--diff-del-bg: rgb(from var(--danger) r g b /");
  });
});
