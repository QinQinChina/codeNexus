<template>
  <aside class="sidebar sidebar-left image-workspace-sidebar" :aria-label="t('imageWorkspace.aria')">
    <div class="lsb-shell image-workspace-shell">
      <section class="lsb-pane-frame">
        <div class="lsb-pane-content image-workspace-pane">
          <header class="lsb-pane-head image-workspace-head">
            <div class="lsb-pane-head-row">
              <div class="image-workspace-title-block">
                <span class="image-workspace-title-icon" aria-hidden="true">
                  <ImageIcon />
                </span>
                <div class="image-workspace-title-copy">
                  <h2 class="lsb-pane-title">{{ t("imageWorkspace.title") }}</h2>
                  <div class="image-workspace-summary mono">
                    {{ t("imageWorkspace.recordCount", { count: workbench.historyItems.length }) }}
                  </div>
                </div>
              </div>
              <button
                class="lsb-icon-btn image-workspace-refresh"
                type="button"
                :aria-label="t('common.refresh')"
                :disabled="workbench.historyLoading"
                @click="refresh"
              >
                <RefreshCw :class="{ 'is-spinning': workbench.historyLoading }" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div class="lsb-scroll image-workspace-scroll app-scrollbar">
            <div v-if="workbench.historyLoading && workbench.historyItems.length === 0" class="image-workspace-empty">
              <Loader2 class="is-spinning" aria-hidden="true" />
              <span>{{ t("imageWorkbench.loadingHistory") }}</span>
            </div>

            <div v-else-if="groups.length === 0" class="image-workspace-empty">
              <ImageIcon aria-hidden="true" />
              <span>{{ t("imageWorkbench.emptyHistory") }}</span>
            </div>

            <template v-else>
              <section v-for="group in groups" :key="group.key" class="image-workspace-group">
                <button class="image-workspace-group__head" type="button" @click="toggleGroup(group.key)">
                  <ChevronDown
                    class="image-workspace-group__chevron"
                    :class="{ 'is-collapsed': isGroupCollapsed(group.key) }"
                    aria-hidden="true"
                  />
                  <span class="image-workspace-group__title" :title="group.path || group.label">{{ group.label }}</span>
                  <span class="image-workspace-group__count mono">{{ group.items.length }}</span>
                </button>

                <div v-if="!isGroupCollapsed(group.key)" class="image-workspace-list">
                  <article
                    v-for="item in group.items"
                    :key="item.id"
                    class="image-workspace-item"
                    :class="[
                      `is-${statusKind(item)}`,
                      { 'is-selected': item.id === workbench.selectedHistoryId, 'is-disabled': !isSelectable(item) },
                    ]"
                    :role="isSelectable(item) ? 'button' : undefined"
                    :tabindex="isSelectable(item) ? 0 : -1"
                    @click="selectItem(item)"
                    @keydown.enter.prevent="selectItem(item)"
                    @keydown.space.prevent="selectItem(item)"
                  >
                    <div class="image-workspace-item__thumb">
                      <img v-if="thumbSrc(item)" :src="thumbSrc(item)" :alt="item.prompt" loading="lazy" />
                      <Loader2 v-else-if="isPending(item)" class="is-spinning" aria-hidden="true" />
                      <button
                        v-else-if="item.taskId && isProblem(item)"
                        class="image-workspace-item__thumb-retry"
                        type="button"
                        :aria-label="t('imageWorkbench.retryTask')"
                        @click.stop="workbench.retryTask(item.taskId)"
                      >
                        <RotateCcw aria-hidden="true" />
                      </button>
                      <RotateCcw v-else-if="isProblem(item)" aria-hidden="true" />
                      <ImageIcon v-else aria-hidden="true" />
                    </div>

                    <div class="image-workspace-item__body">
                      <div class="image-workspace-item__meta">
                        <span class="image-workspace-item__time mono">{{ formatTime(item.createdAt) }}</span>
                        <span class="image-workspace-item__status">{{ statusLabel(item) }}</span>
                      </div>
                      <div class="image-workspace-item__prompt">{{ item.prompt }}</div>
                    </div>

                    <div class="image-workspace-item__actions">
                      <button
                        v-if="item.taskId && isPending(item)"
                        class="image-workspace-action"
                        type="button"
                        :aria-label="t('imageWorkbench.cancelTask')"
                        @click.stop="workbench.cancelTask(item.taskId)"
                      >
                        <X aria-hidden="true" />
                      </button>
                      <button
                        class="image-workspace-action is-danger"
                        type="button"
                        :aria-label="t('imageWorkbench.delete')"
                        @click.stop="workbench.deleteHistoryItem(item.id)"
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                </div>
              </section>
            </template>
          </div>
        </div>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronDown, Image as ImageIcon, Loader2, RefreshCw, RotateCcw, Trash2, X } from "lucide-vue-next";
