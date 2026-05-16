<template>
  <section class="image-workbench" aria-label="图片工作台">
    <div v-if="!workbench.configured" class="image-workbench__notice">
      <AlertTriangle class="image-workbench__notice-icon" aria-hidden="true" />
      <div class="image-workbench__notice-body">
        <div class="image-workbench__notice-title">图片生成尚未配置</div>
        <div class="image-workbench__notice-text">先填写服务地址、API Key 和默认模型，然后再发起请求。</div>
      </div>
    </div>

    <section
      class="image-workbench__stage app-scrollbar"
      :class="{ 'is-history': !selectedHistoryItem && workbench.historyItems.length > 0 }"
    >
      <div class="image-workbench__stage-head">
        <span>{{ selectedHistoryItem ? "详情" : "历史记录" }}</span>
        <span class="mono">{{ workbench.historyItems.length }} 次生成</span>
      </div>

      <div v-if="workbench.historyLoading && workbench.historyItems.length === 0" class="image-workbench__empty">
        <Loader2 class="image-workbench__empty-icon is-spinning" aria-hidden="true" />
        <div>正在加载图片历史。</div>
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

        <div class="image-workbench__result-grid">
          <article v-for="image in selectedHistoryItem.images" :key="image.path" class="image-workbench__result">
            <div class="image-workbench__result-tools">
              <span class="image-workbench__zoom mono">{{ Math.round(getImageZoom(image.path) * 100) }}%</span>
              <button class="image-workbench__tool" type="button" v-tooltip="'缩小'" @click="zoomImage(image.path, 1 / ZOOM_STEP)">
                <ZoomOut aria-hidden="true" />
              </button>
              <button class="image-workbench__tool" type="button" v-tooltip="'放大'" @click="zoomImage(image.path, ZOOM_STEP)">
                <ZoomIn aria-hidden="true" />
              </button>
              <button class="image-workbench__tool" type="button" v-tooltip="'重置视图'" @click="resetImageZoom(image.path)">
                <RotateCcw aria-hidden="true" />
              </button>
              <button class="image-workbench__tool" type="button" v-tooltip="'下载图片'" @click="downloadImage(image)">
                <Download aria-hidden="true" />
              </button>
            </div>
            <div
              class="image-workbench__result-viewport"
              :class="{ 'is-dragging': isImageDragging(image.path) }"
              @pointerdown="onImagePointerDown(image.path, $event)"
              @wheel="onImageWheel(image.path, $event)"
            >
              <Loader2 v-if="imageDataUrlLoading[image.path]" class="image-workbench__image-state is-spinning" aria-hidden="true" />
              <img
                v-else-if="imageDataUrlByPath[image.path]"
                :src="imageDataUrlByPath[image.path]"
                :alt="image.path"
                :style="{ transform: getImageTransform(image.path) }"
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
      </div>

      <div
        v-else-if="workbench.historyItems.length > 0"
        ref="historyScrollerRef"
        class="image-workbench__history-scroll app-scrollbar"
        :class="{ 'is-dragging': historyDragState !== null }"
        @pointerdown="onHistoryPointerDown"
        @wheel="onHistoryWheel"
      >
        <div class="image-workbench__history-grid">
        <article
          v-for="item in workbench.historyItems"
          :key="item.id"
          class="image-workbench__history-card"
          :class="{
            'is-pending': isPendingHistoryItem(item),
            'is-failed': isFailedHistoryItem(item),
          }"
          :role="isSelectableHistoryItem(item) ? 'button' : undefined"
          :tabindex="isSelectableHistoryItem(item) ? 0 : -1"
          :aria-busy="isPendingHistoryItem(item) ? 'true' : 'false'"
          @click="onHistoryCardClick(item)"
          @keydown.enter.prevent="onHistoryCardClick(item)"
          @keydown.space.prevent="onHistoryCardClick(item)"
        >
          <div class="image-workbench__history-preview" :class="{ 'is-single': item.images.length === 1 }" :style="historyPreviewStyle(item)">
            <template v-if="isPendingHistoryItem(item)">
              <div v-for="n in historySkeletonTileCount(item)" :key="`${item.id}:pending:${n}`" class="image-workbench__history-skeleton">
                <Loader2 class="image-workbench__history-skeleton-icon is-spinning" aria-hidden="true" />
              </div>
            </template>
            <template v-else-if="isFailedHistoryItem(item)">
              <div class="image-workbench__history-skeleton is-failed">
                <AlertTriangle class="image-workbench__history-skeleton-icon" aria-hidden="true" />
              </div>
            </template>
            <template v-else>
              <template v-for="(image, index) in item.images.slice(0, 4)" :key="image.path">
                <img
                  v-if="imageDataUrlByPath[image.path]"
                  :class="{ 'is-full': item.images.length === 1 && index === 0 }"
                  :src="imageDataUrlByPath[image.path]"
                  :alt="image.path"
                  @load="onHistoryImageLoad(image.path, $event)"
                />
                <div v-else class="image-workbench__history-tile">
                  <ImageIcon aria-hidden="true" />
                </div>
              </template>
            </template>
          </div>
          <div class="image-workbench__history-body">
            <template v-if="isPendingHistoryItem(item)">
              <div class="image-workbench__history-skeleton-line is-title"></div>
              <div class="image-workbench__history-skeleton-line is-meta"></div>
              <div class="image-workbench__history-skeleton-line is-model"></div>
            </template>
            <template v-else-if="isFailedHistoryItem(item)">
              <div class="image-workbench__history-title is-failed">生成失败</div>
              <div class="image-workbench__history-meta">
                <span class="mono">等待重试</span>
                <button
                  class="btn-mini btn-mini--danger image-workbench__history-delete"
                  type="button"
                  aria-label="删除失败记录"
                  v-tooltip="'删除失败记录'"
                  @click.stop="workbench.deleteHistoryItem(item.id)"
                  @keydown.stop
                >
                  <Trash2 class="btn-mini__icon" aria-hidden="true" />
                  <span>删除</span>
                </button>
              </div>
              <div class="image-workbench__history-model mono">{{ item.errorText || "图片生成失败" }}</div>
            </template>
            <template v-else>
              <div class="image-workbench__history-title">{{ item.prompt }}</div>
              <div class="image-workbench__history-meta">
                <span class="mono">{{ formatDateTime(item.createdAt) }}</span>
                <span class="mono">{{ item.model }}</span>
              </div>
            </template>
          </div>
        </article>
        </div>
      </div>

      <div v-else class="image-workbench__empty">
        <ImageIcon class="image-workbench__empty-icon" aria-hidden="true" />
        <div>{{ workbench.historyLoading ? "正在加载图片历史。" : "生成图片后，这里会保存每一次记录。" }}</div>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, ref, watch, type CSSProperties } from "vue";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-vue-next";
