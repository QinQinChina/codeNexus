import { app, BrowserWindow, Menu } from "electron";
import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { IPC_APP_CHANNELS, IPC_EVENT_CHANNELS, type AppClosingStep, type AppWindowClosingState } from "../shared/ipc";
import { HistoryStore, type HistoryThread } from "./historyStore";
import { registerAllHandlers } from "./ipc/handlers";
import { generateImagesWithSettings } from "./ipc/handlers/app.handlers";
import { RuntimeThreadStateTracker } from "./runtimeThreadStateTracker";
import { HistoryService } from "./services/HistoryService";
import { CodexServerManager } from "./services/CodexServerManager";
import { CodexProfileService } from "./services/CodexProfileService";
import { CodexSkillRootsService } from "./services/CodexSkillRootsService";
import { ImageGenerationHistoryService } from "./services/ImageGenerationHistoryService";
import { ImageGenerationTaskService } from "./services/ImageGenerationTaskService";
import { LocalSettingsService } from "./services/LocalSettingsService";
import { RemoteStateSyncService } from "./services/RemoteStateSyncService";
import { CacheRegistryService } from "./services/CacheRegistryService";
import { ThreadArtifactService } from "./services/ThreadArtifactService";
import { ThreadTaskService } from "./services/ThreadTaskService";
import { ThreadTitleOverrideService } from "./services/ThreadTitleOverrideService";
import { WorkspacePatchService } from "./services/WorkspacePatchService";
import { createMainWindow } from "./windows/mainWindow";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

app.setName("CodeNexus");
if (process.platform === "win32") {
  app.setAppUserModelId("com.codenexus.desktop");
}

let mainWindow: BrowserWindow | null = null;
let appCloseFlowPromise: Promise<void> | null = null;
let allowMainWindowClose = false;
let closeCleanupFinished = false;
let appCloseFlowStartedAt = 0;
let appCloseForceExitTimer: NodeJS.Timeout | null = null;

const codexServerManager = new CodexServerManager();
const workspacePatchService = new WorkspacePatchService();
const runtimeThreadStateTracker = new RuntimeThreadStateTracker();
const cacheRegistryService = new CacheRegistryService();
let remoteStateSyncService: RemoteStateSyncService | null = null;

const APP_CLOSE_OVERLAY_BOOT_MS = 56;
const APP_CLOSE_PREPARE_MS = 200;
const APP_CLOSE_MIN_VISIBLE_MS = 300;
const APP_CLOSE_FINALIZE_MS = 48;
const APP_CLOSE_FORCE_EXIT_MS = 5_000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Math.round(ms)));
  });
}

function sendToRenderer(channel: string, payload: unknown) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send(channel, payload);
  } catch {}
}

function pushHistoryUpdate(items: HistoryThread[]) {
  sendToRenderer(IPC_EVENT_CHANNELS.historyUpdated, { items: runtimeThreadStateTracker.decorateHistoryItems(items) });
}

function buildClosingSteps(phase: AppWindowClosingState["phase"]): AppClosingStep[] {
  const prepareUiStatus: AppClosingStep["status"] =
    phase === "idle" ? "pending" : phase === "starting" || phase === "preparing" ? "inProgress" : "completed";
  const stopTasksStatus: AppClosingStep["status"] =
    phase === "stopping" ? "inProgress" : phase === "finalizing" ? "completed" : "pending";
  const exitAppStatus: AppClosingStep["status"] = phase === "finalizing" ? "inProgress" : "pending";

  return [
    { id: "prepareUi", label: "准备关闭界面", status: prepareUiStatus },
    { id: "stopTasks", label: "停止后台任务", status: stopTasksStatus },
    { id: "exitApp", label: "退出应用", status: exitAppStatus },
  ];
}

function pushWindowClosingState(phase: AppWindowClosingState["phase"]) {
  const payload: AppWindowClosingState = {
    visible: phase !== "idle",
    phase,
    startedAt: phase === "idle" ? 0 : appCloseFlowStartedAt || Date.now(),
    steps: buildClosingSteps(phase),
  };
  sendToRenderer(IPC_APP_CHANNELS.appWindowClosingState, payload);
}

