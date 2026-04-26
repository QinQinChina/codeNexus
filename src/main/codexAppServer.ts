import { spawn } from "node:child_process";
import * as readline from "node:readline";
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import type {
  CodexIncomingMessage,
  CodexNotifyParams,
  CodexRpcParams,
  CodexRpcResult,
  JsonRpcId as ProtocolJsonRpcId,
} from "../shared/codex-protocol";

export type ServerMode = "native";

export type JsonRpcId = ProtocolJsonRpcId;

export type JsonRpcRequest = {
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcNotification = {
  method: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  id: JsonRpcId;
  result?: unknown;
  error?: unknown;
};

export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
};

function isJsonRpcId(value: unknown): value is JsonRpcId {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return false;
}

function isValidMethod(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidParams(value: unknown): boolean {
  if (value === undefined) return true;
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export class CodexAppServer {
  readonly id: string;
  private experimentalApiEnabled = false;
  private readonly experimentalApiOptIn: boolean;
  private readonly mode: ServerMode;
  private readonly cwd?: string;
  private proc?: ReturnType<typeof spawn>;
  private rl?: readline.Interface;
  private stopping = false;
  private nextId = 1;
  private readonly pending = new Map<JsonRpcId, Pending>();
  private onMessage?: (msg: CodexIncomingMessage) => void;
  private nativeCodex?:
    | { kind: "direct"; path: string }
    | { kind: "node"; nodeExe: string; script: string }
    | { kind: "cmd"; path: string };

  constructor(opts: {
    id: string;
    mode: ServerMode;
    cwd?: string;
    experimentalApiOptIn?: boolean;
    onMessage?: (msg: CodexIncomingMessage) => void;
  }) {
    this.id = opts.id;
    this.mode = opts.mode;
    this.cwd = opts.cwd;
    this.experimentalApiOptIn = Boolean(opts.experimentalApiOptIn);
    this.onMessage = opts.onMessage;
  }

  get running() {
    return Boolean(this.proc && !this.proc.killed);
  }

  get capabilities() {
    return { experimentalApi: this.experimentalApiEnabled };
  }

  async start(): Promise<void> {
    if (this.proc) throw new Error("server already started");

    if (this.mode === "native") this.preflightNative();

    const { command, args, spawnCwd } = this.getSpawnCommand();
    if (spawnCwd) this.ensureSpawnCwd(spawnCwd);
    this.proc = spawn(command, args, {
      cwd: spawnCwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      windowsVerbatimArguments: command.toLowerCase().endsWith("cmd.exe"),
    });
    this.stopping = false;

    const spawnFailed = new Promise<never>((_resolve, reject) => {
      this.proc?.once("error", (err: any) => {
        const missingWorkspace = Boolean(spawnCwd) && !existsSync(String(spawnCwd));
        const msg =
          err?.code === "ENOENT"
            ? missingWorkspace
              ? `工作区目录不存在：${spawnCwd}`
              : `找不到可执行文件：${command}`
            : String(err?.message ?? err);
        reject(new Error(`codex app-server 启动失败：${msg}`));
      });
    });

    this.proc.on("exit", (code, signal) => {
      const error = new Error(`codex app-server exited (code=${code}, signal=${signal})`);
      for (const [id, p] of this.pending.entries()) {
        clearTimeout(p.timeout);
        p.reject(error);
        this.pending.delete(id);
      }
      this.onMessage?.({ kind: "local", method: "codex/exit", params: { code, signal, expected: this.stopping } });
      this.stopping = false;
    });

    this.proc.stderr?.on("data", (buf) => {
      const text = buf.toString("utf8");
      this.onMessage?.({ kind: "local", method: "codex/stderr", params: { text } });
    });

    if (!this.proc.stdout || !this.proc.stdin) throw new Error("failed to start codex app-server");

    this.rl = readline.createInterface({ input: this.proc.stdout, crlfDelay: Infinity });
    this.rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg: any;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        this.onMessage?.({ kind: "local", method: "codex/parseError", params: { line: trimmed } });
        return;
      }
      this.handleIncoming(msg);
    });

    await Promise.race([this.initializeHandshake(), spawnFailed]);
  }

  stop(): void {
    if (!this.proc) return;
    this.stopping = true;
    try {
      this.proc.kill();
    } catch {}
    try {
      this.rl?.close();
    } catch {}
    this.proc = undefined;
    this.rl = undefined;
  }

  async request<M extends string>(
    method: M,
    params?: CodexRpcParams<M>,
    timeoutMs = 120_000
  ): Promise<CodexRpcResult<M>> {
    if (!isValidMethod(method)) throw new Error("invalid json-rpc method");
    if (!isValidParams(params)) throw new Error(`invalid json-rpc params for method: ${method}`);
    const id: JsonRpcId = this.nextId++;
    const req: JsonRpcRequest = { id, method: method.trim(), params };
    this.write(req);
    return await new Promise<CodexRpcResult<M>>((resolve, reject) => {
      const pending: Pending = {
        resolve: (value) => resolve(value as CodexRpcResult<M>),
        reject,
        timeout: setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`request timeout: ${method}`));
        }, timeoutMs),
      };
      this.pending.set(id, pending);
    });
  }

  notify<M extends string>(method: M, params?: CodexNotifyParams<M>): void {
    if (!isValidMethod(method)) throw new Error("invalid json-rpc method");
    if (!isValidParams(params)) throw new Error(`invalid json-rpc params for method: ${method}`);
    const n: JsonRpcNotification = { method: method.trim(), params };
    this.write(n);
  }

  respond(id: JsonRpcId, result?: unknown, error?: unknown): void {
    if (!isJsonRpcId(id)) throw new Error("invalid json-rpc id");
    const res: JsonRpcResponse = { id };
    if (error !== undefined) res.error = error;
    else res.result = result;
    this.write(res);
  }

  private write(msg: JsonRpcMessage): void {
    if (!this.proc?.stdin) throw new Error("server not running");
    this.proc.stdin.write(`${JSON.stringify(msg)}\n`);
  }

  private handleIncoming(msg: any) {
    if (typeof msg !== "object" || msg === null) {
      this.emitProtocolError("incoming message is not an object", msg);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(msg, "method")) {
      if (!isValidMethod(msg.method)) {
        this.emitProtocolError("invalid notification/request method", msg);
        return;
      }
      if (!isValidParams(msg.params)) {
        this.emitProtocolError("invalid notification/request params", msg);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(msg, "id") && !isJsonRpcId(msg.id)) {
        this.emitProtocolError("invalid request id", msg);
        return;
      }
      this.onMessage?.(
        (Object.prototype.hasOwnProperty.call(msg, "id")
          ? { kind: "request", ...msg }
          : { kind: "notification", ...msg }) as CodexIncomingMessage
      );
      return;
    }

    if (Object.prototype.hasOwnProperty.call(msg, "id")) {
      if (!isJsonRpcId(msg.id)) {
        this.emitProtocolError("invalid response id", msg);
        return;
      }
      const hasResult = Object.prototype.hasOwnProperty.call(msg, "result");
      const hasError = Object.prototype.hasOwnProperty.call(msg, "error");
      if (hasResult === hasError) {
        this.emitProtocolError("response must contain exactly one of result/error", msg);
        return;
      }
      const p = this.pending.get(msg.id);
      if (p) {
        clearTimeout(p.timeout);
        this.pending.delete(msg.id);
        if (hasError) p.reject(new Error(JSON.stringify(msg.error)));
        else p.resolve(msg.result);
      } else {
        this.onMessage?.({ kind: "local", method: "codex/unmatchedResponse", params: msg });
      }
      return;
    }

    this.emitProtocolError("unknown json-rpc envelope", msg);
  }

  private emitProtocolError(reason: string, message: unknown) {
    this.onMessage?.({
      kind: "local",
      method: "codex/protocolError",
      params: {
        reason,
        message,
      },
    });
  }

  private getSpawnCommand(): { command: string; args: string[]; spawnCwd?: string } {
    if (this.nativeCodex?.kind === "cmd") {
      const cmdline = this.cmdlineInvoke(this.nativeCodex.path, ["app-server", "--listen", "stdio://"]);
      return { command: "cmd.exe", args: ["/d", "/s", "/c", cmdline], spawnCwd: this.cwd };
    }
    if (this.nativeCodex?.kind === "node") {
      return {
        command: this.nativeCodex.nodeExe,
        args: [this.nativeCodex.script, "app-server", "--listen", "stdio://"],
        spawnCwd: this.cwd,
      };
    }
    if (this.nativeCodex?.kind === "direct") {
      return { command: this.nativeCodex.path, args: ["app-server", "--listen", "stdio://"], spawnCwd: this.cwd };
    }
    return {
      command: "codex",
      args: ["app-server", "--listen", "stdio://"],
      spawnCwd: this.cwd,
    };
  }

  private ensureSpawnCwd(spawnCwd: string): void {
    const cwd = String(spawnCwd ?? "").trim();
    if (!cwd) return;
    if (!existsSync(cwd)) {
      throw new Error(`工作区目录不存在：${cwd}`);
    }
    let stats: ReturnType<typeof statSync>;
    try {
      stats = statSync(cwd);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      throw new Error(`工作区目录不可访问：${cwd}（${msg}）`);
    }
    if (!stats.isDirectory()) {
      throw new Error(`工作区路径不是目录：${cwd}`);
    }
  }

  private preflightNative(): void {
    const found = spawnSync("where.exe", ["codex"], { encoding: "utf8" });
    let out = (found.stdout || "").trim();

    // 兜底：如果 codex 是通过 npm -g 安装但 PATH 尚未生效，尝试从默认前缀推断位置。
    // 与 systemChecks.detectCodexNative 的策略保持一致，避免“抽屉检测 OK，但启动报未安装”的不一致体验。
    if (found.status !== 0 || !out) {
      const appData = String(process.env.APPDATA || "").trim();
      if (appData) {
        const candidate = join(appData, "npm", "codex.cmd");
        if (existsSync(candidate)) out = candidate;
      }
    }

    if (!out) {
      throw new Error(
        "未检测到 codex（native）。请先安装 Node.js LTS（包含 npm），然后执行：npm i -g @openai/codex，并确保 codex 在 PATH 中可用（必要时重启终端/本应用）。"
      );
    }

    const paths = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const exe = paths.find((p) => p.toLowerCase().endsWith(".exe"));
    if (exe) {
      this.nativeCodex = { kind: "direct", path: exe };
      return;
    }

    const cmd = paths.find((p) => p.toLowerCase().endsWith(".cmd"));
    if (cmd) {
      const base = dirname(cmd);
      const nodeExe = join(base, "node.exe");
      const codexJs = join(base, "node_modules", "@openai", "codex", "bin", "codex.js");
      if (existsSync(nodeExe) && existsSync(codexJs)) {
        // 为避免 cmd.exe 转义/引号问题，直接以 node.exe 运行底层入口脚本。
        this.nativeCodex = { kind: "node", nodeExe, script: codexJs };
        return;
      }
      this.nativeCodex = { kind: "cmd", path: cmd };
      return;
    }

    const bat = paths.find((p) => p.toLowerCase().endsWith(".bat"));
    if (bat) {
      this.nativeCodex = { kind: "cmd", path: bat };
      return;
    }

    throw new Error(
      `已找到 codex 但未找到可执行入口（.exe/.cmd/.bat）。where.exe codex 返回：\n${paths.join("\n")}\n\n` +
        `请确认你能在 PowerShell 中直接运行：codex --version`
    );
  }

  private cmdlineInvoke(toolPath: string, args: string[]): string {
    // cmd.exe 引号/转义规则：使用 `cmd /d /s /c ""C:\path\tool.cmd" arg1 arg2"` 形式最稳妥。
    const joined = args.join(" ");
    return `""${toolPath}"${joined ? " " : ""}${joined}"`;
  }

  private async initializeHandshake(): Promise<void> {
    const initializeParams = {
      clientInfo: {
        name: "codex-electron-win",
        title: null,
        version: app.getVersion(),
      },
      capabilities: this.experimentalApiOptIn ? { experimentalApi: true } : null,
    };
    const result = await this.request("initialize", initializeParams);
    // 备注：Codex app-server 的 initialize result 往往只返回 userAgent，不会回显 capabilities。
    // 只要我们在 initialize params 中显式 opt-in，后续就应该按“已启用 experimentalApi”处理。
    this.experimentalApiEnabled = this.experimentalApiOptIn || this.detectExperimentalApiCapability(result);
    this.notify("initialized");
  }

  private detectExperimentalApiCapability(result: unknown): boolean {
    const fromRoot = this.readExperimentalApiFlag(result);
    if (typeof fromRoot === "boolean") return fromRoot;

    const capabilities =
      result && typeof result === "object" ? (result as Record<string, unknown>).capabilities : undefined;
    const fromCapabilities = this.readExperimentalApiFlag(capabilities);
    if (typeof fromCapabilities === "boolean") return fromCapabilities;

    return false;
  }

  private readExperimentalApiFlag(value: unknown): boolean | undefined {
    if (!value || typeof value !== "object") return undefined;
    const obj = value as Record<string, unknown>;
    const direct = obj.experimentalApi;
    if (typeof direct === "boolean") return direct;
    if (typeof direct === "string") {
      const normalized = direct.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }

    return undefined;
  }
}
