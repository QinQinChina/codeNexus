import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");
const textExtensions = new Set([".css", ".ts", ".vue"]);
const self = resolve(process.cwd(), "src/renderer/encoding/mojibake.test.ts");

function collectTextFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...collectTextFiles(path));
    } else if (textExtensions.has(extname(path))) {
      files.push(path);
    }
  }
  return files;
}

describe("source text encoding", () => {
  it("does not contain mojibake marker characters", () => {
    const offenders: string[] = [];

    for (const filePath of collectTextFiles(sourceRoot)) {
      if (filePath === self) continue;
      const text = readFileSync(filePath, "utf8");
      const lines = text.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/[\u0080-\u009f\ufffd\ue000-\uf8ff]/u.test(line) || line.includes("????????")) {
          offenders.push(`${relative(sourceRoot, resolve(filePath))}:${index + 1}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
