import { ipcMain } from "electron";
import { IPC_WORKSPACE_CHANNELS } from "../../../shared/ipc/channels";
import { WorkspacePatchService } from "../../services/WorkspacePatchService";

export function registerWorkspaceHandlers(deps: { workspacePatchService: WorkspacePatchService }) {
  const { workspacePatchService } = deps;

  ipcMain.handle(
    IPC_WORKSPACE_CHANNELS.workspaceReverseDiffDryRun,
    async (_evt, args: { cwd: string; diffText: string }) => {
      // 仅校验补丁是否可逆应用，不修改文件。
      return await workspacePatchService.dryRunApplyReverseDiff(args);
    }
  );

  ipcMain.handle(
    IPC_WORKSPACE_CHANNELS.workspaceReverseDiffApply,
    async (_evt, args: { cwd: string; diffText: string }) => {
      // 正式执行反向补丁，回退工作区文件内容。
      return await workspacePatchService.applyReverseDiff(args);
    }
  );
}
