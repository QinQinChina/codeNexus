// 自定义运行时聊天 Store：脱离 codex-app-server，通过 IPC agent.run 驱动 agent-core 内核。
//
// 流式：发送时生成 runId 并推入一条「占位助手消息」；主进程经 agent:event 回吐事件，按 runId 关联：
//   - delta：文本增量，追加到该消息 content
//   - tool_call / tool_result / tool_error：工具活动，记到该消息的 tools[]
//   - approval_request：写改/命令需审批，挂到 pendingApprovals，由 UI 弹卡片回传决策
// run() 的 Promise 返回最终文本（权威，覆盖累积增量）。
// 仍用最简消息列表（不复用 Codex 时间线渲染——其事件形状与 Codex 协议耦合）。
import { defineStore } from "pinia";
import { codexDesktop } from "../api/codexDesktopClient";

export type CustomChatRole = "user" | "assistant";

// 一次工具调用的活动记录（展示用）。
export type CustomToolActivity = {
  callId: string;
  name: string;
  argsText: string;
  status: "running" | "done" | "error";
  resultText?: string;
  error?: string;
};

// 一条挂起的审批请求（命令/写改），等待用户同意或拒绝。
export type CustomApprovalRequest = {
  runId: string;
  approvalId: string;
  kind: "command" | "file";
  title: string;
  detail: string;
};

export type CustomChatMessage = {
  id: string;
  role: CustomChatRole;
  content: string;
  // 本地错误占位（runtime/provider 报错），不计入发往模型的对话历史。
  error?: boolean;
  // 流式期间用 runId 关联本条助手消息；完成后清除。
  runId?: string;
  streaming?: boolean;
  // 本轮内的工具活动（read/write/命令等），按到达顺序展示。
  tools?: CustomToolActivity[];
  // 思考/推理文本（provider 开启 thinking 时流式累积）；展示用，不发回模型。
  reasoning?: string;
};

let messageSeq = 0;
function nextMessageId(prefix: string): string {
  messageSeq += 1;
  return `${prefix}-${Date.now()}-${messageSeq}`;
}

let runSeq = 0;
function nextRunId(): string {
  runSeq += 1;
  return `run-${Date.now()}-${runSeq}`;
}

// 模块级：流式订阅只装一次。
let streamUnsubscribe: (() => void) | null = null;

export const useCustomChatStore = defineStore("customChat", {
  state: () => ({
    messages: [] as CustomChatMessage[],
    pendingApprovals: [] as CustomApprovalRequest[],
    sending: false,
  }),
  actions: {
    reset() {
      this.messages = [];
      this.pendingApprovals = [];
      this.sending = false;
    },
    // 幂等订阅主进程的流式事件。
    ensureStreamSubscription() {
      if (streamUnsubscribe) return;
      streamUnsubscribe = codexDesktop.agent.onEvent((event) => {
        switch (event.type) {
          case "delta":
            this.applyDelta(event.runId, event.text);
            break;
          case "reasoning":
            this.applyReasoning(event.runId, event.text);
            break;
          case "tool_call":
            this.startTool(event.runId, event.callId, event.name, event.argsText);
            break;
          case "tool_result":
            this.finishTool(event.runId, event.callId, "done", { resultText: event.resultText });
            break;
          case "tool_error":
            this.finishTool(event.runId, event.callId, "error", { error: event.error });
            break;
          case "approval_request":
            this.pendingApprovals.push({
              runId: event.runId,
              approvalId: event.approvalId,
              kind: event.kind,
              title: event.title,
              detail: event.detail,
            });
            break;
        }
      });
    },
    findAssistantByRun(runId: string): CustomChatMessage | undefined {
      return this.messages.find((item) => item.runId === runId && item.role === "assistant");
    },
    applyDelta(runId: string, text: string) {
      const message = this.findAssistantByRun(runId);
      if (message) message.content += text;
    },
    applyReasoning(runId: string, text: string) {
      const message = this.findAssistantByRun(runId);
      if (message) message.reasoning = (message.reasoning ?? "") + text;
    },
    startTool(runId: string, callId: string, name: string, argsText: string) {
      const message = this.findAssistantByRun(runId);
      if (!message) return;
      if (!message.tools) message.tools = [];
      message.tools.push({ callId, name, argsText, status: "running" });
    },
    finishTool(
      runId: string,
      callId: string,
      status: "done" | "error",
      patch: { resultText?: string; error?: string }
    ) {
      const message = this.findAssistantByRun(runId);
      const tool = message?.tools?.find((item) => item.callId === callId);
      if (!tool) return;
      tool.status = status;
      if (patch.resultText !== undefined) tool.resultText = patch.resultText;
      if (patch.error !== undefined) tool.error = patch.error;
    },
    // 用户在审批卡片上点同意/拒绝：回传决策并从队列移除。
    async respondApproval(approvalId: string, approved: boolean) {
      const idx = this.pendingApprovals.findIndex((item) => item.approvalId === approvalId);
      if (idx < 0) return;
      const request = this.pendingApprovals[idx];
      this.pendingApprovals.splice(idx, 1);
      await codexDesktop.agent.approve({ runId: request.runId, approvalId, approved });
    },
    async send(text: string): Promise<void> {
      const content = String(text ?? "").trim();
      if (!content || this.sending) return;
      this.ensureStreamSubscription();

      this.messages.push({ id: nextMessageId("user"), role: "user", content });
      // 历史在推入「占位助手消息」之前快照，避免把空占位发给模型。
      const history = this.messages
        .filter((item) => !item.error)
        .map((item) => ({ role: item.role, content: item.content }));

      const runId = nextRunId();
      const assistantId = nextMessageId("assistant");
      this.messages.push({ id: assistantId, role: "assistant", content: "", runId, streaming: true });
      this.sending = true;
      try {
        const result = await codexDesktop.agent.run({ runId, messages: history });
        const message = this.messages.find((item) => item.id === assistantId);
        if (message) {
          message.streaming = false;
          message.runId = undefined;
          if (result.ok) {
            message.content = result.finalText || message.content || "(模型返回了空内容)";
          } else {
            message.content = result.error;
            message.error = true;
          }
        }
      } catch (error: unknown) {
        const messageText = error instanceof Error ? error.message : String(error);
        const message = this.messages.find((item) => item.id === assistantId);
        if (message) {
          message.streaming = false;
          message.runId = undefined;
          message.content = messageText;
          message.error = true;
        }
      } finally {
        // 本轮残留的挂起审批（理论上主进程已兜底拒绝）从队列清掉，避免悬挂卡片。
        this.pendingApprovals = this.pendingApprovals.filter((item) => item.runId !== runId);
        this.sending = false;
      }
    },
  },
});