import { codexDesktop } from "../../api/codexDesktopClient";
import { useAppShellStore } from "../../stores/appShell.store";
import { useImageWorkbenchStore } from "../../stores/imageWorkbench.store";

const appShellStore = useAppShellStore();
const workbench = useImageWorkbenchStore();
const imageZoomByPath = ref<Record<string, number>>({});
const imageDataUrlByPath = ref<Record<string, string>>({});
const imageDataUrlLoading = ref<Record<string, boolean>>({});
const imageNaturalSizeByPath = ref<Record<string, { width: number; height: number }>>({});

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;
const ZOOM_STEP = 1.18;

type WorkbenchImage = NonNullable<typeof workbench.selectedHistoryItem>["images"][number];
type WorkbenchHistoryItem = (typeof workbench.historyItems)[number];
type ImagePanState = { panX: number; panY: number };
type ImageDragState = {
  path: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
};
type HistoryDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  moved: boolean;
};

const imagePanByPath = ref<Record<string, ImagePanState>>({});
const imageDragState = ref<ImageDragState | null>(null);
const historyScrollerRef = ref<HTMLElement | null>(null);
const historyDragState = ref<HistoryDragState | null>(null);
const suppressHistoryClick = ref(false);

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

function getImagePan(path: string): ImagePanState {
  return imagePanByPath.value[path] ?? { panX: 0, panY: 0 };
}

function getImageTransform(path: string): string {
  const pan = getImagePan(path);
  return `translate3d(${pan.panX}px, ${pan.panY}px, 0) scale(${getImageZoom(path)})`;
}

