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

/**
 * requireApproval 是写改类工具（write_file / edit_file）的确认接缝：返回 false 即拒绝、不落盘，
 * 返回拒绝串让模型据此改路；只读类（read_file / list_dir）不应被它拦截。
 */
describe("createFileTools › requireApproval", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "agent-core-approval-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("blocks write_file when denied and applies it when granted", async () => {
    const denied = byName(createFileTools(root, { requireApproval: () => false }), "write_file");
    const msg = await denied.execute({ path: "a.txt", content: "hi" });
    expect(msg).toMatch(/Refused/i);
    await expect(readFile(join(root, "a.txt"), "utf8")).rejects.toThrow();

    const granted = byName(createFileTools(root, { requireApproval: () => true }), "write_file");
    await granted.execute({ path: "a.txt", content: "hi" });
    expect(await readFile(join(root, "a.txt"), "utf8")).toBe("hi");
  });

  it("blocks edit_file when denied, leaving the file untouched", async () => {
    await writeFile(join(root, "a.txt"), "hello world", "utf8");
    const edit = byName(createFileTools(root, { requireApproval: () => false }), "edit_file");

    const msg = await edit.execute({ path: "a.txt", oldString: "world", newString: "there" });
    expect(msg).toMatch(/Refused/i);
    expect(await readFile(join(root, "a.txt"), "utf8")).toBe("hello world");
  });

  it("passes the operation (tool/path/preview) to requireApproval", async () => {
    const ops: Array<{ tool: string; path: string; preview: string }> = [];
    const write = byName(
      createFileTools(root, {
        requireApproval: (op) => {
          ops.push(op);
          return true;
        },
      }),
      "write_file"
    );
    await write.execute({ path: "note.txt", content: "body-content" });
    expect(ops).toHaveLength(1);
    expect(ops[0].tool).toBe("write_file");
    expect(ops[0].path).toContain("note.txt");
    expect(ops[0].preview).toContain("body-content");
  });

  it("does not gate read-only tools on approval", async () => {
    await writeFile(join(root, "a.txt"), "data", "utf8");
    let called = false;
    const tools = createFileTools(root, {
      requireApproval: () => {
        called = true;
        return false;
      },
    });
    expect(await byName(tools, "read_file").execute({ path: "a.txt" })).toBe("data");
    expect(called).toBe(false);
  });
});
