<template>
  <Teleport to="body" :disabled="isSettings">
    <Transition name="global-config-drawer">
      <div
        v-if="open"
        class="global-config-drawer-overlay"
        :class="{ 'is-settings': isSettings }"
        role="dialog"
        aria-modal="true"
        aria-label="应用更新"
        @click.self="onOverlayClick"
      >
        <div v-if="!isSettings" class="global-config-drawer-backdrop" @click="close"></div>
        <section class="global-config-drawer-panel" @click.stop>
          <header class="global-config-drawer-head">
            <div class="panel-title">应用更新</div>
            <div class="row global-config-head-actions">
              <button class="btn-mini" type="button" :disabled="!canCheckNow" @click="onCheckNow">检查更新</button>
              <button class="btn-mini" type="button" :disabled="!canDownloadNow" @click="onDownloadNow">
                重新下载
              </button>
              <button
                class="btn-mini btn-mini-primary"
                type="button"
                :disabled="!canRestartToInstall"
                @click="onRestartToInstall"
              >
                重启安装
              </button>
              <button v-if="!isSettings" ref="closeBtnRef" class="btn-mini" type="button" @click="close">关闭</button>
            </div>
          </header>

          <div class="global-config-drawer-body app-scrollbar" :class="{ 'is-settings': isSettings }">
            <section class="panel update-panel">
              <div class="panel-head">
                <div class="panel-title">当前状态</div>
                <div class="row" style="gap: 8px; align-items: center">
                  <span class="status-chip mono" :class="statusChipClass">{{ phaseLabel }}</span>
                  <span v-if="state.availableVersion" class="dim mono">目标 {{ state.availableVersion }}</span>
                </div>
              </div>

              <div class="update-info-grid">
                <div class="update-info-card">
                  <div class="update-info-key mono">当前版本</div>
                  <div class="update-info-value mono">{{ state.currentVersion || "unknown" }}</div>
                </div>
                <div class="update-info-card">
                  <div class="update-info-key mono">最近检查</div>
                  <div class="update-info-value mono">{{ lastCheckedText }}</div>
                </div>
                <div class="update-info-card">
                  <div class="update-info-key mono">下载完成</div>
                  <div class="update-info-value mono">{{ downloadedAtText }}</div>
                </div>
                <div class="update-info-card">
                  <div class="update-info-key mono">发布名称</div>
                  <div class="update-info-value mono">{{ state.releaseName || "—" }}</div>
                </div>
              </div>

              <Collapsible class="update-notes" :open="notesExpanded" @update:open="notesExpanded = $event">
                <template #trigger="{ triggerProps, open }">
                  <div class="update-notes-trigger" v-bind="triggerProps">
                    <div class="update-notes-trigger-main">
                      <div class="update-notes-title">更新内容</div>
                      <div class="update-notes-hint">支持标题、列表、链接和代码块</div>
                    </div>
                    <div class="update-notes-trigger-meta">
                      <span class="update-notes-trigger-status mono">{{
                        hasReleaseNotes ? (open ? "收起" : "展开") : "暂无内容"
                      }}</span>
                      <ChevronDown class="update-notes-trigger-icon" aria-hidden="true" />
                    </div>
                  </div>
                </template>
                <div
                  v-if="hasReleaseNotes"
                  class="update-notes-body app-scrollbar agent-markdown-body"
                  v-html="releaseNotesHtml"
                ></div>
                <div v-else class="update-notes-empty mono">暂无更新内容。</div>
              </Collapsible>

              <div v-if="showProgress" class="update-progress-wrap">
                <div class="update-progress-head">
                  <span class="update-progress-title">{{ progressTitle }}</span>
                  <span class="update-progress-value mono">{{ progressValueText }}</span>
                </div>
                <div class="update-progress-bar" aria-hidden="true" :class="progressBarClass">
                  <div class="update-progress-fill" :style="progressFillStyle"></div>
                </div>
                <div v-if="showProgressMeta" class="update-progress-meta mono dim">
                  {{ transferredText }} / {{ totalText }}
                  <span v-if="speedText"> · {{ speedText }}/s</span>
                </div>
              </div>

              <div v-if="state.phase === 'downloaded'" class="update-ready-banner">
                新版本已下载完成。点击“重启安装”后会先走当前应用的安全关闭流程，再启动安装。
              </div>

              <div v-if="state.phase === 'disabled'" class="update-note">
                当前为开发模式或未打包运行，在线更新不可用。
              </div>

              <div v-if="state.errorMessage" class="update-error mono">
                {{ state.errorMessage }}
              </div>
            </section>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ChevronDown } from "lucide-vue-next";
import Collapsible from "../ui/Collapsible.vue";
import { renderMarkdownToSafeHtml } from "../../features/timeline/markdownRenderer";
import { useMarkdownRendererRefresh } from "../../features/timeline/useMarkdownRendererRefresh";
import { useAppShellStore } from "../../stores/appShell.store";
import { useUpdateStore } from "../../stores/update.store";
import { showToast } from "../../ui/toast";

