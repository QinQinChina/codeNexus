/**
 * 可运行的 demo：用真实模型驱动 agent 内核，让它通过文件 / 命令工具完成一个任务。
 *
 * 这是把内核「点火」的入口——它把几块拼到一起：
 *   ChatCompletionsClient(真实模型) + fileTools + commandTools + ProcessRegistry + runAgent + 命令行任务
 *
 * 命令工具区分两类：run_command（一次性，等结束）与 start_process（长时进程，登记到 registry）。
 * registry 是「线程作用域」的进程登记簿：demo 结束时在 finally 里 killAll()，把启动的进程全部清掉，
 * 这就是「把启动命令挂载到对话线程、线程关闭即回收」的最小演示。
 *
 * 运行方式（key 从环境变量读，不写进仓库）：
 *   AGENT_API_KEY=sk-xxx pnpm --filter @codenexus/agent-core demo "列出 src，读 package.json 的 version，再跑 node -v"
 *
 * 可选环境变量：
 *   AGENT_BASE_URL   默认 https://newapi.huiqing.cyou/v1
 *   AGENT_MODEL      默认 gpt-5.5
 *   AGENT_ROOT       工具沙箱根目录，默认当前工作目录
 */

import { runAgent } from "./runAgent";
import { createChatCompletionsClient } from "./chatCompletionsClient";
import { createFileTools } from "./fileTools";
import { createCommandTools } from "./commandTools";
import { ProcessRegistry } from "./processRegistry";
import type { AgentEvent, AgentMessage } from "./types";

const DEFAULT_BASE_URL = "https://newapi.huiqing.cyou/v1";
const DEFAULT_MODEL = "gpt-5.5";

const SYSTEM_PROMPT = [
  "You are a coding assistant operating inside a local workspace.",
  "You can read, list, write and edit files, and run shell commands using the provided tools.",
  "Use run_command for one-shot commands that finish quickly (e.g. node -v, git status);",
  "use start_process for long-running processes (e.g. dev servers) and manage them with list_processes / get_process_output / stop_process.",
  "Use tools to gather facts before answering; do not guess file contents.",
  "When the task is complete, reply with a concise final answer (no tool call).",
].join(" ");

function logEvent(event: AgentEvent): void {
  switch (event.type) {
    case "assistant_message":
      console.log(`\n[assistant] ${event.content}`);
      break;
    case "tool_call":
      console.log(`[tool→] ${event.call.name}(${event.call.arguments})`);
      break;
    case "tool_result": {
      const preview = event.result.length > 200 ? `${event.result.slice(0, 200)}…` : event.result;
      console.log(`[tool←] ${event.name}: ${preview.replace(/\n/g, "\\n")}`);
      break;
    }
    case "tool_error":
      console.log(`[tool✗] ${event.name}: ${event.error}`);
      break;
    case "max_steps_reached":
      console.log(`[!] reached max steps (${event.steps})`);
      break;
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.AGENT_API_KEY?.trim();
  if (!apiKey) {
    console.error("Missing AGENT_API_KEY environment variable.");
    process.exit(1);
  }

  const task =
    process.argv.slice(2).join(" ").trim() ||
    "List the workspace root, then read package.json and tell me its name and version.";

  const baseUrl = process.env.AGENT_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const model = process.env.AGENT_MODEL?.trim() || DEFAULT_MODEL;
  const rootDir = process.env.AGENT_ROOT?.trim() || process.cwd();

  console.log(`base : ${baseUrl}`);
  console.log(`model: ${model}`);
  console.log(`root : ${rootDir}`);
  console.log(`task : ${task}\n`);

  const client = createChatCompletionsClient({ baseUrl, apiKey, model });
  // registry 是线程作用域的进程登记簿：start_process 启动的进程登记在此，
  // demo 结束时在 finally 里 killAll() 统一回收（= 线程关闭即清理）。
  const registry = new ProcessRegistry();
  const tools = [...createFileTools(rootDir), ...createCommandTools({ cwd: rootDir, registry })];
  const messages: AgentMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: task },
  ];

  try {
    const result = await runAgent({ client, tools, messages, maxSteps: 12, onEvent: logEvent });

    console.log("\n──────── result ────────");
    console.log(`steps           : ${result.steps}`);
    console.log(`stoppedByMaxStep: ${result.stoppedByMaxSteps}`);
    console.log(`final answer    :\n${result.finalText}`);
  } finally {
    // 线程关闭即回收：把本次 demo 启动的所有后台进程清掉，演示「挂载到对话线程」的生命周期。
    const running = registry.list().filter((proc) => proc.running);
    if (running.length > 0) {
      const ids = running.map((proc) => proc.processId).join(", ");
      console.log(`\n[cleanup] killing ${running.length} background process(es): ${ids}`);
    }
    registry.killAll();
  }
}

main().catch((error: unknown) => {
  console.error("\n[demo failed]", error instanceof Error ? error.message : error);
  process.exit(1);
});
