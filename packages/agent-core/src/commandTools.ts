import { spawn } from "node:child_process";
import type { ProcessRegistry } from "./processRegistry";
import type { ToolDefinition } from "./types";

/**
 * コマンド実行系のツール群。
 *
 * 「実行して終わるもの（run_command）」と「起動して走り続けるもの（start_process）」を
 * 区分するのが核心。前者は終了を待って結果を返し、後者は registry に登録して即 return する。
 * 起動プロセスは registry を通じてスレッドに紐づき、スレッド終了時に killAll() で掃除される。
 *
 * コマンド文字列はモデル由来＝信頼しない前提。spawn は必ず sandbox cwd で行い、
 * 実行前に危険コマンドの前置チェックで明らかに破壊的なものを弾く。
 */

/** run_command の既定タイムアウト（ミリ秒）。 */
const DEFAULT_RUN_TIMEOUT_MS = 60_000;

/** ワンショット出力の上限（fileTools の MAX_READ_BYTES と同じ発想）。 */
const MAX_OUTPUT_BYTES = 256 * 1024;

/**
 * 明らかに破壊的なコマンドを検出する前置チェック。
 *
 * 完全な防御ではなく「事故防止の第一線」。実 UI 接続時には requireConfirmation で
 * ユーザー確認を挟む余地を残す（型だけ用意）。検出したら理由を返し、null なら許可。
 */