function stopCodexServersForClose(_reason: string) {
  if (closeCleanupFinished) return;
  closeCleanupFinished = true;
  try {
    codexServerManager.stopAll();
  } catch (error) {
    console.warn("[app-close] stop codex servers failed", error);
  }
  try {
    remoteStateSyncService?.stop();
  } catch (error) {
    console.warn("[app-close] stop remote sync failed", error);
  }
}

function clearAppCloseForceExitWatchdog() {
  if (!appCloseForceExitTimer) return;
  clearTimeout(appCloseForceExitTimer);
  appCloseForceExitTimer = null;
}

function armAppCloseForceExitWatchdog() {
  clearAppCloseForceExitWatchdog();
  appCloseForceExitTimer = setTimeout(() => {
    console.warn("[app-close] force exiting after close watchdog timeout");
    stopCodexServersForClose("force-exit-watchdog");
    app.exit(0);
  }, APP_CLOSE_FORCE_EXIT_MS);
  appCloseForceExitTimer.unref?.();
}

async function runAppCloseFlow(win: BrowserWindow): Promise<void> {
  if (allowMainWindowClose || win.isDestroyed()) return;
  if (appCloseFlowPromise) return appCloseFlowPromise;

  appCloseFlowStartedAt = Date.now();
  armAppCloseForceExitWatchdog();
  appCloseFlowPromise = (async () => {
    pushWindowClosingState("starting");
    await wait(APP_CLOSE_OVERLAY_BOOT_MS);

    pushWindowClosingState("preparing");
    await wait(APP_CLOSE_PREPARE_MS);

    pushWindowClosingState("stopping");
    stopCodexServersForClose("window-close");

    const remainingVisibleMs = APP_CLOSE_MIN_VISIBLE_MS - (Date.now() - appCloseFlowStartedAt);
    if (remainingVisibleMs > 0) await wait(remainingVisibleMs);

    pushWindowClosingState("finalizing");
    await wait(APP_CLOSE_FINALIZE_MS);

    allowMainWindowClose = true;
    if (!win.isDestroyed()) win.close();
  })()
    .catch((error) => {
      console.error("[app-close] flow failed", error);
      allowMainWindowClose = true;
      if (!win.isDestroyed()) win.close();
    })
    .finally(() => {
      appCloseFlowPromise = null;
    });

  return appCloseFlowPromise;
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopCodexServersForClose("before-quit");
});

