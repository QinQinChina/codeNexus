import { computed, ref, nextTick, watch, onBeforeUnmount } from "vue";
import type { ImagePreviewPayload } from "../types/chat.types";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.18;

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

function extensionFromImageSrc(src: string): string {
  const text = String(src ?? "").trim();
  const dataMatch = text.match(/^data:image\/([a-z0-9.+-]+);/i);
  if (dataMatch?.[1]) {
    const ext = dataMatch[1].toLowerCase();
    if (ext === "jpeg") return "jpg";
    if (ext === "svg+xml") return "svg";
    return ext;
  }
  try {
    const path = new URL(text).pathname;
    const ext = path.match(/\.([a-z0-9]{2,5})$/i)?.[1];
    if (ext) return ext.toLowerCase();
  } catch {}
  return "png";
}

export function useImageLightbox() {
  const imageLightboxOpen = ref(false);
  const imageLightboxSrc = ref("");
  const imageLightboxTitle = ref("");
  const imageLightboxCloseButtonRef = ref<HTMLButtonElement | null>(null);
  const imageLightboxZoom = ref(1);
  const imageLightboxPanX = ref(0);
  const imageLightboxPanY = ref(0);
  const imageLightboxDragging = ref(false);
  const imageLightboxTransformStyle = computed(() => ({
    transform: `translate3d(${imageLightboxPanX.value}px, ${imageLightboxPanY.value}px, 0) scale(${imageLightboxZoom.value})`,
  }));

  let dragPointerId: number | null = null;
  let dragStartClientX = 0;
  let dragStartClientY = 0;
  let dragStartPanX = 0;
  let dragStartPanY = 0;

  const resetImageLightboxView = () => {
    imageLightboxZoom.value = 1;
    imageLightboxPanX.value = 0;
    imageLightboxPanY.value = 0;
    imageLightboxDragging.value = false;
    dragPointerId = null;
  };

  const closeImageLightbox = () => {
    imageLightboxOpen.value = false;
    imageLightboxSrc.value = "";
    imageLightboxTitle.value = "";
    resetImageLightboxView();
  };

  const onPreviewImage = (payload: ImagePreviewPayload) => {
    const src = String(payload?.src ?? "").trim();
    if (!src) return;
    imageLightboxSrc.value = src;
    imageLightboxTitle.value = String(payload?.title ?? "").trim();
    resetImageLightboxView();
    imageLightboxOpen.value = true;
    void nextTick(() => imageLightboxCloseButtonRef.value?.focus?.());
  };

  const zoomImageLightbox = (nextZoom: number, origin?: { clientX: number; clientY: number }) => {
    const previousZoom = imageLightboxZoom.value;
    const zoom = clampNumber(nextZoom, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(zoom - previousZoom) < 0.001) return;

    if (origin && typeof window !== "undefined") {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const pointerX = origin.clientX - cx;
      const pointerY = origin.clientY - cy;
      const ratio = zoom / previousZoom;
      imageLightboxPanX.value = pointerX - (pointerX - imageLightboxPanX.value) * ratio;
      imageLightboxPanY.value = pointerY - (pointerY - imageLightboxPanY.value) * ratio;
    }

    imageLightboxZoom.value = zoom;
  };

  const zoomImageLightboxIn = () => {
    zoomImageLightbox(imageLightboxZoom.value * ZOOM_STEP);
  };

  const zoomImageLightboxOut = () => {
    zoomImageLightbox(imageLightboxZoom.value / ZOOM_STEP);
  };

  const onImageLightboxWheel = (event: WheelEvent) => {
    if (!imageLightboxOpen.value) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    const factor = direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomImageLightbox(imageLightboxZoom.value * factor, { clientX: event.clientX, clientY: event.clientY });
  };

  const onImageLightboxPointerDown = (event: PointerEvent) => {
    if (!imageLightboxOpen.value || event.button !== 0) return;
    event.preventDefault();
    dragPointerId = event.pointerId;
    dragStartClientX = event.clientX;
    dragStartClientY = event.clientY;
    dragStartPanX = imageLightboxPanX.value;
    dragStartPanY = imageLightboxPanY.value;
    imageLightboxDragging.value = true;
    try {
      (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    } catch {}
  };

  const onImageLightboxPointerMove = (event: PointerEvent) => {
    if (!imageLightboxDragging.value || dragPointerId !== event.pointerId) return;
    event.preventDefault();
    imageLightboxPanX.value = dragStartPanX + (event.clientX - dragStartClientX);
    imageLightboxPanY.value = dragStartPanY + (event.clientY - dragStartClientY);
  };

  const finishImageLightboxDrag = (event?: PointerEvent) => {
    if (event && dragPointerId !== event.pointerId) return;
    if (event) {
      try {
        (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
      } catch {}
    }
    dragPointerId = null;
    imageLightboxDragging.value = false;
  };

  const downloadImageLightboxImage = () => {
    const src = String(imageLightboxSrc.value ?? "").trim();
    if (!src || typeof document === "undefined") return;
    const baseName = sanitizeDownloadName(imageLightboxTitle.value || "image");
    const ext = extensionFromImageSrc(src);
    const link = document.createElement("a");
    link.href = src;
    link.download = `${baseName}.${ext}`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const onImageLightboxWindowKeydown = (event: KeyboardEvent) => {
    if (!imageLightboxOpen.value) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeImageLightbox();
      return;
    }
    if (event.key === "0") {
      event.preventDefault();
      resetImageLightboxView();
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomImageLightboxIn();
      return;
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomImageLightboxOut();
    }
  };

  watch(imageLightboxOpen, (open) => {
    if (typeof window === "undefined") return;
    if (open) {
      window.addEventListener("keydown", onImageLightboxWindowKeydown, true);
      return;
    }
    window.removeEventListener("keydown", onImageLightboxWindowKeydown, true);
  });

  onBeforeUnmount(() => {
    if (typeof window === "undefined") return;
    window.removeEventListener("keydown", onImageLightboxWindowKeydown, true);
  });

  return {
    imageLightboxOpen,
    imageLightboxSrc,
    imageLightboxTitle,
    imageLightboxCloseButtonRef,
    imageLightboxZoom,
    imageLightboxDragging,
    imageLightboxTransformStyle,
    closeImageLightbox,
    resetImageLightboxView,
    zoomImageLightboxIn,
    zoomImageLightboxOut,
    onImageLightboxWheel,
    onImageLightboxPointerDown,
    onImageLightboxPointerMove,
    finishImageLightboxDrag,
    downloadImageLightboxImage,
    onPreviewImage,
  };
}