import { readLocalImageDataUrl } from "../../../features/media/localImageCache";
import { useImageWorkbenchStore, type ImageWorkbenchHistoryItem } from "../../../stores/imageWorkbench.store";
import { useRuntimeStore } from "../../../stores/runtime.store";

const UNASSIGNED_WORKSPACE_KEY = "__unassigned__";

const { t, locale } = useI18n();
const workbench = useImageWorkbenchStore();
const runtimeStore = useRuntimeStore();
const collapsedByKey = ref<Record<string, boolean>>({});
const thumbByPath = ref<Record<string, string>>({});
const thumbLoadingByPath = ref<Record<string, boolean>>({});

type ImageWorkspaceGroup = {
  key: string;
  label: string;
  path: string | null;
  latestAt: number;
  items: ImageWorkbenchHistoryItem[];
};

const currentWorkspacePath = computed(() => String(runtimeStore.workspacePath ?? "").trim());

const groups = computed<ImageWorkspaceGroup[]>(() => {
  const byKey = new Map<string, ImageWorkspaceGroup>();
  for (const item of workbench.historyItems) {
    const workspacePath = String(item.workspacePath ?? "").trim();
    const key = workspacePath || UNASSIGNED_WORKSPACE_KEY;
    const existing = byKey.get(key);
    const createdAt = Number(item.createdAt) || 0;
    if (existing) {
      existing.latestAt = Math.max(existing.latestAt, createdAt);
      existing.items.push(item);
      continue;
    }
    byKey.set(key, {
      key,
      label: workspacePath ? basename(workspacePath) : t("imageWorkspace.unassigned"),
      path: workspacePath || null,
      latestAt: createdAt,
      items: [item],
    });
  }

  return [...byKey.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => Number(b.createdAt) - Number(a.createdAt)),
    }))
    .sort((a, b) => {
      const current = currentWorkspacePath.value;
      if (current && a.path === current && b.path !== current) return -1;
      if (current && b.path === current && a.path !== current) return 1;
      if (a.key === UNASSIGNED_WORKSPACE_KEY && b.key !== UNASSIGNED_WORKSPACE_KEY) return 1;
      if (b.key === UNASSIGNED_WORKSPACE_KEY && a.key !== UNASSIGNED_WORKSPACE_KEY) return -1;
      return b.latestAt - a.latestAt;
    });
});

function basename(pathValue: string): string {
  const normalized = String(pathValue ?? "").replace(/[\\/]+$/, "");
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) || normalized || t("imageWorkspace.unknownWorkspace");
}

function statusKind(item: ImageWorkbenchHistoryItem): "ready" | "pending" | "failed" | "canceled" {
  return item.workbenchStatus ?? "ready";
}

function isPending(item: ImageWorkbenchHistoryItem): boolean {
  return statusKind(item) === "pending";
}

function isProblem(item: ImageWorkbenchHistoryItem): boolean {
  return statusKind(item) === "failed" || statusKind(item) === "canceled";
}

function isSelectable(item: ImageWorkbenchHistoryItem): boolean {
  return statusKind(item) === "ready" && item.images.length > 0;
}

function statusLabel(item: ImageWorkbenchHistoryItem): string {
  const status = statusKind(item);
  if (status === "pending") return item.errorText || t("imageWorkbench.generating");
  if (status === "failed") return t("imageWorkbench.generationFailed");
  if (status === "canceled") return t("imageWorkbench.canceled");
  return t("imageWorkbench.succeeded");
}

