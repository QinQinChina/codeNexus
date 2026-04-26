import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const baseCss = readFileSync("src/renderer/styles/foundation/base.css", "utf8");

describe("application font family", () => {
  it("embeds Alibaba PuHuiTi 3 and Source Han Sans SC as selectable UI fonts", () => {
    expect(baseCss).toContain('@font-face');
    expect(baseCss).toContain('font-family: "Alibaba PuHuiTi 3"');
    expect(baseCss).toContain('font-family: "Source Han Sans SC"');
    expect(baseCss).toContain('../../assets/fonts/alibaba-puhuiti/AlibabaPuHuiTi-3-55-Regular.otf');
    expect(baseCss).toContain('../../assets/fonts/alibaba-puhuiti/AlibabaPuHuiTi-3-65-Medium.otf');
    expect(baseCss).toContain('../../assets/fonts/alibaba-puhuiti/AlibabaPuHuiTi-3-85-Bold.otf');
    expect(baseCss).toContain('../../assets/fonts/source-han-sans-sc/SourceHanSansSC-Regular.otf');
    expect(baseCss).toContain('../../assets/fonts/source-han-sans-sc/SourceHanSansSC-Medium.otf');
    expect(baseCss).toContain('../../assets/fonts/source-han-sans-sc/SourceHanSansSC-Bold.otf');
    expect(baseCss).toContain('--alibaba-puhuiti: "Alibaba PuHuiTi 3", "Microsoft YaHei UI", "Segoe UI", sans-serif;');
    expect(baseCss).toContain('--source-han-sans-sc: "Source Han Sans SC", "Microsoft YaHei UI", "Segoe UI", sans-serif;');
    expect(baseCss).toContain('--sans: var(--alibaba-puhuiti);');
    expect(baseCss).toContain('--ui-font: var(--alibaba-puhuiti);');
  });
});