function setImageZoom(path: string, zoom: number) {
  imageZoomByPath.value = {
    ...imageZoomByPath.value,
    [path]: clampNumber(zoom, MIN_ZOOM, MAX_ZOOM),
  };
}

function setImagePan(path: string, pan: ImagePanState) {
  imagePanByPath.value = {
    ...imagePanByPath.value,
    [path]: {
      panX: Math.round(pan.panX),
      panY: Math.round(pan.panY),
    },
  };
}

function zoomImage(path: string, factor: number) {
  setImageZoom(path, getImageZoom(path) * factor);
}

function resetImageZoom(path: string) {
  setImageZoom(path, 1);
  setImagePan(path, { panX: 0, panY: 0 });
}

function onImageWheel(path: string, event: WheelEvent) {
  event.preventDefault();
  zoomImage(path, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
}

function isImageDragging(path: string): boolean {
  return imageDragState.value?.path === path;
}

function teardownImageDragListeners() {
  window.removeEventListener("pointermove", onImagePointerMove);
  window.removeEventListener("pointerup", onImagePointerUp);
  window.removeEventListener("pointercancel", onImagePointerUp);
}

function teardownHistoryDragListeners() {
  window.removeEventListener("pointermove", onHistoryPointerMove);
  window.removeEventListener("pointerup", onHistoryPointerUp);
  window.removeEventListener("pointercancel", onHistoryPointerUp);
}

function onHistoryPointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("button, a, input, textarea, select")) return;
  const scroller = historyScrollerRef.value;
  if (!scroller) return;

  historyDragState.value = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startScrollLeft: scroller.scrollLeft,
    moved: false,
  };
  suppressHistoryClick.value = false;

  try {
    scroller.setPointerCapture?.(event.pointerId);
  } catch {}
  window.addEventListener("pointermove", onHistoryPointerMove);
  window.addEventListener("pointerup", onHistoryPointerUp);
  window.addEventListener("pointercancel", onHistoryPointerUp);
}

function onHistoryPointerMove(event: PointerEvent) {
  const state = historyDragState.value;
  const scroller = historyScrollerRef.value;
  if (!state || !scroller || event.pointerId !== state.pointerId) return;

  const deltaX = event.clientX - state.startClientX;
  const deltaY = event.clientY - state.startClientY;
  if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
    state.moved = true;
    suppressHistoryClick.value = true;
  }
  scroller.scrollLeft = state.startScrollLeft - deltaX;
  event.preventDefault();
}

function onHistoryPointerUp(event: PointerEvent) {
  const state = historyDragState.value;
  if (state && event.pointerId !== state.pointerId) return;
  historyDragState.value = null;
  teardownHistoryDragListeners();

  if (state?.moved) {
    window.setTimeout(() => {
      suppressHistoryClick.value = false;
    }, 0);
  } else {
    suppressHistoryClick.value = false;
  }
}

function onHistoryWheel(event: WheelEvent) {
  const scroller = historyScrollerRef.value;
  if (!scroller) return;
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (!delta) return;
  scroller.scrollLeft += delta;
  event.preventDefault();
}

function onImagePointerDown(path: string, event: PointerEvent) {
  if (event.button !== 0) return;
  if (!imageDataUrlByPath.value[path]) return;

  const pan = getImagePan(path);
  imageDragState.value = {
    path,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startPanX: pan.panX,
    startPanY: pan.panY,
  };

  try {
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  } catch {}
  window.addEventListener("pointermove", onImagePointerMove);
  window.addEventListener("pointerup", onImagePointerUp);
  window.addEventListener("pointercancel", onImagePointerUp);
  event.preventDefault();
}

function onImagePointerMove(event: PointerEvent) {
  const state = imageDragState.value;
  if (!state || event.pointerId !== state.pointerId) return;
  setImagePan(state.path, {
    panX: state.startPanX + event.clientX - state.startClientX,
    panY: state.startPanY + event.clientY - state.startClientY,
  });
}

function onImagePointerUp(event: PointerEvent) {
  const state = imageDragState.value;
  if (state && event.pointerId !== state.pointerId) return;
  imageDragState.value = null;
  teardownImageDragListeners();
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
  const modeText = item.mode === "edit" ? "参考图生成" : "文本生成";
  return [modeText, item.quality].filter(Boolean).join(" / ") || "auto";
}

