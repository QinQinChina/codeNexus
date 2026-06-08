import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileTools } from "./fileTools";
import type { ToolDefinition } from "./types";

/**
 * edit_file 的核心是「唯一匹配必须」：oldString 必须在文件里恰好出现一次。
 * 0 次 → 报错让模型重抄；多次 → 报错让模型补足上下文；1 次 → 精确替换。
 * 同时复用 resolveInsideRoot 的沙箱约束，越界路径直接拒绝。
 */

function byName(tools: ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`tool not found: ${name}`);
  return tool;
}

describe("createFileTools › edit_file", () => {
  let root: string;
  let edit: ToolDefinition;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "agent-core-edit-"));
    edit = byName(createFileTools(root), "edit_file");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("replaces a unique occurrence and writes the file back", async () => {
    await writeFile(join(root, "a.txt"), "hello world", "utf8");

    const msg = await edit.execute({ path: "a.txt", oldString: "world", newString: "there" });

    expect(msg).toContain("edited");
    expect(await readFile(join(root, "a.txt"), "utf8")).toBe("hello there");
  });

  it("errors when the oldString is not found", async () => {
    await writeFile(join(root, "a.txt"), "hello world", "utf8");

    await expect(
      Promise.resolve(edit.execute({ path: "a.txt", oldString: "absent", newString: "x" }))
    ).rejects.toThrow(/not found/i);
  });

  it("errors when the oldString matches more than once, leaving the file untouched", async () => {
    await writeFile(join(root, "dup.txt"), "x x x", "utf8");

    await expect(
      Promise.resolve(edit.execute({ path: "dup.txt", oldString: "x", newString: "y" }))
    ).rejects.toThrow(/must be unique/i);

    expect(await readFile(join(root, "dup.txt"), "utf8")).toBe("x x x");
  });

  it("refuses to edit a path that escapes the sandbox root", async () => {
    await expect(
      Promise.resolve(edit.execute({ path: "../escape.txt", oldString: "a", newString: "b" }))
    ).rejects.toThrow(/escapes sandbox/i);
  });
});