function formatTime(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("imageWorkbench.unknownTime");
  return date.toLocaleString(String(locale.value), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function firstImagePath(item: ImageWorkbenchHistoryItem): string {
  return String(item.images[0]?.path ?? "").trim();
}

function thumbSrc(item: ImageWorkbenchHistoryItem): string {
  const path = firstImagePath(item);
  return path ? (thumbByPath.value[path] ?? "") : "";
}

function isGroupCollapsed(key: string): boolean {
  return Boolean(collapsedByKey.value[key]);
}

function toggleGroup(key: string) {
  collapsedByKey.value = { ...collapsedByKey.value, [key]: !collapsedByKey.value[key] };
}

function selectItem(item: ImageWorkbenchHistoryItem) {
  if (!isSelectable(item)) return;
  workbench.selectHistoryItem(item.id);
}

async function ensureThumb(pathValue: string) {
  const path = String(pathValue ?? "").trim();
  if (!path || thumbByPath.value[path] || thumbLoadingByPath.value[path]) return;
  thumbLoadingByPath.value = { ...thumbLoadingByPath.value, [path]: true };
  try {
    const dataUrl = await readLocalImageDataUrl(path);
    if (dataUrl) thumbByPath.value = { ...thumbByPath.value, [path]: dataUrl };
  } catch {
    thumbByPath.value = { ...thumbByPath.value, [path]: "" };
  } finally {
    thumbLoadingByPath.value = { ...thumbLoadingByPath.value, [path]: false };
  }
}

function refresh() {
  void workbench.loadHistory();
}

watch(
  () =>
    workbench.historyItems
      .map((item) => firstImagePath(item))
      .filter(Boolean)
      .join("\n"),
  (pathsText) => {
    for (const path of pathsText.split("\n").filter(Boolean)) {
      void ensureThumb(path);
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.image-workspace-shell {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--lsb-bg-strong) 96%, transparent), var(--lsb-bg)), var(--lsb-bg);
}

.image-workspace-head {
  position: relative;
  padding: 12px 12px 10px;
  overflow: hidden;
  border-bottom-color: color-mix(in srgb, var(--lsb-line) 76%, transparent);
  background:
    radial-gradient(circle at 16px 12px, color-mix(in srgb, var(--lsb-accent) 12%, transparent), transparent 30px),
    linear-gradient(180deg, color-mix(in srgb, var(--lsb-bg-strong) 98%, transparent), var(--lsb-bg));
}

.image-workspace-head::after {
  content: "";
  position: absolute;
  right: 16px;
  bottom: -1px;
  left: 16px;
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--lsb-accent) 32%, transparent), transparent);
  pointer-events: none;
}

.image-workspace-head .lsb-pane-head-row {
  position: relative;
  z-index: 1;
  align-items: center;
  gap: 10px;
}

.image-workspace-title-block {
  min-width: 0;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
}

.image-workspace-title-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--lsb-accent) 24%, var(--lsb-line));
  border-radius: 8px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--lsb-accent) 12%, transparent), transparent),
    color-mix(in srgb, var(--lsb-surface) 82%, transparent);
  color: color-mix(in srgb, var(--lsb-accent) 82%, var(--lsb-text));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 10%, transparent);
}

.image-workspace-title-icon svg {
  width: 14px;
  height: 14px;
}

.image-workspace-title-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.image-workspace-head .lsb-pane-title {
  font-size: 16px;
  letter-spacing: -0.015em;
  line-height: 1.12;
}

.image-workspace-summary {
  color: color-mix(in srgb, var(--lsb-muted) 86%, var(--lsb-text));
  font-size: 10.5px;
  line-height: 1.2;
}

.image-workspace-refresh {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  min-width: 28px;
  padding: 0;
  border-radius: 7px;
  border-color: color-mix(in srgb, var(--lsb-line) 82%, var(--lsb-accent) 18%);
  background:
    linear-gradient(180deg, color-mix(in srgb, white 6%, transparent), transparent),
    color-mix(in srgb, var(--lsb-surface) 86%, transparent);
  color: var(--lsb-muted);
  box-shadow: 0 8px 18px color-mix(in srgb, black 16%, transparent);
}

.image-workspace-refresh svg {
  width: 14px;
  height: 14px;
}

.image-workspace-refresh:hover:not(:disabled) {
  color: var(--lsb-text);
  border-color: color-mix(in srgb, var(--lsb-accent) 42%, var(--lsb-line));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--lsb-accent) 12%, transparent), transparent),
    color-mix(in srgb, var(--lsb-surface-hover) 90%, transparent);
}

.image-workspace-refresh:disabled {
  opacity: 0.62;
  box-shadow: none;
}

.image-workspace-scroll {
  gap: 10px;
}

