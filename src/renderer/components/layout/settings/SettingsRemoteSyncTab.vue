<template>
  <section class="settings-card" :aria-label="t('settingsRemoteSync.aria')">
    <header class="settings-card-head">
      <div class="settings-card-title">{{ t("settingsRemoteSync.title") }}</div>
      <button class="btn-mini" type="button" :disabled="saveDisabled" @click="onSave">
        {{ saveButtonText }}
      </button>
    </header>

    <div class="settings-card-body">
      <div class="settings-grid">
        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsRemoteSync.enabled") }}</span>
          <div class="settings-inline">
            <input id="chk-remote-sync-enabled" v-model="enabled" type="checkbox" :disabled="controlsDisabled" />
            <span class="dim mono">{{ enabled ? "enabled" : "disabled" }}</span>
          </div>
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsRemoteSync.serviceUrl") }}</span>
          <input
            id="inp-remote-sync-server"
            v-model="serverBaseUrl"
            class="context-input mono"
            type="text"
            placeholder="https://your-server.example.com"
            :disabled="controlsDisabled"
          />
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsRemoteSync.username") }}</span>
          <input
            id="inp-remote-sync-username"
            v-model="username"
            class="context-input mono"
            type="text"
            :placeholder="t('settingsRemoteSync.usernamePlaceholder')"
            :disabled="controlsDisabled"
          />
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsRemoteSync.heartbeat") }}</span>
          <div class="settings-inline">
            <input
              id="inp-remote-sync-heartbeat"
              v-model.number="heartbeatIntervalSec"
              class="context-input mono"
              type="number"
              :min="MIN_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC"
              :max="MAX_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC"
              step="1"
              :disabled="controlsDisabled"
              @blur="onHeartbeatBlur"
            />
            <span class="dim mono">sec</span>
          </div>
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsRemoteSync.password") }}</span>
          <input
            id="inp-remote-sync-password"
            v-model="password"
            class="context-input mono"
            type="password"
            autocomplete="off"
            :placeholder="t('settingsRemoteSync.passwordPlaceholder')"
            :disabled="controlsDisabled"
          />
        </label>

        <div class="settings-actions">
          <button class="btn-mini" type="button" :disabled="!canLogin" @click="onLogin">
            {{ state.authenticated ? t("settingsRemoteSync.relogin") : t("settingsRemoteSync.login") }}
          </button>
          <button class="btn-mini" type="button" :disabled="!canLogout" @click="onLogout">
            {{ t("settingsRemoteSync.logout") }}
          </button>
          <button class="btn-mini" type="button" :disabled="!canFlush" @click="onFlush">
            {{ t("settingsRemoteSync.syncNow") }}
          </button>
          <button class="btn-mini" type="button" :disabled="controlsDisabled" @click="onRefresh">
            {{ t("settingsRemoteSync.refreshStatus") }}
          </button>
        </div>

        <div class="status-panel" :class="phaseClass">
          <div class="status-row">
            <span class="dim">{{ t("settingsRemoteSync.status") }}</span>
            <span class="mono">{{ phaseLabel }}</span>
          </div>
          <div class="status-row">
            <span class="dim">{{ t("settingsRemoteSync.loginStatus") }}</span>
            <span class="mono">{{
              state.authenticated ? t("settingsRemoteSync.loggedIn") : t("settingsRemoteSync.loggedOut")
            }}</span>
          </div>
          <div class="status-row">
            <span class="dim">{{ t("settingsRemoteSync.desktopId") }}</span>
            <span class="mono">{{ state.desktopId || "—" }}</span>
          </div>
          <div class="status-row">
            <span class="dim">{{ t("settingsRemoteSync.queueEvents") }}</span>
            <span class="mono">{{ state.pendingQueueSize }}</span>
          </div>
          <div class="status-row">
            <span class="dim">{{ t("settingsRemoteSync.lastSynced") }}</span>
            <span class="mono">{{ lastSyncedAtText }}</span>
          </div>
          <div class="status-row status-row-error">
            <span class="dim">{{ t("settingsRemoteSync.errorInfo") }}</span>
            <span class="mono">{{ state.lastError || "—" }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  DEFAULT_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC,
  MAX_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC,
  MIN_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC,
} from "../../../../shared/localSettings";
import { patchUserLocalSettings } from "../../../domain/localSettings";
import { useRemoteSyncStore } from "../../../stores/remoteSync.store";
import { showToast } from "../../../ui/toast";

function normalizeNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeHeartbeat(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC;
  return Math.max(
    MIN_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC,
    Math.min(MAX_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC, Math.round(n))
  );
}

function formatTimestamp(value: number, locale: string): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return new Date(value).toLocaleString(locale);
}

const { t, locale } = useI18n();
const remoteSyncStore = useRemoteSyncStore();

const enabled = ref(false);
const serverBaseUrl = ref("");
const username = ref("");
const heartbeatIntervalSec = ref(DEFAULT_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC);
const password = ref("");

const saving = ref(false);
const mutating = ref(false);

const state = computed(() => remoteSyncStore.state);
const controlsDisabled = computed(() => remoteSyncStore.loading || saving.value || mutating.value);

watch(
  () => [
    state.value.settings.enabled,
    state.value.settings.serverBaseUrl ?? "",
    state.value.settings.username ?? "",
    state.value.settings.heartbeatIntervalSec,
  ],
  ([nextEnabled, nextServerBaseUrl, nextUsername, nextHeartbeat]) => {
    enabled.value = Boolean(nextEnabled);
    serverBaseUrl.value = String(nextServerBaseUrl ?? "");
    username.value = String(nextUsername ?? "");
    heartbeatIntervalSec.value = normalizeHeartbeat(nextHeartbeat);
  },
  { immediate: true }
);

const normalizedDraft = computed(() => {
  return {
    enabled: Boolean(enabled.value),
    serverBaseUrl: normalizeNullableText(serverBaseUrl.value),
    username: normalizeNullableText(username.value),
    heartbeatIntervalSec: normalizeHeartbeat(heartbeatIntervalSec.value),
  };
});

const hasConfigChanges = computed(() => {
  const current = state.value.settings;
  const draft = normalizedDraft.value;
  return (
    current.enabled !== draft.enabled ||
    current.serverBaseUrl !== draft.serverBaseUrl ||
    current.username !== draft.username ||
    current.heartbeatIntervalSec !== draft.heartbeatIntervalSec
  );
});

const saveButtonText = computed(() => {
  if (saving.value) return t("settingsRemoteSync.saving");
  if (hasConfigChanges.value) return t("settingsRemoteSync.saveConfig");
  return t("settingsRemoteSync.configSaved");
});
const saveDisabled = computed(() => controlsDisabled.value || !hasConfigChanges.value);

const phaseLabel = computed(() => {
  if (state.value.phase === "disabled") return t("settingsRemoteSync.phaseDisabled");
  if (state.value.phase === "syncing") return t("settingsRemoteSync.phaseSyncing");
  if (state.value.phase === "error") return t("settingsRemoteSync.phaseError");
  return t("settingsRemoteSync.phaseIdle");
});

const phaseClass = computed(() => `phase-${state.value.phase}`);
const lastSyncedAtText = computed(() => formatTimestamp(state.value.lastSyncedAt, String(locale.value)));

const canLogin = computed(() => {
  const draft = normalizedDraft.value;
  return !controlsDisabled.value && draft.enabled && Boolean(draft.serverBaseUrl) && Boolean(draft.username);
});
const canLogout = computed(() => !controlsDisabled.value && state.value.authenticated);
const canFlush = computed(() => !controlsDisabled.value && state.value.enabled && state.value.authenticated);

