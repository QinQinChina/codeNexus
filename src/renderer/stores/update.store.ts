import { defineStore } from "pinia";
import { codexDesktop } from "../api/codexDesktopClient";
import { showToast } from "../ui/toast";
import type { AppUpdateState } from "../../shared/ipc";

function createDefaultUpdateState(): AppUpdateState {
  return {
    enabled: false,
    phase: "disabled",
    currentVersion: "",
    availableVersion: null,
    downloadProgressPercent: 0,
    transferredBytes: 0,
    totalBytes: 0,
    bytesPerSecond: 0,
    releaseName: null,
    releaseNotes: null,
    lastCheckedAt: 0,
    downloadedAt: 0,
    errorMessage: null,
  };
}

function cloneUpdateState(state: AppUpdateState | null | undefined): AppUpdateState {
  return {
    ...createDefaultUpdateState(),
    ...(state ?? {}),
  };
}

let stopUpdateStateListener: (() => void) | null = null;
let initPromise: Promise<void> | null = null;

export const useUpdateStore = defineStore("update", {
  state: () => ({
    initialized: false,
    loading: false,
    state: createDefaultUpdateState() as AppUpdateState,
  }),
  getters: {
    phase(state): AppUpdateState["phase"] {
      return state.state.phase;
    },
    currentVersion(state): string {
      return state.state.currentVersion || "unknown";
    },
  },
  actions: {
    applyState(nextState: AppUpdateState, opts?: { fromEvent?: boolean }) {
      const previous = this.state;
      const next = cloneUpdateState(nextState);
      this.state = next;
      this.initialized = true;
      this.loading = false;

      if (!opts?.fromEvent) return;
      if (previous.phase !== "available" && next.phase === "available" && next.availableVersion) {
        showToast({
          kind: "info",
          title: "发现新版本",
          message: `检测到 ${next.availableVersion}，已开始后台下载。`,
        });
      }
      if (previous.phase !== "downloaded" && next.phase === "downloaded") {
        showToast({
          kind: "success",
          title: "更新已下载完成",
          message: "可以点击“重启安装”完成更新。",
        });
      }
      if (next.phase === "error" && next.errorMessage && next.errorMessage !== previous.errorMessage) {
        showToast({
          kind: "error",
          title: "更新失败",
          message: next.errorMessage,
        });
      }
    },
    initBridge() {
      if (initPromise) return initPromise;
      this.loading = true;
      if (!stopUpdateStateListener) {
        stopUpdateStateListener = codexDesktop.update.onState((payload) => {
          this.applyState(payload.state, { fromEvent: true });
        });
      }
      initPromise = codexDesktop.update
        .getState()
        .then((payload) => {
          this.applyState(payload.state);
        })
        .catch((error: any) => {
          this.loading = false;
          this.applyState({
            ...createDefaultUpdateState(),
            phase: "error",
            currentVersion: this.state.currentVersion,
            errorMessage: String(error?.message ?? error ?? "update init failed"),
          });
        });
      return initPromise;
    },
    async refreshState() {
      const payload = await codexDesktop.update.getState();
      this.applyState(payload.state);
    },
    async check() {
      await codexDesktop.update.check();
    },
    async download() {
      await codexDesktop.update.download();
    },
    async restartToInstall() {
      await codexDesktop.update.restartToInstall();
    },
  },
});