const appShellStore = useAppShellStore();
const updateStore = useUpdateStore();

const props = defineProps<{ mode?: "drawer" | "settings" }>();
const isSettings = computed(() => props.mode === "settings");
const open = computed(() => (isSettings.value ? true : appShellStore.updateDrawerOpen));
const state = computed(() => updateStore.state);
const closeBtnRef = ref<HTMLButtonElement | null>(null);
const restartPending = ref(false);
const notesExpanded = ref(true);
const { markdownRendererTick, refreshWhenReady } = useMarkdownRendererRefresh();

const phaseLabel = computed(() => {
  if (state.value.phase === "disabled") return "不可用";
  if (state.value.phase === "checking") return "检查中";
  if (state.value.phase === "available") return "发现更新";
  if (state.value.phase === "downloading") return "下载中";
  if (state.value.phase === "downloaded") return "待安装";
  if (state.value.phase === "error") return "失败";
  return state.value.lastCheckedAt > 0 ? "已经是最新版本" : "等待检查";
});

const statusChipClass = computed(() => {
  if (state.value.phase === "downloaded") return "success";
  if (state.value.phase === "available" || state.value.phase === "downloading" || state.value.phase === "checking")
    return "warn";
  if (state.value.phase === "error") return "error";
  return "success";
});

const canCheckNow = computed(
  () => state.value.enabled && state.value.phase !== "checking" && state.value.phase !== "downloading"
);
const canDownloadNow = computed(
  () =>
    state.value.enabled &&
    (state.value.phase === "available" || (state.value.phase === "error" && Boolean(state.value.availableVersion)))
);
const canRestartToInstall = computed(
  () => state.value.enabled && state.value.phase === "downloaded" && !restartPending.value
);
const showProgress = computed(
  () => state.value.phase === "checking" || state.value.phase === "downloading" || state.value.phase === "downloaded"
);
const progressPercent = computed(() => Math.max(0, Math.min(100, Number(state.value.downloadProgressPercent || 0))));
const progressTitle = computed(() => (state.value.phase === "checking" ? "检查进度" : "下载进度"));
const progressValueText = computed(() => (state.value.phase === "checking" ? "…" : progressText.value));
const showProgressMeta = computed(() => state.value.phase !== "checking");
const progressFillStyle = computed(() => {
  if (state.value.phase === "checking") return undefined;
  return { width: `${progressPercent.value}%` };
});
const progressBarClass = computed(() => ({
  "is-indeterminate": state.value.phase === "checking",
  "is-active": state.value.phase === "downloading",
}));

function formatTimestamp(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return new Date(value).toLocaleString("zh-CN");
}

function formatBytes(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let current = n;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  const digits = current >= 100 || unitIndex === 0 ? 0 : current >= 10 ? 1 : 2;
  return `${current.toFixed(digits)} ${units[unitIndex]}`;
}

const lastCheckedText = computed(() => formatTimestamp(state.value.lastCheckedAt));
const downloadedAtText = computed(() => formatTimestamp(state.value.downloadedAt));
const transferredText = computed(() => formatBytes(state.value.transferredBytes));
const totalText = computed(() => formatBytes(state.value.totalBytes));
const speedText = computed(() => (state.value.bytesPerSecond > 0 ? formatBytes(state.value.bytesPerSecond) : ""));
const progressText = computed(() => `${progressPercent.value.toFixed(progressPercent.value >= 100 ? 0 : 1)}%`);
const releaseNotesText = computed(() => String(state.value.releaseNotes ?? "").trim());
const hasReleaseNotes = computed(() => releaseNotesText.value.length > 0);
const releaseNotesHtml = computed(() => {
  if (!hasReleaseNotes.value) return "";
  void markdownRendererTick.value;
  const html = renderMarkdownToSafeHtml(releaseNotesText.value);
  refreshWhenReady();
  return html;
});

function close() {
  if (isSettings.value) return;
  appShellStore.setUpdateDrawerOpen(false);
}

function onOverlayClick() {
  if (isSettings.value) return;
  close();
}

async function onCheckNow() {
  try {
    await updateStore.check();
  } catch (error: any) {
    showToast({
      kind: "error",
      title: "检查更新失败",
      message: String(error?.message ?? error ?? "unknown error"),
    });
  }
}

async function onDownloadNow() {
  try {
    await updateStore.download();
  } catch (error: any) {
    showToast({
      kind: "error",
      title: "下载更新失败",
      message: String(error?.message ?? error ?? "unknown error"),
    });
  }
}

async function onRestartToInstall() {
  restartPending.value = true;
  try {
    await updateStore.restartToInstall();
  } catch (error: any) {
    restartPending.value = false;
    showToast({
      kind: "error",
      title: "启动安装失败",
      message: String(error?.message ?? error ?? "unknown error"),
    });
  }
}

const onWindowKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  if (!open.value) return;
  close();
};