function isPendingHistoryItem(item: WorkbenchHistoryItem): boolean {
  return item.workbenchStatus === "pending";
}

function isFailedHistoryItem(item: WorkbenchHistoryItem): boolean {
  return item.workbenchStatus === "failed";
}

function isSelectableHistoryItem(item: WorkbenchHistoryItem): boolean {
  return !isPendingHistoryItem(item) && !isFailedHistoryItem(item);
}

function historySkeletonTileCount(item: WorkbenchHistoryItem): number {
  const count = Number(item.pendingImageCount);
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.min(4, Math.round(count)));
}

function parseImageSizeRatio(value: unknown): string | null {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{2,5})\s*x\s*(\d{2,5})$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return `${Math.round(width)} / ${Math.round(height)}`;
}

function historyPreviewStyle(item: WorkbenchHistoryItem): CSSProperties {
  if (item.images.length !== 1) return {};
  const path = String(item.images[0]?.path ?? "").trim();
  const naturalSize = path ? imageNaturalSizeByPath.value[path] : null;
  const ratio = naturalSize
    ? `${naturalSize.width} / ${naturalSize.height}`
    : parseImageSizeRatio(item.size) ?? undefined;
  return ratio ? ({ "--image-workbench-history-preview-ratio": ratio } as CSSProperties) : {};
}

function onHistoryImageLoad(path: string, event: Event) {
  const img = event.target as HTMLImageElement | null;
  const width = Math.round(Number(img?.naturalWidth ?? 0));
  const height = Math.round(Number(img?.naturalHeight ?? 0));
  const normalized = String(path ?? "").trim();
  if (!normalized || width <= 0 || height <= 0) return;
  imageNaturalSizeByPath.value = {
    ...imageNaturalSizeByPath.value,
    [normalized]: { width, height },
  };
}

function onHistoryCardClick(item: WorkbenchHistoryItem) {
  if (suppressHistoryClick.value) return;
  if (isPendingHistoryItem(item) || isFailedHistoryItem(item)) return;
  workbench.selectHistoryItem(item.id);
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
    imagePanByPath.value = {};
    imageDragState.value = null;
    historyDragState.value = null;
    teardownImageDragListeners();
    teardownHistoryDragListeners();
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
  imageDragState.value = null;
  historyDragState.value = null;
  teardownImageDragListeners();
  teardownHistoryDragListeners();
});
</script>

<style scoped>
.image-workbench {
  display: grid;
  grid-template-areas:
    "notice"
    "stage";
  grid-template-rows: min-content minmax(0, 1fr);
  gap: 0;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 0 14px 18px;
}

