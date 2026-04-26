import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const typographyStore = readFileSync("src/renderer/stores/typography.store.ts", "utf8");
const baseCss = readFileSync("src/renderer/styles/foundation/base.css", "utf8");

describe("typography font family presets", () => {
  it("only exposes the two bundled Chinese UI fonts", () => {
    expect(typographyStore).toContain('{ value: "alibaba-puhuiti", label: "阿里巴巴普惠体" }');
    expect(typographyStore).toContain('{ value: "source-han-sans-sc", label: "思源黑体" }');
    expect(typographyStore).not.toContain('value: "system"');
    expect(typographyStore).not.toContain('value: "serif"');
    expect(typographyStore).not.toContain('value: "mono"');
    expect(typographyStore).not.toContain('value: "cursive"');
    expect(typographyStore).not.toContain('value: "fangsong"');
  });

  it("maps font presets to bundled font faces instead of legacy style categories", () => {
    expect(baseCss).toContain('font-family: "Alibaba PuHuiTi 3"');
    expect(baseCss).toContain('font-family: "Source Han Sans SC"');
    expect(baseCss).toContain(':root[data-font-family="alibaba-puhuiti"]');
    expect(baseCss).toContain(':root[data-font-family="source-han-sans-sc"]');
    expect(baseCss).not.toContain(':root[data-font-family="system"]');
    expect(baseCss).not.toContain(':root[data-font-family="serif"]');
    expect(baseCss).not.toContain(':root[data-font-family="mono"]');
    expect(baseCss).not.toContain(':root[data-font-family="cursive"]');
    expect(baseCss).not.toContain(':root[data-font-family="fangsong"]');
  });
});
