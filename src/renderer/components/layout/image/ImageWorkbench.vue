<template>
  <section class="image-workbench" :aria-label="t('imageWorkbench.aria')">
    <section ref="stageRef" class="image-workbench__stage app-scrollbar">
      <div class="image-workbench__stage-head">
        <span>{{ selectedHistoryItem ? t("imageWorkbench.details") : t("imageWorkbench.history") }}</span>
      </div>

      <div v-if="workbench.historyLoading && workbench.historyItems.length === 0" class="image-workbench__empty">
        <Loader2 class="image-workbench__empty-icon is-spinning" aria-hidden="true" />
        <div>{{ t("imageWorkbench.loadingHistory") }}</div>
      </div>

      <div v-else-if="selectedHistoryItem" class="image-workbench__result-stack">
        <div class="image-workbench__detail-bar">
          <button class="btn-mini" type="button" @click="backToHistory">
            <ArrowLeft class="btn-mini__icon" aria-hidden="true" />
            <span>{{ t("imageWorkbench.historyBack") }}</span>
          </button>
          <button class="btn-mini btn-mini--danger" type="button" @click="deleteHistoryItem(selectedHistoryItem.id)">
            <Trash2 class="btn-mini__icon" aria-hidden="true" />
            <span>{{ t("imageWorkbench.delete") }}</span>
          </button>
        </div>

        <div class="image-workbench__result-grid">
          <article v-for="image in selectedHistoryItem.images" :key="image.path" class="image-workbench__result">
            <div class="image-workbench__result-tools">
              <span class="image-workbench__zoom mono">{{ Math.round(getImageZoom(image.path) * 100) }}%</span>
              <button class="image-workbench__tool" type="button" @click="zoomImage(image.path, 1 / ZOOM_STEP)">
                <ZoomOut aria-hidden="true" />
              </button>
              <button class="image-workbench__tool" type="button" @click="zoomImage(image.path, ZOOM_STEP)">
                <ZoomIn aria-hidden="true" />
              </button>
              <button class="image-workbench__tool" type="button" @click="resetImageZoom(image.path)">
                <RotateCcw aria-hidden="true" />
              </button>
              <button class="image-workbench__tool" type="button" @click="copyImageToClipboard(image)">
                <Copy aria-hidden="true" />
              </button>
              <button class="image-workbench__tool" type="button" @click="downloadImage(image)">
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
              <div v-else class="image-workbench__image-missing">{{ t("imageWorkbench.imageUnavailable") }}</div>
            </div>
          </article>
        </div>
      </div>

      <div v-else-if="workbench.historyItems.length > 0" class="image-workbench__history-groups">
        <section v-for="group in historyGroups" :key="group.key" class="image-workbench__history-group">
          <div class="image-workbench__history-group-title mono">{{ group.label }}</div>
          <div class="image-workbench__history-grid app-scrollbar">
            <article
              v-for="item in group.items"
              :key="item.id"
              class="image-workbench__history-card"
              :class="{
                'is-pending': isPendingHistoryItem(item),
                'is-failed': isFailedHistoryItem(item),
              }"
              :style="historyCardStyle(item)"
              :role="isSelectableHistoryItem(item) ? 'button' : undefined"
              :tabindex="isSelectableHistoryItem(item) ? 0 : -1"
              :aria-busy="isPendingHistoryItem(item) ? 'true' : 'false'"
              @click="onHistoryCardClick(item)"
              @keydown.enter.prevent="onHistoryCardClick(item)"
              @keydown.space.prevent="onHistoryCardClick(item)"
            >
              <div class="image-workbench__history-preview" :class="{ 'is-single': item.images.length === 1 }">
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
                  <button
                    v-if="item.taskId"
                    class="image-workbench__history-action"
                    type="button"
                    :aria-label="t('imageWorkbench.cancelTask')"
                    @click.stop="workbench.cancelTask(item.taskId)"
                    @keydown.stop
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </template>
                <template v-else-if="isFailedHistoryItem(item)">
                  <AlertTriangle class="image-workbench__history-state-icon is-failed" aria-hidden="true" />
                  <button
                    v-if="item.taskId"
                    class="image-workbench__history-action"
                    type="button"
                    :aria-label="t('imageWorkbench.retryTask')"
                    @click.stop="workbench.retryTask(item.taskId)"
                    @keydown.stop
                  >
                    <RotateCcw aria-hidden="true" />
                  </button>
                  <button
                    class="image-workbench__history-action is-danger"
                    type="button"
                    :aria-label="t('imageWorkbench.deleteFailedRecord')"
                    @click.stop="deleteHistoryItem(item.id)"
                    @keydown.stop
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </template>
                <template v-else>
                  <button
                    v-if="item.images[0]"
                    class="image-workbench__history-action"
                    type="button"
                    :aria-label="t('imageWorkbench.copyImage')"
                    @click.stop="copyImageToClipboard(item.images[0])"
                    @keydown.stop
                  >
                    <Copy aria-hidden="true" />
                  </button>
                  <button
                    v-if="item.images[0]"
                    class="image-workbench__history-action"
                    type="button"
                    :aria-label="t('imageWorkbench.downloadImage')"
                    @click.stop="downloadImage(item.images[0])"
                    @keydown.stop
                  >
                    <Download aria-hidden="true" />
                  </button>
                  <button
                    class="image-workbench__history-action is-danger"
                    type="button"
                    :aria-label="t('imageWorkbench.deleteHistory')"
                    @click.stop="deleteHistoryItem(item.id)"
                    @keydown.stop
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </template>
              </div>
            </article>
            </div>
        </section>
      </div>

      <div v-else class="image-workbench__empty">
        <ImageIcon class="image-workbench__empty-icon" aria-hidden="true" />
        <div>{{ workbench.historyLoading ? t("imageWorkbench.loadingHistory") : t("imageWorkbench.emptyHistory") }}</div>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onBeforeUnmount, ref, watch, type CSSProperties } from "vue";
