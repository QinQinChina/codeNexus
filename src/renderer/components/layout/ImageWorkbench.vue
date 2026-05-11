<template>
  <section class="image-workbench" aria-label="图片工作台">
    <header class="image-workbench__header">
      <div class="image-workbench__title-block">
        <div class="image-workbench__eyebrow">Images</div>
        <h1 class="image-workbench__title">图片工作台</h1>
        <p class="image-workbench__desc">生成结果 / 效果预览</p>
      </div>

      <div class="image-workbench__actions">
        <button class="btn-mini" type="button" @click="openApiSettings">
          <Settings2 class="btn-mini__icon" aria-hidden="true" />
          <span>API 设置</span>
        </button>
        <button class="btn-mini" type="button" :disabled="workbench.busy || !workbench.canGenerate" @click="workbench.generate">
          <Loader2 v-if="workbench.busy" class="btn-mini__icon is-spinning" aria-hidden="true" />
          <Wand2 v-else class="btn-mini__icon" aria-hidden="true" />
          <span>{{ workbench.busy ? "生成中" : "生成" }}</span>
        </button>
      </div>
    </header>

    <div v-if="!workbench.configured" class="image-workbench__notice">
      <AlertTriangle class="image-workbench__notice-icon" aria-hidden="true" />
      <div class="image-workbench__notice-body">
        <div class="image-workbench__notice-title">图片生成尚未配置</div>
        <div class="image-workbench__notice-text">先填写服务地址、API Key 和默认模型，然后再发起请求。</div>
      </div>
    </div>

    <section class="image-workbench__stage">
      <div class="image-workbench__stage-head">
        <span>{{ selectedHistoryItem ? "详情" : "历史记录" }}</span>
        <span class="mono">{{ workbench.historyItems.length }} 次生成</span>
      </div>

      <div v-if="workbench.busy && workbench.historyItems.length === 0" class="image-workbench__empty">
        <Loader2 class="image-workbench__empty-icon is-spinning" aria-hidden="true" />
        <div>等待 API 返回图片。</div>
      </div>

      <div v-else-if="selectedHistoryItem" class="image-workbench__result-stack">
        <div class="image-workbench__detail-bar">
          <button class="btn-mini" type="button" @click="workbench.backToHistory">
            <ArrowLeft class="btn-mini__icon" aria-hidden="true" />
            <span>历史</span>
          </button>
          <button class="btn-mini btn-mini--danger" type="button" @click="workbench.deleteHistoryItem(selectedHistoryItem.id)">
            <Trash2 class="btn-mini__icon" aria-hidden="true" />
            <span>删除</span>
          </button>
        </div>

        <div class="image-workbench__summary">
          <div class="image-workbench__summary-row">
            <span class="dim">模型</span>
            <span class="mono">{{ selectedHistoryItem.model }}</span>
          </div>
          <div class="image-workbench__summary-row">
            <span class="dim">提示词</span>
            <span class="mono">{{ selectedHistoryItem.prompt }}</span>
          </div>
          <div v-if="selectedHistoryItem.revisedPrompt" class="image-workbench__summary-row">
            <span class="dim">修订</span>
            <span class="mono">{{ selectedHistoryItem.revisedPrompt }}</span>
          </div>
          <div class="image-workbench__summary-row">
            <span class="dim">参数</span>
            <span class="mono">{{ formatHistoryParams(selectedHistoryItem) }}</span>
          </div>
          <div class="image-workbench__summary-row">
            <span class="dim">时间</span>
            <span class="mono">{{ formatDateTime(selectedHistoryItem.createdAt) }}</span>
          </div>
        </div>

        <div class="image-workbench__result-grid">
          <article v-for="image in selectedHistoryItem.images" :key="image.path" class="image-workbench__result">
            <div class="image-workbench__result-tools">
              <span class="image-workbench__zoom mono">{{ Math.round(getImageZoom(image.path) * 100) }}%</span>
              <button class="image-workbench__tool" type="button" title="缩小" @click="zoomImage(image.path, 1 / ZOOM_STEP)">
                <ZoomOut aria-hidden="true" />
              </button>
              <button class="image-workbench__tool" type="button" title="放大" @click="zoomImage(image.path, ZOOM_STEP)">
                <ZoomIn aria-hidden="true" />
              </button>
              <button class="image-workbench__tool" type="button" title="重置视图" @click="resetImageZoom(image.path)">
                <RotateCcw aria-hidden="true" />
              </button>
              <button class="image-workbench__tool" type="button" title="下载图片" @click="downloadImage(image)">
                <Download aria-hidden="true" />
              </button>
            </div>
            <div class="image-workbench__result-viewport" @wheel="onImageWheel(image.path, $event)">
              <Loader2 v-if="imageDataUrlLoading[image.path]" class="image-workbench__image-state is-spinning" aria-hidden="true" />
              <img
                v-else-if="imageDataUrlByPath[image.path]"
                :src="imageDataUrlByPath[image.path]"
                :alt="image.path"
                :style="{ transform: `scale(${getImageZoom(image.path)})` }"
                draggable="false"
              />
              <div v-else class="image-workbench__image-missing">图片不可用</div>
            </div>
            <div class="image-workbench__result-meta">
              <span class="mono">{{ image.mimeType }}</span>
              <span class="mono image-workbench__path">{{ image.path }}</span>
            </div>
          </article>
        </div>
      </div>

      <div v-else-if="workbench.historyItems.length > 0" class="image-workbench__history-grid">
        <article
          v-for="item in workbench.historyItems"
          :key="item.id"
          class="image-workbench__history-card"
          role="button"
          tabindex="0"
          @click="workbench.selectHistoryItem(item.id)"
          @keydown.enter.prevent="workbench.selectHistoryItem(item.id)"
          @keydown.space.prevent="workbench.selectHistoryItem(item.id)"
        >
          <div class="image-workbench__history-preview">
            <template v-for="image in item.images.slice(0, 4)" :key="image.path">
              <img v-if="imageDataUrlByPath[image.path]" :src="imageDataUrlByPath[image.path]" :alt="image.path" />
              <div v-else class="image-workbench__history-tile">
                <ImageIcon aria-hidden="true" />
              </div>
            </template>
          </div>
          <div class="image-workbench__history-body">
            <div class="image-workbench__history-title">{{ item.prompt }}</div>
            <div class="image-workbench__history-meta">
              <span class="mono">{{ item.images.length }} 张</span>
              <span class="mono">{{ item.size || "auto" }}</span>
              <span class="mono">{{ formatDateTime(item.createdAt) }}</span>
            </div>
            <div class="image-workbench__history-model mono">{{ item.model }}</div>
          </div>
        </article>
      </div>

      <div v-else class="image-workbench__empty">
        <ImageIcon class="image-workbench__empty-icon" aria-hidden="true" />
        <div>{{ workbench.historyLoading ? "正在加载图片历史。" : "生成或编辑图片后，这里会保存每一次记录。" }}</div>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from "vue";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Settings2,
  Trash2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-vue-next";
