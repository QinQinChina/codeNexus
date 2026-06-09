import { ipcMain } from "electron";
import { IPC_AGENT_CHANNELS } from "@codenexus/shared/ipc/channels";
import type {
  CustomAgentApproveArgs,
  CustomAgentRunArgs,
  CustomAgentStreamEvent,
} from "@codenexus/shared/ipc/contracts";
import type { CustomAgentService } from "../../services/CustomAgentService";

export function registerAgentHandlers(deps: {
  customAgentService: CustomAgentService;
  sendEvent: (payload: CustomAgentStreamEvent) => void;
}) {
  const { customAgentService, sendEvent } = deps;

  // 跑一次回合：把流式事件（文本增量 / 工具活动 / 审批请求）经 sendEvent 推给渲染层，
  // 同时返回权威的最终文本。服务内部按 runId 决定是否发流（无 runId 即不发）。
  ipcMain.handle(IPC_AGENT_CHANNELS.agentRun, async (_evt, args: CustomAgentRunArgs) => {
    return await customAgentService.run(args, sendEvent);
  });

  // 回传一次审批决策，解开主进程里挂起的写改 / 命令确认。
  ipcMain.handle(IPC_AGENT_CHANNELS.agentApprove, async (_evt, args: CustomAgentApproveArgs) => {
    return customAgentService.resolveApproval(args);
  });
}
