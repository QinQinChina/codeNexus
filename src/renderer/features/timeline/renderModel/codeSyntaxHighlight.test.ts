import { describe, expect, it } from "vitest";
import { highlightCodeTokens, inferLanguageFromPath, normalizeCodeLanguage } from "./codeSyntaxHighlight";

describe("code syntax highlight", () => {
  it("normalizes markdown fence aliases to bundled Shiki languages", () => {
    expect(normalizeCodeLanguage("ts")).toBe("typescript");
    expect(normalizeCodeLanguage("language-js")).toBe("javascript");
    expect(normalizeCodeLanguage("unknown-language")).toBe("text");
  });

  it("infers supported languages from file paths", () => {
    expect(inferLanguageFromPath("src/app.ts")).toBe("typescript");
    expect(inferLanguageFromPath("package.json")).toBe("json");
    expect(inferLanguageFromPath("README.md")).toBe("markdown");
  });

  it("returns colored tokens for supported code fences", async () => {
    const lines = await highlightCodeTokens({
      code: 'const value: number = 1;\nconsole.log("ok");',
      language: "ts",
      tone: "dark",
    });

    expect(lines).toHaveLength(2);
    expect(lines.flat().some((token) => Boolean(token.style.color))).toBe(true);
    expect(lines.flat().map((token) => token.content).join("")).toContain("const value");
  });
});