app
  .whenReady()
  .then(async () => {
    if (process.platform !== "darwin") {
      Menu.setApplicationMenu(null);
    }

    const historyCachePath = join(app.getPath("userData"), "thread-history-cache.json");
    const historyStore = new HistoryStore(historyCachePath);
    const historyService = new HistoryService(historyStore);
    const localSettingsService = new LocalSettingsService(join(app.getPath("userData"), "user-settings.json"));
    const codexProfileService = new CodexProfileService(join(app.getPath("userData"), "codex-profiles.json"));
    const codexSkillRootsService = new CodexSkillRootsService(join(app.getPath("userData"), "codex-skill-roots.json"));
    const imageGenerationHistoryService = new ImageGenerationHistoryService(
      join(app.getPath("userData"), "image-generation-history.json")
    );
    const imageGenerationTaskService = new ImageGenerationTaskService(
      join(app.getPath("userData"), "image-generation-tasks.json"),
      (args, signal) => generateImagesWithSettings(localSettingsService, imageGenerationHistoryService, args, signal),
      2
    );
    const threadTaskService = new ThreadTaskService(join(app.getPath("userData"), "thread-tasks.json"));
    const threadArtifactService = new ThreadArtifactService(join(app.getPath("userData"), "thread-artifacts.json"));
    const threadTitleOverrideService = new ThreadTitleOverrideService(
      join(app.getPath("userData"), "thread-title-overrides.json")
    );
    const initialLocalSettings = await localSettingsService.read();
    remoteStateSyncService = new RemoteStateSyncService({
      localSettingsService,
      onState: (payload) => {
        sendToRenderer(IPC_APP_CHANNELS.appRemoteSyncState, payload);
      },
    });
    await remoteStateSyncService.start(initialLocalSettings.settings);

    cacheRegistryService.registerProvider({
      namespace: "main.history.disk",
      getStats: async () => {
        let bytes = 0;
        let items = 0;
        try {
          const metadata = await stat(historyCachePath);
          if (metadata.isFile()) bytes = Math.max(0, Math.round(metadata.size));
          const raw = await readFile(historyCachePath, "utf8");
          const parsed = JSON.parse(raw);
          items = Array.isArray(parsed?.items) ? parsed.items.length : 0;
        } catch {}
        return {
          items,
          bytes,
          note: "历史线程缓存文件",
          updatedAt: Date.now(),
        };
      },
      clear: async () => {
        await rm(historyCachePath, { force: true }).catch(() => undefined);
        historyStore.clearMemoryCaches();
      },
    });
    cacheRegistryService.registerProvider({
      namespace: "main.history.memory",
      getStats: () => ({
        ...historyStore.getMemoryCacheStats(),
        note: "历史线程内存缓存",
      }),
      clear: () => {
        historyStore.clearMemoryCaches();
      },
    });
    cacheRegistryService.registerProvider({
      namespace: "main.remoteSync.queue",
      clearable: false,
      getStats: async () => {
        if (!remoteStateSyncService) return { items: 0, bytes: 0, updatedAt: Date.now(), note: "同步队列缓存" };
        return {
          ...(await remoteStateSyncService.getQueueCacheStats()),
          note: "同步队列缓存（不可清理）",
        };
      },
    });

    registerAllHandlers({
      getMainWindow: () => mainWindow,
      serverManager: codexServerManager,
      sendCodexEvent: (payload) => {
        runtimeThreadStateTracker.observeEvent(payload);
        remoteStateSyncService?.observeCodexEvent(payload);
        sendToRenderer(IPC_EVENT_CHANNELS.codexEvent, payload);
      },
      historyService,
      threadTaskService,
      threadArtifactService,
      threadTitleOverrideService,
      onHistoryUpdated: (items: HistoryThread[]) => {
        remoteStateSyncService?.observeHistoryThreads(items);
        pushHistoryUpdate(items);
      },
      decorateHistoryItems: (items: HistoryThread[]) => runtimeThreadStateTracker.decorateHistoryItems(items),
      onHistoryThreadDeleted: (threadId: string) => {
        runtimeThreadStateTracker.clearThread(threadId);
        remoteStateSyncService?.clearThread(threadId);
      },
      getThreadRunningState: (threadId: string) => runtimeThreadStateTracker.getThreadRunningState(threadId),
      workspacePatchService,
      localSettingsService,
      codexProfileService,
      codexSkillRootsService,
      imageGenerationHistoryService,
      imageGenerationTaskService,
      remoteSyncService: remoteStateSyncService,
      cacheRegistryService,
    });

    mainWindow = await createMainWindow({
      isDev,
      devServerUrl: process.env.VITE_DEV_SERVER_URL,
      initialLocalSettingsSnapshot: {
        path: localSettingsService.path,
        exists: initialLocalSettings.exists,
        settings: initialLocalSettings.settings,
      },
    });

    mainWindow.webContents.once("did-finish-load", () => {
      pushWindowClosingState("idle");
      if (remoteStateSyncService) {
        sendToRenderer(IPC_APP_CHANNELS.appRemoteSyncState, { state: remoteStateSyncService.getState() });
      }
    });

    mainWindow.on("close", (event) => {
      if (allowMainWindowClose) return;
      event.preventDefault();
      void runAppCloseFlow(mainWindow!);
    });

    mainWindow.on("closed", () => {
      clearAppCloseForceExitWatchdog();
      mainWindow = null;
      allowMainWindowClose = false;
      closeCleanupFinished = false;
      appCloseFlowStartedAt = 0;
      appCloseFlowPromise = null;
    });
  })
  .catch((error) => {
    console.error("[main] app bootstrap failed", error);
    app.exit(1);
  });