import { useAppShellStore } from "../../stores/appShell.store";
import { useImageWorkbenchStore } from "../../stores/imageWorkbench.store";

const appShellStore = useAppShellStore();
const workbench = useImageWorkbenchStore();
const imageZoomByPath = ref<Record<string, number>>({});
const imageDataUrlByPath = ref<Record<string, string>>({});
const imageDataUrlLoading = ref<Record<string, boolean>>({});

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;
const ZOOM_STEP = 1.18;

type WorkbenchImage = NonNullable<typeof workbench.selectedHistoryItem>["images"][number];

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function sanitizeDownloadName(value: string): string {
  const name = String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ");
  return name || "image";
}

function extensionFromImage(image: WorkbenchImage): string {
  const mimeExt = image.mimeType.match(/^image\/([a-z0-9.+-]+)$/i)?.[1]?.toLowerCase();
  if (mimeExt) {
    if (mimeExt === "jpeg") return "jpg";
    if (mimeExt === "svg+xml") return "svg";
    return mimeExt;
  }
  const pathExt = image.path.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  return pathExt?.toLowerCase() || "png";
}

function getImageZoom(path: string): number {
  return imageZoomByPath.value[path] ?? 1;
}

function setImageZoom(path: string, zoom: number) {
  imageZoomByPath.value = {
    ...imageZoomByPath.value,
    [path]: clampNumber(zoom, MIN_ZOOM, MAX_ZOOM),
  };
}

function zoomImage(path: string, factor: number) {
  setImageZoom(path, getImageZoom(path) * factor);
}

function resetImageZoom(path: string) {
  setImageZoom(path, 1);
}

