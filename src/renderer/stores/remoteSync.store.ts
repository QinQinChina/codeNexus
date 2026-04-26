import { defineStore } from "pinia";
import { codexDesktop } from "../api/codexDesktopClient";
import { DEFAULT_USER_LOCAL_SETTINGS } from "../../shared/localSettings";
import type { AppRemoteSyncState } from "../../shared/ipc";

function createDefaultRemoteSyncState(): AppRemoteSyncState {
  const settings = { ...DEFAULT_USER_LOCAL_SETTINGS.remoteSync };
  return {
    phase: settings.enabled ? "idle" : "disabled",
    enabled: settings.enabled,
    configured: false,
    authenticated: false,
    serverBaseUrl: settings.serverBaseUrl,
    username: settings.username,
    desktopId: settings.desktopId,
    lastSyncedAt: 0,
    pendingQueueSize: 0,
    lastError: null,
    settings,
  };
}

function cloneRemoteSyncState(state: AppRemoteSyncState | null | undefined): AppRemoteSyncState {
  const fallback = createDefaultRemoteSyncState();
  return {
    ...fallback,
    ...(state ?? {}),
    settings: {
      ...fallback.settings,
      ...(state?.settings ?? {}),
    },
  };
}

let stopRemoteSyncStateListener: (() => void) | null = null;
let initPromise: Promise<void> | null = null;

export const useRemoteSyncStore = defineStore("remoteSync", {
  state: () => ({
    initialized: false,
    loading: false,
    state: createDefaultRemoteSyncState() as AppRemoteSyncState,
  }),
  getters: {
    phase(state): AppRemoteSyncState["phase"] {
      return state.state.phase;
    },
    isReady(state): boolean {
      return state.initialized && !state.loading;
    },
  },
  actions: {
    applyState(nextState: AppRemoteSyncState) {
      this.state = cloneRemoteSyncState(nextState);
      this.initialized = true;
      this.loading = false;
    },
    initBridge() {
      if (initPromise) return initPromise;
      this.loading = true;
      if (!stopRemoteSyncStateListener) {
        stopRemoteSyncStateListener = codexDesktop.remoteSync.onState((payload) => {
          this.applyState(payload.state);
        });
      }
      initPromise = codexDesktop.remoteSync
        .getState()
        .then((payload) => {
          this.applyState(payload.state);
        })
        .catch((error: any) => {
          this.applyState({
            ...this.state,
            phase: "error",
            lastError: String(error?.message ?? error ?? "remote sync init failed"),
          });
        });
      return initPromise;
    },
    async refreshState() {
      const payload = await codexDesktop.remoteSync.getState();
      this.applyState(payload.state);
      return payload;
    },
    async login(password: string) {
      const result = await codexDesktop.remoteSync.login({ password });
      this.applyState(result.state);
      return result;
    },
    async logout() {
      const result = await codexDesktop.remoteSync.logout();
      this.applyState(result.state);
      return result;
    },
    async flush() {
      const result = await codexDesktop.remoteSync.flush();
      this.applyState(result.state);
      return result;
    },
  },
});
