import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

/**
 * killProc は win32 で taskkill.exe を spawn する。実プロセスに触れず・速く検証するため、
 * node:child_process の spawn をモックして「kill が試みられたか」だけ観測する。
 * 偽の子プロセスは EventEmitter で stdout/stderr/exit を手で発火する。
 */
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import { ProcessRegistry } from "./processRegistry";

type FakeProc = EventEmitter & {
  pid: number;
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
};

/** 偽の子プロセス：stdout/stderr/exit を手で発火できる EventEmitter。 */
function fakeProc(pid: number): FakeProc {
  const proc = new EventEmitter() as FakeProc;
  proc.pid = pid;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();
  return proc;
}

/** kill が試みられたかを、プラットフォーム差（win32=taskkill / 他=proc.kill）を吸収して判定。 */
function killedPid(pid: number, proc: FakeProc): boolean {
  if (process.platform === "win32") {
    return spawnMock.mock.calls.some(
      (call) => call[0] === "taskkill.exe" && Array.isArray(call[1]) && (call[1] as string[]).includes(String(pid))
    );
  }
  return proc.kill.mock.calls.length > 0;
}

describe("ProcessRegistry", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    // win32 の killProc は spawn の戻り値に .on / .unref を呼ぶ。
    spawnMock.mockReturnValue({ on: vi.fn(), unref: vi.fn() });
  });

  it("registers a process and lists it as running", () => {
    const reg = new ProcessRegistry();
    const proc = fakeProc(111);

    const id = reg.register(proc as unknown as ChildProcess, { command: "npm run dev" });

    expect(id).toMatch(/^proc_\d+$/);
    const list = reg.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      processId: id,
      command: "npm run dev",
      pid: 111,
      running: true,
      exitCode: null,
    });
  });

  it("accumulates stdout and stderr into the output ring buffer", () => {
    const reg = new ProcessRegistry();
    const proc = fakeProc(1);
    const id = reg.register(proc as unknown as ChildProcess, { command: "x" });

    proc.stdout.emit("data", Buffer.from("hello "));
    proc.stderr.emit("data", "world");

    expect(reg.getOutput(id)).toBe("hello world");
    expect(reg.list()[0].recentOutput).toBe("hello world");
  });

  it("marks a process exited and records the exit code on the exit event", () => {
    const reg = new ProcessRegistry();
    const proc = fakeProc(1);
    const id = reg.register(proc as unknown as ChildProcess, { command: "x" });

    proc.emit("exit", 0);

    const info = reg.list().find((entry) => entry.processId === id);
    expect(info?.running).toBe(false);
    expect(info?.exitCode).toBe(0);
  });

  it("getOutput returns null for an unknown processId", () => {
    const reg = new ProcessRegistry();
    expect(reg.getOutput("proc_999")).toBeNull();
  });

  it("stop() returns false for an unknown id and true for a known one", () => {
    const reg = new ProcessRegistry();
    const proc = fakeProc(222);
    const id = reg.register(proc as unknown as ChildProcess, { command: "x" });

    expect(reg.stop("proc_does_not_exist")).toBe(false);
    expect(reg.stop(id)).toBe(true);
    expect(killedPid(222, proc)).toBe(true);
  });

  it("killAll() stops running processes but skips already-exited ones", () => {
    const reg = new ProcessRegistry();
    const a = fakeProc(1);
    const b = fakeProc(2);
    reg.register(a as unknown as ChildProcess, { command: "a" });
    const idB = reg.register(b as unknown as ChildProcess, { command: "b" });

    // b は既に終了済み → killAll では触らない。
    b.emit("exit", 0);
    expect(reg.list().find((entry) => entry.processId === idB)?.running).toBe(false);

    spawnMock.mockClear();
    b.kill.mockClear();
    reg.killAll();

    expect(killedPid(1, a)).toBe(true);
    expect(killedPid(2, b)).toBe(false);
  });
});