onMounted(() => {
  window.addEventListener("keydown", onWindowKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onWindowKeydown);
});

watch(open, async (next) => {
  if (!next) return;
  notesExpanded.value = true;
  await updateStore.refreshState().catch(() => undefined);
  await nextTick();
  closeBtnRef.value?.focus();
});

watch(
  releaseNotesText,
  (next) => {
    if (next) notesExpanded.value = true;
  },
  { immediate: true }
);
</script>

<style scoped>
.update-panel {
  display: grid;
  gap: 14px;
}

.update-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.update-info-card {
  min-width: 0;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--panel-border, var(--border));
  background: color-mix(in srgb, var(--surface-1) 84%, transparent);
  display: grid;
  gap: 6px;
}

.update-info-key {
  font-size: 12px;
  color: var(--text-muted, var(--text));
}

.update-info-value {
  font-size: 12px;
  color: var(--text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.update-progress-wrap {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--panel-border, var(--border));
  background: color-mix(in srgb, var(--surface-1) 80%, transparent);
}

.update-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.update-progress-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.update-progress-value {
  font-size: 12px;
  color: var(--text);
}

.update-progress-bar {
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in srgb, var(--surface-1) 70%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
}

.update-progress-fill {
  position: relative;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgb(from var(--accent) r g b / 0.92), rgb(from var(--success) r g b / 0.92));
  transition: width 180ms ease;
}

.update-progress-bar.is-indeterminate {
  position: relative;
}

.update-progress-bar.is-indeterminate .update-progress-fill {
  width: 36%;
  position: absolute;
  left: 0;
  animation: update-progress-indeterminate 1.15s ease-in-out infinite;
  transition: none;
  will-change: transform;
}

.update-progress-bar.is-active .update-progress-fill::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-110%);
  background: linear-gradient(90deg, transparent, var(--ui-shimmer-highlight), transparent);
  animation: update-progress-shimmer 1.25s linear infinite;
  pointer-events: none;
}

@keyframes update-progress-indeterminate {
  0% {
    transform: translateX(-60%);
  }
  50% {
    transform: translateX(155%);
  }
  100% {
    transform: translateX(-60%);
  }
}

@keyframes update-progress-shimmer {
  0% {
    transform: translateX(-110%);
  }
  100% {
    transform: translateX(110%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .update-progress-bar.is-indeterminate .update-progress-fill {
    animation: none;
    transform: none;
    width: 45%;
  }

  .update-progress-bar.is-active .update-progress-fill::after {
    animation: none;
  }
}

.update-progress-meta {
  font-size: 12px;
}

.update-ready-banner,
.update-note,
.update-error {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--panel-border, var(--border));
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.update-ready-banner {
  background: color-mix(in srgb, var(--bg-success-soft) 60%, var(--surface-1));
  border-color: color-mix(in srgb, var(--border-success) 68%, var(--border));
  color: var(--text);
}

.update-note {
  background: color-mix(in srgb, var(--surface-1) 74%, transparent);
  color: var(--text-muted, var(--text));
}

.update-error {
  background: color-mix(in srgb, var(--bg-danger-soft) 64%, var(--surface-1));
  border-color: color-mix(in srgb, var(--border-danger) 72%, var(--border));
  color: var(--text);
}

.update-notes {
  display: grid;
  gap: 8px;
}

.update-notes-trigger {
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--panel-border, var(--border));
  background: color-mix(in srgb, var(--surface-1) 82%, transparent);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition:
    border-color 150ms ease,
    background-color 150ms ease,
    box-shadow 150ms ease;
}

.update-notes-trigger:hover {
  border-color: color-mix(in srgb, var(--border) 78%, var(--accent-soft, var(--accent)));
  background: color-mix(in srgb, var(--surface-1) 88%, transparent);
}

.update-notes-trigger-main {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.update-notes-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.update-notes-hint {
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-muted, var(--text));
}

.update-notes-trigger-meta {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.update-notes-trigger-status {
  font-size: 11px;
  color: var(--text-muted, var(--text));
  white-space: nowrap;
}

.update-notes-trigger-icon {
  width: 16px;
  height: 16px;
  flex: none;
  opacity: 0.8;
  transition: transform 150ms ease;
}

.update-notes.is-open .update-notes-trigger-icon {
  transform: rotate(180deg);
}

.update-notes-body,
.update-notes-empty {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--panel-border, var(--border));
  background: color-mix(in srgb, var(--surface-1) 78%, transparent);
  color: var(--text);
  font-size: 12px;
  line-height: 1.5;
}

.update-notes-body {
  max-height: 260px;
  overflow: auto;
}

.update-notes-empty {
  border-style: dashed;
  color: var(--text-muted, var(--text));
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.btn-mini-primary {
  border-color: color-mix(in srgb, var(--accent-soft, var(--accent)) 64%, var(--border));
  background: color-mix(in srgb, var(--accent-soft, var(--accent)) 18%, var(--surface-1));
}
</style>