function onImageWheel(path: string, event: WheelEvent) {
  event.preventDefault();
  zoomImage(path, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
}

function downloadImage(image: WorkbenchImage) {
  if (typeof document === "undefined") return;
  const src = String(imageDataUrlByPath.value[image.path] ?? "").trim();
  if (!src) return;
  const link = document.createElement("a");
  const baseName = sanitizeDownloadName(image.path || "generated-image");
  link.href = src;
  link.download = `${baseName}.${extensionFromImage(image)}`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function formatDateTime(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHistoryParams(item: NonNullable<typeof workbench.selectedHistoryItem>): string {
  return [item.mode, item.size, item.quality, item.outputFormat].filter(Boolean).join(" / ") || "auto";
}

async function ensureImageDataUrl(path: string) {
  const normalized = String(path ?? "").trim();
  if (!normalized || imageDataUrlByPath.value[normalized] || imageDataUrlLoading.value[normalized]) return;
  imageDataUrlLoading.value = { ...imageDataUrlLoading.value, [normalized]: true };
  try {
    const res = await codexDesktop.app.readImageFileDataUrl({ path: normalized });
    imageDataUrlByPath.value = { ...imageDataUrlByPath.value, [normalized]: res.dataUrl };
  } catch {
    imageDataUrlByPath.value = { ...imageDataUrlByPath.value, [normalized]: "" };
  } finally {
    imageDataUrlLoading.value = { ...imageDataUrlLoading.value, [normalized]: false };
  }
}

const selectedHistoryItem = computed(() => workbench.selectedHistoryItem);

function openApiSettings() {
  appShellStore.openSettings("image");
}

onBeforeMount(() => {
  void workbench.loadHistory();
});

watch(
  () => appShellStore.settingsOpen,
  (open) => {
    if (open) return;
    workbench.syncSettingsFromCache();
  }
);

watch(
  () => selectedHistoryItem.value?.images.map((image) => image.path).join("\n") ?? "",
  () => {
    imageZoomByPath.value = {};
  }
);

watch(
  () => workbench.historyItems.flatMap((item) => item.images.slice(0, 4).map((image) => image.path)).join("\n"),
  (pathsText) => {
    for (const path of pathsText.split("\n").filter(Boolean)) {
      void ensureImageDataUrl(path);
    }
  },
  { immediate: true }
);

watch(
  () => selectedHistoryItem.value?.images.map((image) => image.path).join("\n") ?? "",
  (pathsText) => {
    for (const path of pathsText.split("\n").filter(Boolean)) {
      void ensureImageDataUrl(path);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  workbench.stopDrag();
});
</script>

<style scoped>
.image-workbench {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
  width: 100%;
  height: 100%;
  padding: 14px 14px 18px;
}

.image-workbench__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.image-workbench__title-block {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.image-workbench__eyebrow {
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.image-workbench__title {
  margin: 0;
  color: var(--text);
  font-size: 20px;
  font-weight: 750;
  line-height: 1.15;
}

.image-workbench__desc {
  margin: 0;
  color: var(--text-dim, var(--text-muted));
}

.image-workbench__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.image-workbench__notice {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--border-warning) 80%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-warning-soft) 64%, transparent);
}

.image-workbench__notice-icon {
  width: 18px;
  height: 18px;
  color: var(--warning);
  flex: none;
  margin-top: 1px;
}

.image-workbench__notice-body {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.image-workbench__notice-title {
  color: var(--text);
  font-weight: 700;
}

.image-workbench__notice-text {
  color: var(--text-muted);
  font-size: 12px;
}

.image-workbench__stage {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  overflow: hidden;
}

.image-workbench__stage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.image-workbench__empty {
  display: grid;
  min-height: 0;
  place-items: center;
  gap: 10px;
  border: 1px dashed color-mix(in srgb, var(--border) 82%, transparent);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 7%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface-1) 72%, transparent);
  color: var(--text-muted);
  padding: 24px;
  text-align: center;
}

.image-workbench__empty-icon {
  width: 26px;
  height: 26px;
  color: var(--accent);
}

.image-workbench__result-stack {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 12px;
  overflow: hidden;
}

.image-workbench__detail-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.btn-mini--danger {
  color: var(--danger, #ef4444);
}

.btn-mini--danger:hover {
  border-color: color-mix(in srgb, var(--danger, #ef4444) 48%, var(--border));
  background: color-mix(in srgb, var(--danger, #ef4444) 10%, var(--bg));
}

.image-workbench__summary {
  display: grid;
  gap: 6px;
  border: 1px solid var(--ui-code-border);
  border-radius: 8px;
  background: var(--ui-code-bg);
  padding: 10px;
}

.image-workbench__summary-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  font-size: 12px;
}

.image-workbench__summary-row .mono {
  min-width: 0;
  overflow-wrap: anywhere;
}

.image-workbench__history-grid {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  align-content: start;
  gap: 12px;
  overflow: auto;
  padding-right: 2px;
}

.image-workbench__history-card {
  min-width: 0;
  display: grid;
  grid-template-rows: 150px auto;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--ui-code-border) 86%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-code-bg) 92%, transparent);
  cursor: pointer;
  transition:
    transform 140ms ease,
    border-color 140ms ease,
    background-color 140ms ease;
}

.image-workbench__history-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 44%, var(--ui-code-border));
  background: color-mix(in srgb, var(--accent) 5%, var(--ui-code-bg));
}

.image-workbench__history-card:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 70%, transparent);
  outline-offset: 2px;
}