function detectDangerousCommand(command: string): string | null {
  const normalized = command.toLowerCase();
  const patterns: Array<{ re: RegExp; reason: string }> = [
    { re: /\brm\s+(-[a-z]*\s+)*-[a-z]*r[a-z]*f|\brm\s+-rf?\b/, reason: "recursive force delete (rm -rf)" },
    { re: /\bdel\s+\/[sq]/, reason: "recursive/quiet delete (del /s)" },
    { re: /\brmdir\s+\/s\b/, reason: "recursive directory removal (rmdir /s)" },
    { re: /\bformat\b\s+[a-z]:/, reason: "disk format" },
    { re: /\bmkfs\b/, reason: "filesystem creation (mkfs)" },
    { re: /\b(shutdown|reboot|halt|poweroff)\b/, reason: "system power control" },
    { re: /\bdd\s+.*\bof=\/dev\//, reason: "raw disk write (dd of=/dev/...)" },
    { re: />\s*\/dev\/sd[a-z]/, reason: "raw disk overwrite" },
    { re: /:\(\)\s*\{.*\}\s*;\s*:/, reason: "fork bomb" },
  ];
  for (const { re, reason } of patterns) {
    if (re.test(normalized)) return reason;
  }
  return null;
}

export type CommandToolsOptions = {
  /** sandbox 作業ディレクトリ（必須）。全コマンドはここで実行される。 */
  cwd: string;
  /** 起動プロセスを登録するスレッド作用域の registry。 */
  registry: ProcessRegistry;
  /**
   * 任意の確認フック。実 UI 接続時にユーザー確認ダイアログを挟むために型だけ用意。
   * true を返したコマンドのみ実行する。未指定なら常に許可。
   */
  requireConfirmation?: (command: string) => Promise<boolean> | boolean;
};

/** 末尾だけ残して上限に丸める。 */
function clampOutput(text: string): string {
  return text.length > MAX_OUTPUT_BYTES ? text.slice(text.length - MAX_OUTPUT_BYTES) : text;
}

export function createCommandTools(options: CommandToolsOptions): ToolDefinition[] {
  const { cwd, registry, requireConfirmation } = options;

  const guard = async (command: string): Promise<string | null> => {
    const danger = detectDangerousCommand(command);
    if (danger) return `Refused: command looks dangerous (${danger}). Rephrase or narrow the scope.`;
    if (requireConfirmation) {
      const ok = await requireConfirmation(command);
      if (!ok) return "Refused: command was not confirmed by the user.";
    }
    return null;
  };

  return [
    {
      name: "run_command",
      description:
        "Run a one-shot shell command that is expected to finish quickly (e.g. git status, node -v, npm test). " +
        "Waits for completion and returns exit code, stdout and stderr. " +
        "Do NOT use this for long-running processes like dev servers; use start_process for those.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command line to run." },
          timeoutMs: {
            type: "number",
            description: `Optional timeout in milliseconds (default ${DEFAULT_RUN_TIMEOUT_MS}).`,
          },
        },
        required: ["command"],
      },
      execute: async (args) => {
        const command = String(args.command ?? "").trim();
        if (!command) throw new Error("command is required");
        const refused = await guard(command);
        if (refused) return refused;

        const timeoutMs =
          typeof args.timeoutMs === "number" && args.timeoutMs > 0 ? args.timeoutMs : DEFAULT_RUN_TIMEOUT_MS;

        return await new Promise<string>((resolvePromise) => {
          const proc = spawn(command, { shell: true, cwd, windowsHide: true });
          let stdout = "";
          let stderr = "";
          let timedOut = false;

          const timer = setTimeout(() => {
            timedOut = true;
            try {
              proc.kill();
            } catch {
              // ignore
            }
          }, timeoutMs);

          proc.stdout?.on("data", (buf) => {
            stdout = clampOutput(stdout + buf.toString());
          });
          proc.stderr?.on("data", (buf) => {
            stderr = clampOutput(stderr + buf.toString());
          });
          proc.on("error", (err) => {
            clearTimeout(timer);
            resolvePromise(`Failed to spawn command: ${err.message}`);
          });
          proc.on("exit", (code) => {
            clearTimeout(timer);
            const parts = [
              `exitCode: ${timedOut ? "killed (timeout)" : (code ?? "null")}`,
              `stdout:\n${stdout || "(empty)"}`,
              `stderr:\n${stderr || "(empty)"}`,
            ];
            resolvePromise(parts.join("\n\n"));
          });
        });
      },
    },
    {
      name: "start_process",
      description:
        "Start a long-running process (e.g. npm run dev, vite) that keeps running. " +
        "Returns immediately with a processId; does NOT wait for output. " +
        "The process is tracked and will be stopped when the session ends. " +
        "Use list_processes / get_process_output / stop_process to manage it.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command line to start." },
        },
        required: ["command"],
      },
      execute: async (args) => {
        const command = String(args.command ?? "").trim();
        if (!command) throw new Error("command is required");
        const refused = await guard(command);
        if (refused) return refused;

        const proc = spawn(command, { shell: true, cwd, windowsHide: true });
        const processId = registry.register(proc, { command });
        return `Started "${command}" as ${processId} (pid ${proc.pid ?? "unknown"}). Running in background.`;
      },
    },
    {
      name: "list_processes",
      description: "List background processes started via start_process, with their status and recent output.",
      parameters: { type: "object", properties: {} },
      execute: () => {
        const list = registry.list();
        if (list.length === 0) return "No background processes.";
        return list
          .map((info) => {
            const status = info.running ? "running" : `exited (code ${info.exitCode ?? "null"})`;
            return `${info.processId} [${status}] pid=${info.pid ?? "?"} cmd="${info.command}"`;
          })
          .join("\n");
      },
    },
    {
      name: "get_process_output",
      description: "Get the recent stdout/stderr output of a background process by its processId.",
      parameters: {
        type: "object",
        properties: {
          processId: { type: "string", description: "The processId returned by start_process." },
        },
        required: ["processId"],
      },
      execute: (args) => {
        const processId = String(args.processId ?? "").trim();
        if (!processId) throw new Error("processId is required");
        const output = registry.getOutput(processId);
        if (output === null) return `Unknown processId: ${processId}`;
        return output || "(no output yet)";
      },
    },
    {
      name: "stop_process",
      description: "Stop a background process by its processId.",
      parameters: {
        type: "object",
        properties: {
          processId: { type: "string", description: "The processId returned by start_process." },
        },
        required: ["processId"],
      },
      execute: (args) => {
        const processId = String(args.processId ?? "").trim();
        if (!processId) throw new Error("processId is required");
        return registry.stop(processId) ? `Stopped ${processId}.` : `Unknown processId: ${processId}`;
      },
    },
  ];
}
