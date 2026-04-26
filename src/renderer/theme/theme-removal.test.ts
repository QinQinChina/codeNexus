import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const themeStore = readFileSync("src/renderer/stores/theme.store.ts", "utf8");
const topBarThemeSwitch = readFileSync("src/renderer/components/layout/topbar/TopBarThemeSwitch.vue", "utf8");
const rendererIndex = readFileSync("src/renderer/index.html", "utf8");

function readCssFiles(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return readCssFiles(path);
      if (!entry.isFile() || !entry.name.endsWith(".css")) return "";
      return readFileSync(path, "utf8");
    })
    .join("\n");
}

describe("app theme removal", () => {
  it("exposes only light and dark as active app themes", () => {
    expect(themeStore).toContain('export type AppThemeName = "light" | "dark";');
    expect(themeStore).toContain('order: AppThemeName[] = ["light", "dark"]');
    expect(topBarThemeSwitch).toContain('const themeOrder: AppThemeName[] = ["light", "dark"];');
    expect(rendererIndex).toContain('raw === "light" || raw === "dark"');

    expect(topBarThemeSwitch).not.toContain("windsurf");
    expect(topBarThemeSwitch).not.toContain("aurora");
    expect(topBarThemeSwitch).not.toContain("moss");
  });

  it("migrates removed persisted theme names to dark", () => {
    expect(themeStore).toContain('if (raw === "windsurf" || raw === "aurora" || raw === "moss") return "dark";');
  });

  it("keeps CSS theme selectors limited to light and dark", () => {
    const css = `${readCssFiles("src/renderer/theme")}\n${readCssFiles("src/renderer/styles")}`;
    const themes = Array.from(css.matchAll(/data-theme="([^"]+)"/g), (match) => match[1]);
    expect(Array.from(new Set(themes)).sort()).toEqual(["dark", "light"]);
  });
});
