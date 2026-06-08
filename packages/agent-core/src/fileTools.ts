import { readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises";
import { resolve, dirname, relative, isAbsolute, join } from "node:path";
import type { ToolDefinition } from "./types";

/**
 * 一组最小可用的文件系统工具，全部限制在一个 rootDir 沙箱内。
 *
 * 安全要点：模型生成的 path 不可信，必须先解析成绝对路径、再确认它仍落在
 * rootDir 之内，杜绝 ../../ 之类的路径穿越读到沙箱外的文件。
 */

const MAX_READ_BYTES = 256 * 1024;

function resolveInsideRoot(rootDir: string, userPath: unknown): string {
  const root = resolve(rootDir);
  const raw = String(userPath ?? "").trim();
  if (!raw) throw new Error("path is required");
  const target = isAbsolute(raw) ? resolve(raw) : resolve(root, raw);
  const rel = relative(root, target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`path escapes sandbox root: ${raw}`);
  }
  return target;
}

export function createFileTools(rootDir: string): ToolDefinition[] {
  return [
    {
      name: "read_file",
      description: "Read the UTF-8 text contents of a file inside the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to the workspace root." },
        },
        required: ["path"],
      },
      execute: async (args) => {
        const target = resolveInsideRoot(rootDir, args.path);
        const info = await stat(target);
        if (!info.isFile()) throw new Error(`not a file: ${args.path}`);
        if (info.size > MAX_READ_BYTES) {
          throw new Error(`file too large (${info.size} bytes, limit ${MAX_READ_BYTES})`);
        }
        return await readFile(target, "utf8");
      },
    },
    {
      name: "list_dir",
      description: "List entries (files and folders) of a directory inside the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path relative to the workspace root. Use '.' for root." },
        },
        required: ["path"],
      },
      execute: async (args) => {
        const target = resolveInsideRoot(rootDir, args.path);
        const entries = await readdir(target, { withFileTypes: true });
        return entries
          .map((entry) => `${entry.isDirectory() ? "[dir] " : "[file] "}${entry.name}`)
          .join("\n");
      },
    },
    {
      name: "write_file",
      description: "Create or overwrite a UTF-8 text file inside the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to the workspace root." },
          content: { type: "string", description: "Full file contents to write." },
        },
        required: ["path", "content"],
      },
      execute: async (args) => {
        const target = resolveInsideRoot(rootDir, args.path);
        await mkdir(dirname(target), { recursive: true });
        const content = typeof args.content === "string" ? args.content : String(args.content ?? "");
        await writeFile(target, content, "utf8");
        return `wrote ${content.length} characters to ${join(".", relative(resolve(rootDir), target))}`;
      },
    },
    {
      name: "edit_file",
      description:
        "Replace an exact substring inside a file. The oldString must match exactly once in the file " +
        "(include enough surrounding context to make it unique). Prefer this over write_file when editing " +
        "an existing file, since it never overwrites unrelated content.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to the workspace root." },
          oldString: { type: "string", description: "Exact text to find. Must match exactly once." },
          newString: { type: "string", description: "Text to replace it with." },
        },
        required: ["path", "oldString", "newString"],
      },
      execute: async (args) => {
        const target = resolveInsideRoot(rootDir, args.path);
        const oldString = typeof args.oldString === "string" ? args.oldString : String(args.oldString ?? "");
        const newString = typeof args.newString === "string" ? args.newString : String(args.newString ?? "");
        if (!oldString) throw new Error("oldString is required and must be non-empty");

        const info = await stat(target);
        if (!info.isFile()) throw new Error(`not a file: ${args.path}`);
        const original = await readFile(target, "utf8");

        // 一意マッチ必須: 0 件なら見つからない、複数件なら曖昧なので拒否し、
        // モデルにより多くの文脈を含む oldString を出し直させる（Claude Code / codex の Edit と同方針）。
        const firstIndex = original.indexOf(oldString);
        if (firstIndex < 0) {
          throw new Error(`oldString not found in ${args.path}. Read the file and copy the exact text.`);
        }
        if (original.indexOf(oldString, firstIndex + oldString.length) >= 0) {
          const count = original.split(oldString).length - 1;
          throw new Error(
            `oldString matches ${count} times in ${args.path}; it must be unique. Add more surrounding context.`
          );
        }

        const updated = original.slice(0, firstIndex) + newString + original.slice(firstIndex + oldString.length);
        await writeFile(target, updated, "utf8");
        const rel = join(".", relative(resolve(rootDir), target));
        return `edited ${rel} (replaced ${oldString.length} chars with ${newString.length} chars)`;
      },
    },
  ];
}