async function persistSettings(showSuccessToast = true): Promise<boolean> {
  if (!hasConfigChanges.value) return true;
  saving.value = true;
  try {
    const draft = normalizedDraft.value;
    await patchUserLocalSettings({
      remoteSync: {
        enabled: draft.enabled,
        serverBaseUrl: draft.serverBaseUrl,
        username: draft.username,
        heartbeatIntervalSec: draft.heartbeatIntervalSec,
      },
    });
    await remoteSyncStore.refreshState().catch(() => undefined);
    if (showSuccessToast) {
      showToast({
        kind: "success",
        title: t("settingsRemoteSync.saveSuccessTitle"),
        message: t("settingsRemoteSync.saveSuccessMessage"),
      });
    }
    return true;
  } catch (error: any) {
    showToast({
      kind: "error",
      title: t("settingsRemoteSync.saveFailedTitle"),
      message: String(error?.message ?? error ?? "unknown error"),
    });
    return false;
  } finally {
    saving.value = false;
  }
}

function onHeartbeatBlur() {
  heartbeatIntervalSec.value = normalizeHeartbeat(heartbeatIntervalSec.value);
}

async function onSave() {
  await persistSettings(true);
}

async function onLogin() {
  const pwd = String(password.value ?? "").trim();
  if (!pwd) {
    showToast({
      kind: "warn",
      title: t("settingsRemoteSync.loginBlockedTitle"),
      message: t("settingsRemoteSync.loginBlockedMessage"),
    });
    return;
  }
  const saved = await persistSettings(false);
  if (!saved) return;

  mutating.value = true;
  try {
    const result = await remoteSyncStore.login(pwd);
    if (!result.ok) {
      showToast({
        kind: "error",
        title: t("settingsRemoteSync.loginFailedTitle"),
        message: String(result.error ?? result.state.lastError ?? "unknown error"),
      });
      return;
    }
    password.value = "";
    showToast({
      kind: "success",
      title: t("settingsRemoteSync.loginSuccessTitle"),
      message: t("settingsRemoteSync.loginSuccessMessage"),
    });
  } catch (error: any) {
    showToast({
      kind: "error",
      title: t("settingsRemoteSync.loginFailedTitle"),
      message: String(error?.message ?? error ?? "unknown error"),
    });
  } finally {
    mutating.value = false;
  }
}

async function onLogout() {
  mutating.value = true;
  try {
    await remoteSyncStore.logout();
    password.value = "";
    showToast({
      kind: "info",
      title: t("settingsRemoteSync.logoutSuccessTitle"),
      message: t("settingsRemoteSync.logoutSuccessMessage"),
    });
  } catch (error: any) {
    showToast({
      kind: "error",
      title: t("settingsRemoteSync.logoutFailedTitle"),
      message: String(error?.message ?? error ?? "unknown error"),
    });
  } finally {
    mutating.value = false;
  }
}

async function onFlush() {
  const saved = await persistSettings(false);
  if (!saved) return;
  mutating.value = true;
  try {
    const result = await remoteSyncStore.flush();
    if (!result.ok) {
      showToast({
        kind: "error",
        title: t("settingsRemoteSync.syncFailedTitle"),
        message: String(result.error ?? result.state.lastError ?? "unknown error"),
      });
      return;
    }
    showToast({
      kind: "success",
      title: t("settingsRemoteSync.syncSuccessTitle"),
      message: t("settingsRemoteSync.syncSuccessMessage"),
    });
  } catch (error: any) {
    showToast({
      kind: "error",
      title: t("settingsRemoteSync.syncFailedTitle"),
      message: String(error?.message ?? error ?? "unknown error"),
    });
  } finally {
    mutating.value = false;
  }
}

async function onRefresh() {
  mutating.value = true;
  try {
    await remoteSyncStore.refreshState();
    showToast({
      kind: "info",
      title: t("settingsRemoteSync.refreshSuccessTitle"),
      message: t("settingsRemoteSync.refreshSuccessMessage"),
    });
  } catch (error: any) {
    showToast({
      kind: "error",
      title: t("settingsRemoteSync.refreshFailedTitle"),
      message: String(error?.message ?? error ?? "unknown error"),
    });
  } finally {
    mutating.value = false;
  }
}
</script>
