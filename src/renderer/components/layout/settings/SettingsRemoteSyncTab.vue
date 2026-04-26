<template>
  <section class="settings-card" aria-label="远程同步设置">
    <header class="settings-card-head">
      <div class="settings-card-title">远程同步</div>
      <button class="btn-mini" type="button" :disabled="saveDisabled" @click="onSave">
        {{ saveButtonText }}
      </button>
    </header>

    <div class="settings-card-body">
      <div class="settings-grid">
        <label class="settings-row">
          <span class="context-label dim">启用同步</span>
          <div class="settings-inline">
            <input id="chk-remote-sync-enabled" v-model="enabled" type="checkbox" :disabled="controlsDisabled" />
            <span class="dim mono">{{ enabled ? "enabled" : "disabled" }}</span>
          </div>
        </label>

        <label class="settings-row">
          <span class="context-label dim">服务地址</span>
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
          <span class="context-label dim">用户名</span>
          <input
            id="inp-remote-sync-username"
            v-model="username"
            class="context-input mono"
            type="text"
            placeholder="账号用户名"
            :disabled="controlsDisabled"
          />
        </label>

        <label class="settings-row">
          <span class="context-label dim">心跳间隔</span>
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
          <span class="context-label dim">登录密码</span>
          <input
            id="inp-remote-sync-password"
            v-model="password"
            class="context-input mono"
            type="password"
            autocomplete="off"
            placeholder="仅用于当前登录，不落盘"
            :disabled="controlsDisabled"
          />
        </label>

        <div class="settings-actions">
          <button class="btn-mini" type="button" :disabled="!canLogin" @click="onLogin">
            {{ state.authenticated ? "重新登录" : "登录" }}
          </button>
          <button class="btn-mini" type="button" :disabled="!canLogout" @click="onLogout">退出登录</button>
          <button class="btn-mini" type="button" :disabled="!canFlush" @click="onFlush">立即同步</button>
          <button class="btn-mini" type="button" :disabled="controlsDisabled" @click="onRefresh">刷新状态</button>
        </div>

        <div class="status-panel" :class="phaseClass">
          <div class="status-row">
            <span class="dim">状态</span>
            <span class="mono">{{ phaseLabel }}</span>
          </div>
          <div class="status-row">
            <span class="dim">登录</span>
            <span class="mono">{{ state.authenticated ? "已登录" : "未登录" }}</span>
          </div>
          <div class="status-row">
            <span class="dim">设备 ID</span>
            <span class="mono">{{ state.desktopId || "—" }}</span>
          </div>
          <div class="status-row">
            <span class="dim">队列事件</span>
            <span class="mono">{{ state.pendingQueueSize }}</span>
          </div>
          <div class="status-row">
            <span class="dim">最近同步</span>
            <span class="mono">{{ lastSyncedAtText }}</span>
          </div>
          <div class="status-row status-row-error">
            <span class="dim">错误信息</span>
            <span class="mono">{{ state.lastError || "—" }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
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

function formatTimestamp(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return new Date(value).toLocaleString("zh-CN");
}

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
  if (saving.value) return "保存中...";
  if (hasConfigChanges.value) return "保存配置";
  return "配置已保存";
});
const saveDisabled = computed(() => controlsDisabled.value || !hasConfigChanges.value);

const phaseLabel = computed(() => {
  if (state.value.phase === "disabled") return "已关闭";
  if (state.value.phase === "syncing") return "同步中";
  if (state.value.phase === "error") return "异常";
  return "空闲";
});

const phaseClass = computed(() => `phase-${state.value.phase}`);
const lastSyncedAtText = computed(() => formatTimestamp(state.value.lastSyncedAt));

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
      showToast({ kind: "success", title: "保存成功", message: "远程同步配置已更新。" });
    }
    return true;
  } catch (error: any) {
    showToast({
      kind: "error",
      title: "保存失败",
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
    showToast({ kind: "warn", title: "无法登录", message: "请输入登录密码。" });
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
        title: "登录失败",
        message: String(result.error ?? result.state.lastError ?? "unknown error"),
      });
      return;
    }
    password.value = "";
    showToast({ kind: "success", title: "登录成功", message: "远程同步已就绪。" });
  } catch (error: any) {
    showToast({
      kind: "error",
      title: "登录失败",
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
    showToast({ kind: "info", title: "已退出", message: "远程访问令牌已清除。" });
  } catch (error: any) {
    showToast({
      kind: "error",
      title: "退出失败",
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
        title: "同步失败",
        message: String(result.error ?? result.state.lastError ?? "unknown error"),
      });
      return;
    }
    showToast({ kind: "success", title: "同步成功", message: "已推送最新状态到服务器。" });
  } catch (error: any) {
    showToast({
      kind: "error",
      title: "同步失败",
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
    showToast({ kind: "info", title: "状态已刷新", message: "已读取远程同步最新状态。" });
  } catch (error: any) {
    showToast({
      kind: "error",
      title: "刷新失败",
      message: String(error?.message ?? error ?? "unknown error"),
    });
  } finally {
    mutating.value = false;
  }
}
</script>

<style scoped>
.settings-card {
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, var(--surface-1) 86%, transparent);
  box-shadow: 0 14px 34px color-mix(in srgb, rgb(from var(--ui-shadow-source) r g b / 0.6) 18%, transparent);
  overflow: hidden;
}

.settings-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface-1) 92%, transparent),
    color-mix(in srgb, var(--surface-1) 76%, transparent)
  );
}

.settings-card-title {
  font-weight: 650;
  letter-spacing: 0.2px;
}

.settings-card-body {
  padding: 12px;
}

.settings-grid {
  display: grid;
  gap: 10px;
}

.settings-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.settings-inline {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.status-panel {
  padding: 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, var(--surface-1) 78%, transparent);
  display: grid;
  gap: 6px;
}

.status-panel.phase-error {
  border-color: color-mix(in srgb, var(--border-danger, var(--danger)) 68%, var(--border));
}

.status-panel.phase-syncing {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
}

.status-row {
  min-width: 0;
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.status-row > .mono:last-child {
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.status-row-error {
  align-items: flex-start;
}
</style>
