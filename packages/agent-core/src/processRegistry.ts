import { spawn, type ChildProcess } from "node:child_process";

/**
 * スレッド作用域のプロセス登録簿。
 *
 * 「起動コマンド（npm run dev のような長時間プロセス）」を一覧管理し、
 * スレッドが閉じるときに killAll() でまとめて停止する。これが「コマンドを
 * 対話スレッドに挂载する」の実体。
 *
 * codex 自身も ProcessSpawnParams.processHandle（connection-scoped）で同じ
 * 発想を採っているが、ここでは codex に依存せず agent-core 内で軽量実装する。
 */

/** 各プロセスが保持する出力リングバッファの上限（末尾 N バイトだけ残す）。 */
const OUTPUT_RING_BYTES = 64 * 1024;

/** list() / get_process_output で返すプロセス情報。 */
export type ProcessInfo = {
  processId: string;
  command: string;
  pid: number | undefined;
  startedAt: number;
  /** プロセスがまだ走っているか。 */
  running: boolean;
  /** 直近の stdout/stderr 合流出力（末尾 OUTPUT_RING_BYTES まで）。 */
  recentOutput: string;
  /** 終了済みなら exit code（未終了は null）。 */
  exitCode: number | null;
};

type RegistryEntry = {
  processId: string;
  command: string;
  proc: ChildProcess;
  startedAt: number;
  output: string;
  running: boolean;
  exitCode: number | null;
};

/** 末尾だけ残すリングバッファ追記。 */
function appendRing(current: string, chunk: string, limit: number): string {
  const next = current + chunk;
  return next.length > limit ? next.slice(next.length - limit) : next;
}

export class ProcessRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private nextId = 1;

  /**
   * 起動済みの子プロセスを登録し、processId を返す。
   *
   * stdout/stderr をリングバッファに蓄積し、exit でエントリを「running=false」に
   * 更新する（マップからは消さない＝終了後も get_process_output で出力を読めるように）。
   */
  register(proc: ChildProcess, meta: { command: string }): string {
    const processId = `proc_${this.nextId++}`;
    const entry: RegistryEntry = {
      processId,
      command: meta.command,
      proc,
      startedAt: Date.now(),
      output: "",
      running: true,
      exitCode: null,
    };
    this.entries.set(processId, entry);

    const onChunk = (buf: Buffer | string) => {
      entry.output = appendRing(entry.output, buf.toString(), OUTPUT_RING_BYTES);
    };
    proc.stdout?.on("data", onChunk);
    proc.stderr?.on("data", onChunk);
    proc.on("exit", (code) => {
      entry.running = false;
      entry.exitCode = typeof code === "number" ? code : null;
    });

    return processId;
  }

  /** 走っている / 終了済みを含む全プロセス情報の一覧。 */
  list(): ProcessInfo[] {
    return [...this.entries.values()].map((entry) => ({
      processId: entry.processId,
      command: entry.command,
      pid: entry.proc.pid,
      startedAt: entry.startedAt,
      running: entry.running,
      recentOutput: entry.output,
      exitCode: entry.exitCode,
    }));
  }

  /** 指定 processId の直近出力を返す（存在しなければ null）。 */
  getOutput(processId: string): string | null {
    return this.entries.get(processId)?.output ?? null;
  }

  /**
   * 個別プロセスを停止する。停止要求を出せたら true、未知の id は false。
   *
   * Windows は子プロセスツリーごと taskkill /t /f、他は proc.kill()。
   * （codexAppServer.ts の stop() のクロスプラットフォーム kill を踏襲）
   */
  stop(processId: string): boolean {
    const entry = this.entries.get(processId);
    if (!entry) return false;
    this.killProc(entry.proc);
    return true;
  }

  /** 全プロセスを停止する。スレッド終了時に呼ぶ想定。 */
  killAll(): void {
    for (const entry of this.entries.values()) {
      if (entry.running) this.killProc(entry.proc);
    }
  }

  private killProc(proc: ChildProcess): void {
    const pid = proc.pid;
    try {
      if (process.platform === "win32" && pid) {
        const killer = spawn("taskkill.exe", ["/pid", String(pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true,
        });
        killer.on("error", () => undefined);
        killer.unref();
      } else {
        proc.kill();
      }
    } catch {
      try {
        proc.kill();
      } catch {
        // 既に死んでいる等は無視。
      }
    }
  }
}
