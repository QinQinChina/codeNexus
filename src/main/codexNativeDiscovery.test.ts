import { describe, expect, it } from "vitest";
import { discoverExistingCodexPaths, npmCodexCmdPathFromAppData, splitWhereOutput } from "./codexNativeDiscovery";

describe("codex native discovery", () => {
  it("keeps existing unicode paths returned by where.exe", () => {
    const unicodePath = "C:\\Users\\张三\\AppData\\Roaming\\npm\\codex.cmd";
    const paths = discoverExistingCodexPaths({
      whereStdout: `${unicodePath}\r\n`,
      appData: "C:\\Users\\张三\\AppData\\Roaming",
      exists: (path) => path === unicodePath,
    });

    expect(paths).toEqual([unicodePath]);
  });

  it("falls back to APPDATA when where.exe output decodes to a non-existing path", () => {
    const mojibakePath = "C:\\Users\\���\\AppData\\Roaming\\npm\\codex.cmd";
    const appDataPath = npmCodexCmdPathFromAppData("C:\\Users\\张三\\AppData\\Roaming");

    const paths = discoverExistingCodexPaths({
      whereStdout: `${mojibakePath}\n`,
      appData: "C:\\Users\\张三\\AppData\\Roaming",
      exists: (path) => path === appDataPath,
    });

    expect(paths).toEqual([appDataPath]);
  });

  it("deduplicates the APPDATA fallback when where.exe already found it", () => {
    const appDataPath = npmCodexCmdPathFromAppData("C:\\Users\\张三\\AppData\\Roaming");
    const paths = discoverExistingCodexPaths({
      whereStdout: `${appDataPath}\n`,
      appData: "C:\\Users\\张三\\AppData\\Roaming",
      exists: (path) => path === appDataPath,
    });

    expect(paths).toEqual([appDataPath]);
  });

  it("splits where.exe output without empty lines", () => {
    expect(splitWhereOutput("a\r\n\r\n b \n")).toEqual(["a", "b"]);
  });
});
