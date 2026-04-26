import { app } from "electron";
import { autoUpdater, type ProgressInfo, type UpdateDownloadedEvent, type UpdateInfo } from "electron-updater";
import type { AppUpdateState } from "../../shared/ipc";

type UpdateServiceDeps = {
  onState: (payload: { state: AppUpdateState }) => void;
};

const INITIAL_CHECK_DELAY_MS = 5_000;

function createDefaultState(): AppUpdateState {
  return {
    enabled: app.isPackaged,
    phase: app.isPackaged ? "idle" : "disabled",
    currentVersion: app.getVersion(),
    availableVersion: null,
    downloadProgressPercent: 0,
    transferredBytes: 0,
    totalBytes: 0,
    bytesPerSecond: 0,
    releaseName: null,
    releaseNotes: null,
    lastCheckedAt: 0,
    downloadedAt: 0,
    errorMessage: app.isPackaged ? null : "当前仅打包版本支持在线更新。",
  };
}

function clampProgressPercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

function toFiniteInteger(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normalizeReleaseName(info: unknown): string | null {
  const name = String((info as { releaseName?: unknown } | null)?.releaseName ?? "").trim();
  return name || null;
}

function normalizeReleaseNotes(info: unknown): string | null {
  const raw = (info as { releaseNotes?: unknown } | null)?.releaseNotes;
  if (typeof raw === "string") {
    const text = raw.trim();
    return text || null;
  }
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const lines = raw
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const title = String((item as { version?: unknown }).version ?? "").trim();
      const note = String((item as { note?: unknown }).note ?? "").trim();
      if (title && note) return `## ${title}\n${note}`;
      return note || title;
    })
    .filter(Boolean);

  return lines.length > 0 ? lines.join("\n\n") : null;
}

function normalizeAvailableVersion(info: unknown): string | null {
  const version = String((info as { version?: unknown } | null)?.version ?? "").trim();
  return version || null;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error ?? "unknown error");
}

export class UpdateService {
  private state = createDefaultState();
  private initialized = false;
  private initialCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private checkPromise: Promise<void> | null = null;
  private downloadPromise: Promise<void> | null = null;
  private latestInfo: UpdateInfo | UpdateDownloadedEvent | null = null;
  private restartToInstallRequested = false;
  private quitAndInstallStarted = false;