.image-workspace-empty {
  min-height: 138px;
  display: grid;
  place-items: center;
  gap: 8px;
  border: 1px dashed var(--lsb-line);
  border-radius: 8px;
  color: var(--lsb-muted);
  font-size: 12px;
  text-align: center;
  padding: 16px;
}

.image-workspace-empty svg {
  width: 22px;
  height: 22px;
  color: var(--lsb-accent);
}

.image-workspace-group {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.image-workspace-group__head {
  min-width: 0;
  height: 30px;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--lsb-muted);
  padding: 0 6px;
  text-align: left;
}

.image-workspace-group__head:hover {
  background: var(--lsb-surface-hover);
  color: var(--lsb-text);
}

.image-workspace-group__chevron {
  width: 14px;
  height: 14px;
  transition: transform 140ms ease;
}

.image-workspace-group__chevron.is-collapsed {
  transform: rotate(-90deg);
}

.image-workspace-group__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 760;
}

.image-workspace-group__count {
  font-size: 11px;
}

.image-workspace-list {
  display: grid;
  gap: 6px;
}

.image-workspace-item {
  position: relative;
  min-width: 0;
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 9px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: color-mix(in srgb, var(--lsb-surface) 72%, transparent);
  padding: 7px;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease;
}

.image-workspace-item:hover {
  border-color: color-mix(in srgb, var(--lsb-accent) 32%, transparent);
  background: color-mix(in srgb, var(--lsb-accent) 8%, var(--lsb-surface));
}

.image-workspace-item.is-selected {
  border-color: color-mix(in srgb, var(--lsb-accent) 46%, transparent);
  background: var(--lsb-surface-active);
  box-shadow: var(--lsb-active-shadow);
}

.image-workspace-item.is-disabled {
  cursor: default;
}

.image-workspace-item.is-failed,
.image-workspace-item.is-canceled {
  border-color: color-mix(in srgb, var(--danger) 24%, transparent);
}

.image-workspace-item__thumb {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--lsb-line);
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg) 80%, var(--surface-1));
  color: var(--lsb-muted);
}

.image-workspace-item__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-workspace-item__thumb-retry {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.image-workspace-item__thumb-retry:hover {
  background: color-mix(in srgb, var(--fg-danger) 8%, transparent);
}

.image-workspace-item__thumb svg {
  width: 18px;
  height: 18px;
}

.image-workspace-item__body {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 4px;
  padding-right: 28px;
}

.image-workspace-item__meta {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--lsb-muted);
  font-size: 10px;
}

.image-workspace-item__time,
.image-workspace-item__status {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-workspace-item__status {
  flex: 0 0 auto;
  font-weight: 750;
}

.image-workspace-item.is-ready .image-workspace-item__status {
  color: var(--success, var(--lsb-accent));
}

.image-workspace-item.is-pending .image-workspace-item__status {
  color: var(--lsb-accent);
}

.image-workspace-item.is-failed .image-workspace-item__status,
.image-workspace-item.is-canceled .image-workspace-item__status,
.image-workspace-item__error {
  color: var(--fg-danger);
}

.image-workspace-item__prompt,
.image-workspace-item__error {
  min-width: 0;
  display: -webkit-box;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.35;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
}

.image-workspace-item__prompt {
  color: var(--lsb-text);
  -webkit-line-clamp: 2;
}

.image-workspace-item__error {
  -webkit-line-clamp: 1;
}

.image-workspace-item__actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 120ms ease;
}

.image-workspace-item:hover .image-workspace-item__actions,
.image-workspace-item:focus-within .image-workspace-item__actions,
.image-workspace-item.is-failed .image-workspace-item__actions,
.image-workspace-item.is-canceled .image-workspace-item__actions {
  opacity: 1;
}

.image-workspace-action {
  width: 24px;
  height: 24px;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--lsb-line);
  border-radius: 5px;
  background: color-mix(in srgb, var(--lsb-bg) 84%, transparent);
  color: var(--lsb-muted);
}

.image-workspace-action:hover {
  border-color: color-mix(in srgb, currentColor 44%, var(--lsb-line));
  background: color-mix(in srgb, currentColor 10%, var(--lsb-bg));
  color: var(--lsb-text);
}

.image-workspace-action.is-danger {
  color: var(--fg-danger);
}

.image-workspace-action svg {
  width: 13px;
  height: 13px;
}

.is-spinning {
  animation: image-workspace-spin 1s linear infinite;
}

@keyframes image-workspace-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
