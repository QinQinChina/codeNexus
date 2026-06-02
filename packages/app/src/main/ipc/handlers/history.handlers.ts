import { ipcMain } from "electron";
import { IPC_HISTORY_CHANNELS } from "@codenexus/shared/ipc/channels";
import type {
  HistoryThreadTaskCreateArgs,
  HistoryThreadTaskCreateFailureCode,
  HistoryThreadTaskCreateResult,
  HistoryThreadTaskListArgs,
  HistoryThreadTaskListFailureCode,
  HistoryThreadTaskListResult,
  HistoryThreadTaskUpdateArgs,
  HistoryThreadTaskUpdateFailureCode,
  HistoryThreadTaskUpdateResult,
  HistoryThreadMetadataPatch,
  HistoryThreadArtifactGetArgs,
  HistoryThreadArtifactGetFailureCode,
  HistoryThreadArtifactGetResult,
  HistoryThreadArtifactListArgs,
  HistoryThreadArtifactListFailureCode,
  HistoryThreadArtifactListResult,
  HistoryThreadArtifactPublishArgs,
  HistoryThreadArtifactPublishFailureCode,
  HistoryThreadArtifactPublishResult,
} from "@codenexus/shared/ipc/contracts";
import { type HistoryThread } from "../../historyStore";
import { HistoryService } from "../../services/HistoryService";
import { isThreadTaskServiceError, ThreadTaskService } from "../../services/ThreadTaskService";
import { isThreadArtifactServiceError, ThreadArtifactService } from "../../services/ThreadArtifactService";
import { ThreadTitleOverrideService } from "../../services/ThreadTitleOverrideService";