.image-workbench__history-preview {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: 1px;
  background: color-mix(in srgb, var(--border) 76%, transparent);
}

.image-workbench__history-preview img,
.image-workbench__history-tile {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  object-fit: cover;
  background: color-mix(in srgb, var(--bg) 78%, #000 22%);
}

.image-workbench__history-tile {
  display: grid;
  place-items: center;
  color: var(--text-muted);
}

.image-workbench__history-tile svg {
  width: 20px;
  height: 20px;
}

.image-workbench__history-body {
  min-width: 0;
  display: grid;
  gap: 7px;
  padding: 10px;
}

.image-workbench__history-title {
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
}

.image-workbench__history-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: 11px;
}

.image-workbench__history-meta span {
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-radius: 999px;
  padding: 2px 6px;
  background: color-mix(in srgb, var(--bg) 52%, transparent);
}

.image-workbench__history-model {
  min-width: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-workbench__result-grid {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  align-content: start;
  gap: 12px;
  overflow: auto;
  padding-right: 2px;
}

.image-workbench__result {
  min-width: 0;
  display: grid;
  grid-template-rows: auto minmax(180px, 1fr) auto;
  overflow: hidden;
  border: 1px solid var(--ui-code-border);
  border-radius: 8px;
  background: var(--ui-code-bg);
}

.image-workbench__result-tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 7px;
  border-bottom: 1px solid color-mix(in srgb, var(--ui-code-border) 76%, transparent);
  background: color-mix(in srgb, var(--surface-1) 86%, transparent);
}

.image-workbench__zoom {
  min-width: 42px;
  color: var(--text-muted);
  font-size: 11px;
  text-align: right;
}

.image-workbench__tool {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg) 72%, transparent);
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    color 120ms ease;
}

.image-workbench__tool:hover {
  border-color: color-mix(in srgb, var(--accent) 52%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, var(--bg));
  color: var(--text);
}

.image-workbench__tool:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 70%, transparent);
  outline-offset: 2px;
}

.image-workbench__tool svg {
  width: 14px;
  height: 14px;
}

.image-workbench__result-viewport {
  min-width: 0;
  min-height: 180px;
  display: grid;
  place-items: center;
  overflow: auto;
  background:
    linear-gradient(45deg, color-mix(in srgb, var(--bg) 86%, #000 14%) 25%, transparent 25%),
    linear-gradient(-45deg, color-mix(in srgb, var(--bg) 86%, #000 14%) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, color-mix(in srgb, var(--bg) 86%, #000 14%) 75%),
    linear-gradient(-45deg, transparent 75%, color-mix(in srgb, var(--bg) 86%, #000 14%) 75%),
    color-mix(in srgb, var(--bg) 72%, #000 28%);
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
  background-size: 16px 16px;
}

.image-workbench__result-viewport img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transform-origin: center center;
  transition: transform 120ms ease;
  user-select: none;
}

.image-workbench__image-state {
  width: 22px;
  height: 22px;
  color: var(--accent);
}

.image-workbench__image-missing {
  color: var(--text-muted);
  font-size: 12px;
}

.image-workbench__result-meta {
  display: grid;
  gap: 3px;
  padding: 8px;
  color: var(--text-muted);
  font-size: 11px;
}

.image-workbench__path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-spinning {
  animation: image-workbench-spin 1s linear infinite;
}

@keyframes image-workbench-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
