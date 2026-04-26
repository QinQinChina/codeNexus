import { ref, nextTick, watch, onBeforeUnmount } from "vue";
import type { ImagePreviewPayload } from "./chat.types";

export function useImageLightbox() {
  const imageLightboxOpen = ref(false);
  const imageLightboxSrc = ref("");
  const imageLightboxTitle = ref("");
  const imageLightboxCloseButtonRef = ref<HTMLButtonElement | null>(null);

  const closeImageLightbox = () => {
    imageLightboxOpen.value = false;
    imageLightboxSrc.value = "";
    imageLightboxTitle.value = "";
  };

  const onPreviewImage = (payload: ImagePreviewPayload) => {
    const src = String(payload?.src ?? "").trim();
    if (!src) return;
    imageLightboxSrc.value = src;
    imageLightboxTitle.value = String(payload?.title ?? "").trim();
    imageLightboxOpen.value = true;
    void nextTick(() => imageLightboxCloseButtonRef.value?.focus?.());
  };

  const onImageLightboxWindowKeydown = (event: KeyboardEvent) => {
    if (!imageLightboxOpen.value) return;
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeImageLightbox();
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
    closeImageLightbox,
    onPreviewImage,
  };
}
