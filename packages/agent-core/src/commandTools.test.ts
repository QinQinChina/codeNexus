import { describe, it, expect, afterEach } from "vitest";
import { ProcessRegistry } from "./processRegistry";
import { createCommandTools } from "./commandTools";
import type { ToolDefinition } from "./types";

/**
 * commandTools は実 spawn を使う統合寄りのテスト。
 * run_command は実際に node を起動して exitCode/stdout を確認し、
 * start_process → list → stop の一連、危険コマンド拒否、確認フックを検証する。
 */

/** ツール配列から名前で 1 つ取り出す小ヘルパ。 */
function byName(tools: ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`tool not found: ${name}`);
  return tool;
}

describe("createCommandTools", () => {
  let registry: ProcessRegistry | undefined;

  afterEach(() => {
    // テストで起動したプロセスが残っていれば掃除。
    registry?.killAll();
    registry = undefined;
  });

  it("run_command runs a one-shot command and reports exit code + stdout", async () => {
    registry = new ProcessRegistry();
    const tools = createCommandTools({ cwd: process.cwd(), registry });

    const out = await byName(tools, "run_command").execute({ command: 'node -e "console.log(42)"' });

    expect(out).toContain("exitCode: 0");
    expect(out).toContain("42");
  });

  it("run_command surfaces a non-zero exit code", async () => {
    registry = new ProcessRegistry();
    const tools = createCommandTools({ cwd: process.cwd(), registry });

    const out = await byName(tools, "run_command").execute({ command: 'node -e "process.exit(3)"' });

    expect(out).toContain("exitCode: 3");
  });

  it("run_command kills a command that exceeds the timeout", async () => {
    registry = new ProcessRegistry();
    const tools = createCommandTools({ cwd: process.cwd(), registry });

    const out = await byName(tools, "run_command").execute({
      command: 'node -e "setTimeout(() => {}, 2000)"',
      timeoutMs: 200,
    });

    expect(out).toContain("killed (timeout)");
  });

  it("start_process registers a background process that list and stop can manage", async () => {
    registry = new ProcessRegistry();
    const tools = createCommandTools({ cwd: process.cwd(), registry });

    const started = await byName(tools, "start_process").execute({
      command: 'node -e "setTimeout(() => {}, 5000)"',
    });
    expect(started).toMatch(/proc_\d+/);

    const info = registry.list();
    expect(info).toHaveLength(1);
    expect(info[0].running).toBe(true);
    const processId = info[0].processId;

    const listed = await byName(tools, "list_processes").execute({});
    expect(listed).toContain(processId);
    expect(listed).toContain("running");

    const stopped = await byName(tools, "stop_process").execute({ processId });
    expect(stopped).toBe(`Stopped ${processId}.`);
  });

  it("get_process_output reports unknown processIds", async () => {
    registry = new ProcessRegistry();
    const tools = createCommandTools({ cwd: process.cwd(), registry });

    const out = await byName(tools, "get_process_output").execute({ processId: "proc_404" });

    expect(out).toContain("Unknown processId");
  });

  it("refuses obviously dangerous commands without spawning them", async () => {
    registry = new ProcessRegistry();
    const tools = createCommandTools({ cwd: process.cwd(), registry });

    const rm = await byName(tools, "run_command").execute({ command: "rm -rf /" });
    expect(rm).toContain("Refused");
    expect(rm).toContain("dangerous");

    // start_process も同じガードを通る。
    const start = await byName(tools, "start_process").execute({ command: "shutdown -h now" });
    expect(start).toContain("Refused");

    // 危険コマンドは spawn されないので registry には何も登録されない。
    expect(registry.list()).toHaveLength(0);
  });

  it("respects a requireConfirmation hook that denies the command", async () => {
    registry = new ProcessRegistry();
    const tools = createCommandTools({
      cwd: process.cwd(),
      registry,
      requireConfirmation: () => false,
    });

    const out = await byName(tools, "run_command").execute({ command: "node -v" });

    expect(out).toContain("Refused");
    expect(out).toContain("not confirmed");
  });
});
