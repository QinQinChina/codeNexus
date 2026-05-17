<template>
  <button
    ref="rootRef"
    class="lazy-image-thumb group relative inline-flex max-w-full items-center justify-center overflow-hidden rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] object-contain shadow-none transition-[border-color,background,opacity] duration-150 hover:border-[var(--ui-well-border-hover)] disabled:cursor-not-allowed disabled:opacity-60"
    type="button"
    :disabled="disabled"
    @click="onPreviewClick"
  >
    <img
      v-if="resolvedSrc"
      class="lazy-image-thumb__img h-full w-full object-contain"
      :src="resolvedSrc"
      :alt="altText"
      loading="lazy"
      decoding="async"
      @load="onImgLoad"
      @error="onImgError"
    />
    <div
      v-else
      class="lazy-image-thumb__placeholder flex h-full w-full items-center justify-center px-2 text-center mono text-[11px] text-[var(--ui-code-text-muted)]"
    >
      <span v-if="loading">读取中...</span>
      <span v-else-if="errorText">加载失败</span>
      <span v-else>图片</span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { isAbsoluteFsPath, normalizeAbsoluteFsPath, resolveWorkspaceFsPath } from "../../domain/workspacePath";
import { readLocalImageDataUrl } from "../../features/media/localImageCache";

export type LazyImageSourceKind = "dataUrl" | "remoteUrl" | "localPath";

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error ?? "unknown error");
}

const props = defineProps<{
  imageId: string;
  source: string;
  sourceKind: LazyImageSourceKind;
  previewTitle?: string;
  workspaceRoot?: string;
  rootMarginPx?: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (event: "preview", payload: { src: string; title: string; source: string; sourceKind: LazyImageSourceKind }): void;
  (
    event: "load-error",
    payload: { imageId: string; source: string; sourceKind: LazyImageSourceKind; errorText: string }
  ): void;
}>();

const disabled = computed(() => Boolean(props.disabled));
const altText = computed(() => String(props.previewTitle ?? "").trim() || "image");

const rootRef = ref<HTMLElement | null>(null);
const localDataUrl = ref("");
const loading = ref(false);
const errorText = ref("");
const loadedOnce = ref(false);
let observer: IntersectionObserver | null = null;
let loadSeq = 0;
let emittedLoadError = false;

const resolvedLocalPath = computed(() => {
  const raw = String(props.source ?? "").trim();
  if (!raw) return "";

  const workspaceRoot = String(props.workspaceRoot ?? "").trim();
  if (workspaceRoot) return resolveWorkspaceFsPath(workspaceRoot, raw);

  if (isAbsoluteFsPath(raw)) return normalizeAbsoluteFsPath(raw);
  return raw;
});

const resolvedSrc = computed(() => {
  const raw = String(props.source ?? "").trim();
  if (!raw) return "";
  if (props.sourceKind === "localPath") return localDataUrl.value;
  return raw;
});

function disconnectObserver() {
  observer?.disconnect();
  observer = null;
}

function emitLoadErrorOnce(message: string) {
  if (emittedLoadError) return;
  emittedLoadError = true;
  emit("load-error", {
    imageId: String(props.imageId ?? "").trim(),
    source: String(props.source ?? "").trim(),
    sourceKind: props.sourceKind,
    errorText: String(message ?? "").trim() || "图片加载失败",
  });
}

async function ensureLocalLoaded(options?: { force?: boolean }) {
  if (props.sourceKind !== "localPath") return;
  const path = resolvedLocalPath.value;
  if (!path) return;
  if (!options?.force && localDataUrl.value) return;

  const nextSeq = loadSeq + 1;
  loadSeq = nextSeq;
  loading.value = true;
  errorText.value = "";
  try {
    const dataUrl = await readLocalImageDataUrl(path);
    if (loadSeq !== nextSeq) return;
    localDataUrl.value = dataUrl;
    loadedOnce.value = true;
  } catch (error) {
    if (loadSeq !== nextSeq) return;
    errorText.value = safeErrorMessage(error);
    emitLoadErrorOnce(errorText.value);
    localDataUrl.value = "";
  } finally {
    if (loadSeq === nextSeq) loading.value = false;
  }
}

function setupObserverIfNeeded() {
  disconnectObserver();
  if (props.sourceKind !== "localPath") return;
  if (!rootRef.value) return;
  if (typeof IntersectionObserver === "undefined") {
    void ensureLocalLoaded();
    return;
  }

  const margin = Math.max(0, Number(props.rootMarginPx ?? 260));
  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      void ensureLocalLoaded();
    },
    {
      root: null,
      rootMargin: `${margin}px 0px ${margin}px 0px`,
    }
  );
  observer.observe(rootRef.value);
}

function onImgLoad() {
  if (props.sourceKind !== "localPath") return;
  loadedOnce.value = true;
}

function onImgError() {
  // 远程 URL / dataUrl 可能会加载失败：记录错误并允许重试（重新设置 src 的话浏览器会重试）。
  if (props.sourceKind === "localPath") return;
  errorText.value = "图片加载失败";
  emitLoadErrorOnce(errorText.value);
}

async function onPreviewClick() {
  if (disabled.value) return;

  if (props.sourceKind === "localPath") {
    if (!localDataUrl.value) await ensureLocalLoaded({ force: loadedOnce.value });
  }

  const src = resolvedSrc.value;
  if (!src) return;
  emit("preview", {
    src,
    title: String(props.previewTitle ?? "").trim() || "图片预览",
    source: String(props.source ?? "").trim(),
    sourceKind: props.sourceKind,
  });
}

onMounted(() => {
  setupObserverIfNeeded();
});

watch(
  () => [props.sourceKind, props.source, props.workspaceRoot, props.rootMarginPx] as const,
  () => {
    // 输入变化时清空旧状态，避免不同图片之间串数据。
    localDataUrl.value = "";
    errorText.value = "";
    loading.value = false;
    loadedOnce.value = false;
    loadSeq += 1;
    emittedLoadError = false;
    setupObserverIfNeeded();
  }
);

onBeforeUnmount(() => {
  loadSeq += 1;
  disconnectObserver();
});
</script>

<style scoped>
.lazy-image-thumb__img {
  display: block;
}
</style>