import { useI18n } from "vue-i18n";
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-vue-next";
import { codexDesktop } from "../../../api/codexDesktopClient";
import { useAppShellStore } from "../../../stores/appShell.store";
import { useImageWorkbenchStore } from "../../../stores/imageWorkbench.store";
import { showToast } from "../../../ui/toast";

const { t, locale } = useI18n();
const appShellStore = useAppShellStore();
const workbench = useImageWorkbenchStore();
const stageRef = ref<HTMLElement | null>(null);
const imageZoomByPath = ref<Record<string, number>>({});
const imageDataUrlByPath = ref<Record<string, string>>({});
const imageDataUrlLoading = ref<Record<string, boolean>>({});
const imageNaturalSizeByPath = ref<Record<string, { width: number; height: number }>>({});

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;
const ZOOM_STEP = 1.18;
const HISTORY_SINGLE_PREVIEW_MAX_HEIGHT_PX = 300;
const HISTORY_SINGLE_CARD_MIN_WIDTH_PX = 160;
const HISTORY_SINGLE_CARD_MAX_WIDTH_PX = 460;

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

const imagePanByPath = ref<Record<string, ImagePanState>>({});
const imageDragState = ref<ImageDragState | null>(null);
const savedHistoryScroll = ref<{ top: number; gridLefts: number[] } | null>(null);

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

async function copyImageToClipboard(image: WorkbenchImage) {
  const path = String(image.path ?? "").trim();
  if (!path) return;
  try {
    await codexDesktop.app.writeClipboardImageFromPath({ path });
    showToast({
      kind: "success",
      title: t("imageWorkbench.copySuccessTitle"),
      message: t("imageWorkbench.copySuccessMessage"),
    });
  } catch (error: any) {
    showToast({
      kind: "error",
      title: t("imageWorkbench.copyFailedTitle"),
      message: String(error?.message ?? error ?? ""),
    });
  }
}

function getHistoryHourStart(value: number): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  date.setMinutes(0, 0, 0);
  return date.getTime();
}

function formatHistoryHourLabel(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("imageWorkbench.unknownTime");
  return date.toLocaleString(String(locale.value), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function parseImageSize(value: unknown): { width: number; height: number } | null {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{2,5})\s*x\s*(\d{2,5})$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width: Math.round(width), height: Math.round(height) };
}

function getSingleHistoryImageSize(item: WorkbenchHistoryItem): { width: number; height: number } | null {
  if (item.images.length !== 1) return null;
  const path = String(item.images[0]?.path ?? "").trim();
  const naturalSize = path ? imageNaturalSizeByPath.value[path] : null;
  return naturalSize ?? parseImageSize(item.size);
}