  constructor(private readonly deps: UpdateServiceDeps) {}

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (!app.isPackaged) {
      this.setState({
        enabled: false,
        phase: "disabled",
        errorMessage: "当前仅打包版本支持在线更新。",
      });
      return;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on("checking-for-update", () => {
      this.setState({
        enabled: true,
        phase: "checking",
        lastCheckedAt: Date.now(),
        errorMessage: null,
      });
    });

    autoUpdater.on("update-available", (info) => {
      this.latestInfo = info;
      this.restartToInstallRequested = false;
      this.quitAndInstallStarted = false;
      this.setState({
        enabled: true,
        phase: "available",
        availableVersion: normalizeAvailableVersion(info),
        releaseName: normalizeReleaseName(info),
        releaseNotes: normalizeReleaseNotes(info),
        downloadProgressPercent: 0,
        transferredBytes: 0,
        totalBytes: 0,
        bytesPerSecond: 0,
        downloadedAt: 0,
        errorMessage: null,
      });
      void this.downloadUpdate().catch((error) => {
        console.error("[update] auto download failed", error);
      });
    });

    autoUpdater.on("update-not-available", () => {
      this.latestInfo = null;
      this.restartToInstallRequested = false;
      this.quitAndInstallStarted = false;
      this.setState({
        enabled: true,
        phase: "idle",
        availableVersion: null,
        downloadProgressPercent: 0,
        transferredBytes: 0,
        totalBytes: 0,
        bytesPerSecond: 0,
        releaseName: null,
        releaseNotes: null,
        downloadedAt: 0,
        errorMessage: null,
      });
    });

    autoUpdater.on("download-progress", (progress: ProgressInfo) => {
      this.setState({
        enabled: true,
        phase: "downloading",
        downloadProgressPercent: clampProgressPercent(progress.percent),
        transferredBytes: toFiniteInteger(progress.transferred),
        totalBytes: toFiniteInteger(progress.total),
        bytesPerSecond: toFiniteInteger(progress.bytesPerSecond),
        errorMessage: null,
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      this.latestInfo = info;
      this.restartToInstallRequested = false;
      this.quitAndInstallStarted = false;
      this.setState({
        enabled: true,
        phase: "downloaded",
        availableVersion: normalizeAvailableVersion(info),
        downloadProgressPercent: 100,
        transferredBytes: Math.max(this.state.transferredBytes, this.state.totalBytes),
        totalBytes: this.state.totalBytes,
        bytesPerSecond: 0,
        releaseName: normalizeReleaseName(info),
        releaseNotes: normalizeReleaseNotes(info),
        downloadedAt: Date.now(),
        errorMessage: null,
      });
    });

    autoUpdater.on("error", (error) => {
      const message = readErrorMessage(error);
      this.setState({
        phase: "error",
        bytesPerSecond: 0,
        errorMessage: message,
      });
    });
  }

  dispose(): void {
    if (this.initialCheckTimer) {
      clearTimeout(this.initialCheckTimer);
      this.initialCheckTimer = null;
    }
  }

  getState(): AppUpdateState {
    return { ...this.state };
  }

  scheduleInitialCheck(delayMs = INITIAL_CHECK_DELAY_MS): void {
    if (!app.isPackaged) return;
    if (this.initialCheckTimer || this.checkPromise) return;
    this.initialCheckTimer = setTimeout(
      () => {
        this.initialCheckTimer = null;
        void this.checkForUpdates().catch((error) => {
          console.error("[update] initial check failed", error);
        });
      },
      Math.max(0, Math.round(delayMs))
    );
  }

  async checkForUpdates(): Promise<void> {
    this.ensureAvailable();
    if (this.checkPromise) return this.checkPromise;

    const run = autoUpdater
      .checkForUpdates()
      .then(() => undefined)
      .finally(() => {
        this.checkPromise = null;
      });

    this.checkPromise = run;
    return run;
  }

  async downloadUpdate(): Promise<void> {
    this.ensureAvailable();
    if (this.state.phase === "downloaded") return;
    if (this.downloadPromise) return this.downloadPromise;

    if (!this.latestInfo) {
      await this.checkForUpdates();
      if (this.downloadPromise) return this.downloadPromise;
      if (!this.latestInfo || this.state.phase === "idle") return;
    }

    this.setState({
      enabled: true,
      phase: "downloading",
      errorMessage: null,
    });

    const run = autoUpdater
      .downloadUpdate()
      .then(() => undefined)
      .finally(() => {
        this.downloadPromise = null;
      });

    this.downloadPromise = run;
    return run;
  }

  requestRestartToInstall(): void {
    this.ensureAvailable();
    if (this.state.phase !== "downloaded") {
      throw new Error("更新尚未下载完成。");
    }
    this.restartToInstallRequested = true;
  }

  shouldQuitAndInstall(): boolean {
    return app.isPackaged && this.restartToInstallRequested && this.state.phase === "downloaded";
  }

  quitAndInstall(): boolean {
    this.ensureAvailable();
    if (!this.shouldQuitAndInstall()) return false;
    if (this.quitAndInstallStarted) return true;

    this.quitAndInstallStarted = true;
    this.restartToInstallRequested = false;

    try {
      autoUpdater.quitAndInstall(false, true);
      return true;
    } catch (error) {
      this.quitAndInstallStarted = false;
      this.restartToInstallRequested = true;
      this.setState({
        phase: "error",
        errorMessage: readErrorMessage(error),
      });
      return false;
    }
  }

  private ensureAvailable(): void {
    if (!this.initialized) this.init();
    if (!app.isPackaged) {
      throw new Error("当前仅打包版本支持在线更新。");
    }
  }

  private setState(patch: Partial<AppUpdateState>): void {
    this.state = {
      ...this.state,
      currentVersion: app.getVersion(),
      ...patch,
    };
    try {
      this.deps.onState({ state: this.getState() });
    } catch {}
  }
}