.image-workbench__notice {
  grid-area: notice;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  margin-bottom: 14px;
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
  grid-area: stage;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  align-content: stretch;
  gap: 10px;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 2px;
  padding-bottom: 16px;
  scrollbar-gutter: stable;
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
  grid-template-rows: auto auto auto;
  gap: 12px;
  overflow: visible;
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

.image-workbench__stage.is-history {
  overflow: hidden;
  padding-right: 0;
}

.image-workbench__history-scroll {
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0 2px 16px 0;
  cursor: grab;
  scrollbar-gutter: stable;
  touch-action: pan-x;
  user-select: none;
  overscroll-behavior-x: contain;
}

.image-workbench__history-scroll.is-dragging {
  cursor: grabbing;
}

.image-workbench__history-scroll.is-dragging .image-workbench__history-card {
  pointer-events: none;
}

.image-workbench__history-grid {
  min-width: max-content;
  height: 100%;
  column-width: 250px;
  column-gap: 12px;
  column-fill: auto;
  overflow: visible;
}

.image-workbench__history-card {
  min-width: 0;
  width: 100%;
  display: grid;
  grid-template-rows: minmax(180px, auto) minmax(72px, auto);
  break-inside: avoid;
  page-break-inside: avoid;
  margin: 0 0 12px;
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

.image-workbench__history-card.is-pending {
  cursor: progress;
}

.image-workbench__history-card.is-pending:hover {
  transform: none;
  border-color: color-mix(in srgb, var(--accent) 32%, var(--ui-code-border));
  background: color-mix(in srgb, var(--ui-code-bg) 92%, transparent);
}

.image-workbench__history-card.is-failed {
  border-color: color-mix(in srgb, var(--danger, #ef4444) 42%, var(--ui-code-border));
  cursor: default;
}

.image-workbench__history-card.is-failed:hover {
  transform: none;
}

.image-workbench__history-card:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 70%, transparent);
  outline-offset: 2px;
}

.image-workbench__history-preview {
  min-width: 0;
  min-height: 180px;
  max-height: 260px;
  aspect-ratio: var(--image-workbench-history-preview-ratio, 1 / 1);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: 1px;
  overflow: hidden;
  background: color-mix(in srgb, var(--border) 76%, transparent);
}

.image-workbench__history-preview.is-single {
  min-height: 220px;
  max-height: 300px;
  grid-template-columns: minmax(0, 1fr);
}

.image-workbench__history-preview img,
.image-workbench__history-tile {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  object-fit: contain;
  background: color-mix(in srgb, var(--bg) 78%, #000 22%);
}

.image-workbench__history-preview img.is-full {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
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

.image-workbench__history-skeleton {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: color-mix(in srgb, var(--surface-1) 84%, var(--bg));
}

.image-workbench__history-skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(
    105deg,
    transparent 0%,
    transparent 34%,
    color-mix(in srgb, var(--accent) 16%, transparent) 48%,
    color-mix(in srgb, var(--text) 8%, transparent) 54%,
    transparent 68%,
    transparent 100%
  );
  transform: translate3d(-100%, 0, 0);
  animation: image-workbench-shimmer 1.15s linear infinite;
  will-change: transform;
}

.image-workbench__history-skeleton > * {
  position: relative;
  z-index: 1;
}

.image-workbench__history-skeleton:only-child {
  grid-column: 1 / -1;
}

.image-workbench__history-skeleton.is-failed {
  grid-column: 1 / -1;
  background: color-mix(in srgb, var(--danger, #ef4444) 10%, var(--surface-1));
  color: var(--danger, #ef4444);
}

.image-workbench__history-skeleton.is-failed::after {
  content: none;
}

.image-workbench__history-skeleton-icon {
  width: 22px;
  height: 22px;
  color: color-mix(in srgb, var(--accent) 74%, var(--text-muted));
}

.image-workbench__history-body {
  min-width: 0;
  min-height: 72px;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 6px;
  padding: 9px 10px;
  border-top: 1px solid color-mix(in srgb, var(--ui-code-border) 70%, transparent);
  background: color-mix(in srgb, var(--ui-code-bg) 96%, var(--bg));
}

.image-workbench__history-title {
  min-width: 0;
  min-height: 0;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.32;
  overflow-wrap: anywhere;
}

.image-workbench__history-title.is-failed {
  color: var(--danger, #ef4444);
}

.image-workbench__history-skeleton-line {
  position: relative;
  overflow: hidden;
  height: 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-1) 84%, var(--bg));
}

.image-workbench__history-skeleton-line::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 0%,
    transparent 34%,
    color-mix(in srgb, var(--accent) 16%, transparent) 48%,
    color-mix(in srgb, var(--text) 8%, transparent) 54%,
    transparent 68%,
    transparent 100%
  );
  transform: translate3d(-100%, 0, 0);
  animation: image-workbench-shimmer 1.15s linear infinite;
  will-change: transform;
}

.image-workbench__history-skeleton-line.is-title {
  width: min(100%, 220px);
  height: 14px;
}

.image-workbench__history-skeleton-line.is-meta {
  width: 58%;
}

.image-workbench__history-skeleton-line.is-model {
  width: 42%;
}

.image-workbench__history-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: 11px;
}

.image-workbench__history-meta span,
.image-workbench__history-delete {
  flex: 0 0 auto;
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
  font-size: 10px;
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
  overflow: visible;
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
  overflow: hidden;
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
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.image-workbench__result-viewport.is-dragging {
  cursor: grabbing;
}

.image-workbench__result-viewport img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform-origin: center center;
  transition: transform 120ms ease;
  user-select: none;
  will-change: transform;
  pointer-events: none;
}

.image-workbench__result-viewport.is-dragging img {
  transition: none;
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

@keyframes image-workbench-shimmer {
  0% {
    transform: translate3d(-100%, 0, 0);
  }
  100% {
    transform: translate3d(100%, 0, 0);
  }
}
</style>