function historyCardStyle(item: WorkbenchHistoryItem): CSSProperties {
  const imageSize = getSingleHistoryImageSize(item);
  if (!imageSize) return {};
  const ratio = imageSize.width / imageSize.height;
  const cardWidth = clampNumber(
    ratio * HISTORY_SINGLE_PREVIEW_MAX_HEIGHT_PX,
    HISTORY_SINGLE_CARD_MIN_WIDTH_PX,
    HISTORY_SINGLE_CARD_MAX_WIDTH_PX
  );
  return {
    "--image-workbench-history-preview-ratio": `${imageSize.width} / ${imageSize.height}`,
    "--image-workbench-history-card-width": `${Math.round(cardWidth)}px`,
  } as CSSProperties;
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
  if (isPendingHistoryItem(item) || isFailedHistoryItem(item)) return;
  captureHistoryScroll();
  workbench.selectHistoryItem(item.id);
}

function captureHistoryScroll() {
  const stage = stageRef.value;
  if (!stage) return;
  const grids = Array.from(stage.querySelectorAll<HTMLElement>(".image-workbench__history-grid"));
  savedHistoryScroll.value = {
    top: stage.scrollTop,
    gridLefts: grids.map((grid) => grid.scrollLeft),
  };
}

async function restoreHistoryScroll() {
  const saved = savedHistoryScroll.value;
  const stage = stageRef.value;
  if (!saved || !stage) return;
  await nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  stage.scrollTop = saved.top;
  const grids = Array.from(stage.querySelectorAll<HTMLElement>(".image-workbench__history-grid"));
  grids.forEach((grid, index) => {
    grid.scrollLeft = saved.gridLefts[index] ?? 0;
  });
}

async function backToHistory() {
  workbench.backToHistory();
  await restoreHistoryScroll();
}

async function deleteHistoryItem(id: string) {
  await workbench.deleteHistoryItem(id);
  if (!selectedHistoryItem.value) await restoreHistoryScroll();
}

function pruneRecordByPaths<T>(record: Record<string, T>, allowedPaths: Set<string>): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [path, value] of Object.entries(record)) {
    if (allowedPaths.has(path)) next[path] = value;
  }
  return next;
}

async function ensureImageDataUrl(path: string) {
  const normalized = String(path ?? "").trim();
  if (!normalized || imageDataUrlByPath.value[normalized] || imageDataUrlLoading.value[normalized]) return;
  if (!currentImagePathSet.value.has(normalized)) return;
  imageDataUrlLoading.value = { ...imageDataUrlLoading.value, [normalized]: true };
  try {
    const res = await codexDesktop.app.readImageFileDataUrl({ path: normalized });
    if (!currentImagePathSet.value.has(normalized)) return;
    imageDataUrlByPath.value = { ...imageDataUrlByPath.value, [normalized]: res.dataUrl };
  } catch (error: any) {
    console.warn("[ImageWorkbench] read image failed", {
      path: normalized,
      message: String(error?.message ?? error ?? "unknown error"),
    });
    if (currentImagePathSet.value.has(normalized)) {
      imageDataUrlByPath.value = { ...imageDataUrlByPath.value, [normalized]: "" };
    }
  } finally {
    if (currentImagePathSet.value.has(normalized)) {
      imageDataUrlLoading.value = { ...imageDataUrlLoading.value, [normalized]: false };
    } else {
      const { [normalized]: _discarded, ...rest } = imageDataUrlLoading.value;
      imageDataUrlLoading.value = rest;
    }
  }
}

const selectedHistoryItem = computed(() => workbench.selectedHistoryItem);
const currentHistoryImagePathsText = computed(() =>
  workbench.historyItems.flatMap((item) => item.images.map((image) => image.path)).join("\n")
);
const currentImagePathSet = computed(() => new Set(currentHistoryImagePathsText.value.split("\n").filter(Boolean)));
const historyGroups = computed(() => {
  const groups = new Map<number, WorkbenchHistoryItem[]>();
  const sorted = [...workbench.historyItems].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  for (const item of sorted) {
    const hourStart = getHistoryHourStart(Number(item.createdAt));
    const items = groups.get(hourStart) ?? [];
    items.push(item);
    groups.set(hourStart, items);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([hourStart, items]) => ({
      key: String(hourStart),
      label: formatHistoryHourLabel(hourStart),
      items,
    }));
});

onBeforeMount(() => {
  workbench.syncSettingsFromCache();
  workbench.notifyMissingConfigurationOnce();
  console.info("[ImageWorkbench] mounted", {
    history: workbench.historyItems.length,
    tasks: workbench.generationTasks.length,
    view: appShellStore.mainView,
  });
  void workbench.loadHistory();
});

watch(
  () => appShellStore.settingsOpen,
  (open) => {
    if (open) return;
    workbench.syncSettingsFromCache();
    workbench.notifyMissingConfigurationOnce();
  }
);