export function registerHistoryHandlers(deps: {
  historyService: HistoryService;
  threadTaskService: ThreadTaskService;
  threadArtifactService: ThreadArtifactService;
  threadTitleOverrideService: ThreadTitleOverrideService;
  onUpdated: (items: HistoryThread[]) => void;
  decorateItems: (items: HistoryThread[]) => HistoryThread[];
  onThreadDeleted: (threadId: string) => void;
}) {
  const {
    historyService,
    threadTaskService,
    threadArtifactService,
    threadTitleOverrideService,
    onUpdated,
    decorateItems,
    onThreadDeleted,
  } = deps;

  const readErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message || error.name;
    return String(error ?? "unknown error");
  };

  const createThreadTaskFailure = (
    errorCode: HistoryThreadTaskCreateFailureCode,
    errorMessage: string
  ): HistoryThreadTaskCreateResult => {
    return {
      ok: false,
      errorCode,
      errorMessage: String(errorMessage ?? "").trim() || "unknown error",
    };
  };

  const updateThreadTaskFailure = (
    errorCode: HistoryThreadTaskUpdateFailureCode,
    errorMessage: string
  ): HistoryThreadTaskUpdateResult => {
    return {
      ok: false,
      errorCode,
      errorMessage: String(errorMessage ?? "").trim() || "unknown error",
    };
  };

  const listThreadTaskFailure = (
    errorCode: HistoryThreadTaskListFailureCode,
    errorMessage: string
  ): HistoryThreadTaskListResult => {
    return {
      ok: false,
      errorCode,
      errorMessage: String(errorMessage ?? "").trim() || "unknown error",
    };
  };

  const publishThreadArtifactFailure = (
    errorCode: HistoryThreadArtifactPublishFailureCode,
    errorMessage: string
  ): HistoryThreadArtifactPublishResult => {
    return {
      ok: false,
      errorCode,
      errorMessage: String(errorMessage ?? "").trim() || "unknown error",
    };
  };

  const listThreadArtifactFailure = (
    errorCode: HistoryThreadArtifactListFailureCode,
    errorMessage: string
  ): HistoryThreadArtifactListResult => {
    return {
      ok: false,
      errorCode,
      errorMessage: String(errorMessage ?? "").trim() || "unknown error",
    };
  };

  const getThreadArtifactFailure = (
    errorCode: HistoryThreadArtifactGetFailureCode,
    errorMessage: string
  ): HistoryThreadArtifactGetResult => {
    return {
      ok: false,
      errorCode,
      errorMessage: String(errorMessage ?? "").trim() || "unknown error",
    };
  };

  ipcMain.handle(IPC_HISTORY_CHANNELS.historyList, async () => {
    // 返回当前列表，并把后台刷新结果继续回推到渲染层。
    const items = await historyService.list((next) => {
      onUpdated(next);
    });
    return { items: decorateItems(items) };
  });

  ipcMain.handle(IPC_HISTORY_CHANNELS.historyRefresh, async () => {
    const items = await historyService.refresh((next) => {
      onUpdated(next);
    });
    return { items: decorateItems(items) };
  });

  ipcMain.handle(
    IPC_HISTORY_CHANNELS.historyMergeThreadMetadata,
    async (_evt, args: { threads?: HistoryThreadMetadataPatch[] }) => {
      const items = await historyService.mergeThreadMetadata(args, (next) => {
        onUpdated(next);
      });
      return { items: decorateItems(items) };
    }
  );

  ipcMain.handle(IPC_HISTORY_CHANNELS.historyDeleteThread, async (_evt, args: { threadId: string }) => {
    const threadId = typeof args?.threadId === "string" ? args.threadId.trim() : "";
    const result = await historyService.deleteThread(args, (next) => {
      onUpdated(next);
    });
    if (threadId) onThreadDeleted(threadId);
    if (threadId) {
      await threadTitleOverrideService.clearOverride({ threadId }).catch(() => undefined);
    }
    return result;
  });

  ipcMain.handle(IPC_HISTORY_CHANNELS.historyGetThreadTitleOverrides, async () => {
    const overrides = await threadTitleOverrideService.listOverrides();
    return { overrides };
  });

  ipcMain.handle(
    IPC_HISTORY_CHANNELS.historySetThreadTitleOverride,
    async (_evt, args: { threadId: string; title: string }) => {
      await threadTitleOverrideService.setOverride({
        threadId: typeof args?.threadId === "string" ? args.threadId : "",
        title: typeof args?.title === "string" ? args.title : "",
      });
      return { ok: true } as const;
    }
  );

  ipcMain.handle(IPC_HISTORY_CHANNELS.historyClearThreadTitleOverride, async (_evt, args: { threadId: string }) => {
    await threadTitleOverrideService.clearOverride({
      threadId: typeof args?.threadId === "string" ? args.threadId : "",
    });
    return { ok: true } as const;
  });

  ipcMain.handle(
    IPC_HISTORY_CHANNELS.historyThreadTaskCreate,
    async (_evt, args: HistoryThreadTaskCreateArgs): Promise<HistoryThreadTaskCreateResult> => {
      try {
        const task = await threadTaskService.createTask(args);
        return {
          ok: true,
          task,
        };
      } catch (error) {
        if (isThreadTaskServiceError(error)) {
          const code = error.code;
          if (
            code === "INVALID_THREAD_ID" ||
            code === "INVALID_TITLE" ||
            code === "INVALID_DESCRIPTION" ||
            code === "INVALID_STATUS" ||
            code === "TASK_STORE_CORRUPTED" ||
            code === "TASK_STORE_READ_FAILED" ||
            code === "TASK_STORE_WRITE_FAILED"
          ) {
            return createThreadTaskFailure(code, error.message);
          }
        }
        return createThreadTaskFailure("TASK_STORE_WRITE_FAILED", readErrorMessage(error));
      }
    }
  );

  ipcMain.handle(
    IPC_HISTORY_CHANNELS.historyThreadTaskUpdate,
    async (_evt, args: HistoryThreadTaskUpdateArgs): Promise<HistoryThreadTaskUpdateResult> => {
      try {
        const result = await threadTaskService.updateTask(args);
        return {
          ok: true,
          task: result.task,
          upserted: result.upserted,
        };
      } catch (error) {
        if (isThreadTaskServiceError(error)) {
          const code = error.code;
          if (
            code === "INVALID_THREAD_ID" ||
            code === "INVALID_TASK_ID" ||
            code === "INVALID_PATCH" ||
            code === "INVALID_TITLE" ||
            code === "INVALID_DESCRIPTION" ||
            code === "INVALID_STATUS" ||
            code === "TASK_STORE_CORRUPTED" ||
            code === "TASK_STORE_READ_FAILED" ||
            code === "TASK_STORE_WRITE_FAILED"
          ) {
            return updateThreadTaskFailure(code, error.message);
          }
        }
        return updateThreadTaskFailure("TASK_STORE_WRITE_FAILED", readErrorMessage(error));
      }
    }
  );

  ipcMain.handle(
    IPC_HISTORY_CHANNELS.historyThreadTaskList,
    async (_evt, args: HistoryThreadTaskListArgs): Promise<HistoryThreadTaskListResult> => {
      try {
        const tasks = await threadTaskService.listTasks(args);
        return { ok: true, tasks };
      } catch (error) {
        if (isThreadTaskServiceError(error)) {
          const code = error.code;
          if (code === "INVALID_THREAD_ID" || code === "TASK_STORE_CORRUPTED" || code === "TASK_STORE_READ_FAILED") {
            return listThreadTaskFailure(code, error.message);
          }
        }
        return listThreadTaskFailure("TASK_STORE_READ_FAILED", readErrorMessage(error));
      }
    }
  );

  ipcMain.handle(
    IPC_HISTORY_CHANNELS.historyThreadArtifactPublish,
    async (_evt, args: HistoryThreadArtifactPublishArgs): Promise<HistoryThreadArtifactPublishResult> => {
      try {
        const artifact = await threadArtifactService.publishArtifact(args);
        return { ok: true, artifact };
      } catch (error) {
        if (isThreadArtifactServiceError(error)) {
          const code = error.code;
          if (
            code === "INVALID_THREAD_ID" ||
            code === "INVALID_TITLE" ||
            code === "INVALID_KIND" ||
            code === "INVALID_PAYLOAD" ||
            code === "ARTIFACT_TOO_LARGE" ||
            code === "ARTIFACT_STORE_CORRUPTED" ||
            code === "ARTIFACT_STORE_READ_FAILED" ||
            code === "ARTIFACT_STORE_WRITE_FAILED"
          ) {
            return publishThreadArtifactFailure(code, error.message);
          }
        }
        return publishThreadArtifactFailure("ARTIFACT_STORE_WRITE_FAILED", readErrorMessage(error));
      }
    }
  );

  ipcMain.handle(
    IPC_HISTORY_CHANNELS.historyThreadArtifactList,
    async (_evt, args: HistoryThreadArtifactListArgs): Promise<HistoryThreadArtifactListResult> => {
      try {
        const artifacts = await threadArtifactService.listArtifacts(args);
        return { ok: true, artifacts };
      } catch (error) {
        if (isThreadArtifactServiceError(error)) {
          const code = error.code;
          if (
            code === "INVALID_THREAD_ID" ||
            code === "ARTIFACT_STORE_CORRUPTED" ||
            code === "ARTIFACT_STORE_READ_FAILED"
          ) {
            return listThreadArtifactFailure(code, error.message);
          }
        }
        return listThreadArtifactFailure("ARTIFACT_STORE_READ_FAILED", readErrorMessage(error));
      }
    }
  );

  ipcMain.handle(
    IPC_HISTORY_CHANNELS.historyThreadArtifactGet,
    async (_evt, args: HistoryThreadArtifactGetArgs): Promise<HistoryThreadArtifactGetResult> => {
      try {
        const artifact = await threadArtifactService.getArtifact(args);
        return { ok: true, artifact };
      } catch (error) {
        if (isThreadArtifactServiceError(error)) {
          const code = error.code;
          if (
            code === "INVALID_ARTIFACT_ID" ||
            code === "ARTIFACT_NOT_FOUND" ||
            code === "ARTIFACT_STORE_CORRUPTED" ||
            code === "ARTIFACT_STORE_READ_FAILED"
          ) {
            return getThreadArtifactFailure(code, error.message);
          }
        }
        return getThreadArtifactFailure("ARTIFACT_STORE_READ_FAILED", readErrorMessage(error));
      }
    }
  );

  ipcMain.handle(
    IPC_HISTORY_CHANNELS.historyThreadMessages,
    async (_evt, args: { threadId: string; limit?: number }) => {
      // 对话消息用于“线程内容预览”。
      const messages = await historyService.threadMessages(args);
      return { messages };
    }
  );

  ipcMain.handle(
    IPC_HISTORY_CHANNELS.historyThreadEvents,
    async (_evt, args: { threadId: string; limit?: number; before?: number; includeAux?: boolean }) => {
      // 事件流用于时间线回放，支持分页加载。
      return await historyService.threadEvents(args);
    }
  );

  ipcMain.handle(
    IPC_HISTORY_CHANNELS.historyThreadContent,
    async (
      _evt,
      args: {
        threadId: string;
        messageLimit?: number;
        eventLimit?: number;
        eventBefore?: number;
        includeAux?: boolean;
      }
    ) => {
      // 统一读取线程快照：thread + 消息窗口 + 事件分页。
      return await historyService.threadContent(args);
    }
  );
}