watch(
  () => appShellStore.mainView,
  (view) => {
    if (view !== "image") return;
    workbench.syncSettingsFromCache();
    workbench.notifyMissingConfigurationOnce();
    void workbench.loadHistory();
  }
);

watch(
  () => selectedHistoryItem.value?.images.map((image) => image.path).join("\n") ?? "",
  () => {
    imageZoomByPath.value = {};
    imagePanByPath.value = {};
    imageDragState.value = null;
    teardownImageDragListeners();
  }
);

watch(
  currentHistoryImagePathsText,
  (pathsText) => {
    const allowedPaths = new Set(pathsText.split("\n").filter(Boolean));
    imageDataUrlByPath.value = pruneRecordByPaths(imageDataUrlByPath.value, allowedPaths);
    imageDataUrlLoading.value = pruneRecordByPaths(imageDataUrlLoading.value, allowedPaths);
    imageNaturalSizeByPath.value = pruneRecordByPaths(imageNaturalSizeByPath.value, allowedPaths);
    imageZoomByPath.value = pruneRecordByPaths(imageZoomByPath.value, allowedPaths);
    imagePanByPath.value = pruneRecordByPaths(imagePanByPath.value, allowedPaths);
  },
  { immediate: true }
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
  teardownImageDragListeners();
});
</script>

<style scoped>
.image-workbench {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  gap: 0;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 0 14px 18px;
  background: transparent;
}

.image-workbench__stage {
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
  grid-template-rows: auto auto;
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
  color: var(--fg-danger);
}

.btn-mini--danger:hover {
  border-color: color-mix(in srgb, var(--danger) 48%, var(--border));
  background: color-mix(in srgb, var(--danger) 10%, var(--bg));
}

.image-workbench__history-groups {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 16px;
}

.image-workbench__history-group {
  min-width: 0;
  display: grid;
  gap: 8px;
}

.image-workbench__history-group-title {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.image-workbench__history-grid {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 8px;
  overscroll-behavior-x: contain;
}

.image-workbench__history-card {
  position: relative;
  min-width: var(--image-workbench-history-card-width, 250px);
  width: var(--image-workbench-history-card-width, 250px);
  flex: 0 0 var(--image-workbench-history-card-width, 250px);
  display: block;
  margin: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--ui-code-border) 86%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-code-bg) 92%, transparent);
  box-shadow: none;
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
  box-shadow: none;
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
  border-color: color-mix(in srgb, var(--danger) 42%, var(--ui-code-border));
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
  background: color-mix(in srgb, var(--bg) 78%, var(--theme-seed-canvas-deep) 22%);
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
  background: color-mix(in srgb, var(--danger) 10%, var(--surface-1));
  color: var(--fg-danger);
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
  position: absolute;
  inset: 10px 10px auto auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  pointer-events: none;
}

.image-workbench__history-state-icon,
.image-workbench__history-action {
  width: 29px;
  height: 29px;
  border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--bg) 68%, transparent);
  color: var(--text-muted);
  pointer-events: auto;
  backdrop-filter: blur(14px);
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease,
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}

.image-workbench__history-state-icon {
  padding: 6px;
  color: var(--accent);
}

.image-workbench__history-state-icon.is-failed,
.image-workbench__history-action.is-danger {
  color: var(--fg-danger);
}

.image-workbench__history-action {
  display: inline-grid;
  place-items: center;
}

.image-workbench__history-action:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, currentColor 42%, var(--border));
  background: color-mix(in srgb, currentColor 10%, var(--bg));
}

.image-workbench__history-action svg {
  width: 14px;
  height: 14px;
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
  grid-template-rows: auto minmax(180px, 1fr);
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
    linear-gradient(45deg, color-mix(in srgb, var(--bg) 86%, var(--theme-seed-canvas-deep) 14%) 25%, transparent 25%),
    linear-gradient(-45deg, color-mix(in srgb, var(--bg) 86%, var(--theme-seed-canvas-deep) 14%) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, color-mix(in srgb, var(--bg) 86%, var(--theme-seed-canvas-deep) 14%) 75%),
    linear-gradient(-45deg, transparent 75%, color-mix(in srgb, var(--bg) 86%, var(--theme-seed-canvas-deep) 14%) 75%),
    color-mix(in srgb, var(--bg) 72%, var(--theme-seed-canvas-deep) 28%);
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

@media (max-width: 980px) {
  .image-workbench {
    padding: 0 12px 14px;
  }

  .image-workbench__stage-head {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .image-workbench__history-card,
  .image-workbench__history-action,
  .image-workbench__result-viewport img {
    transition: none;
  }
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
