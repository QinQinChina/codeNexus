import { defineStore } from "pinia";
import { codexDesktop } from "../api/codexDesktopClient";
import { getCachedUserLocalSettings } from "../domain/localSettings";
import { showToast } from "../ui/toast";
import type { ImageGenerationHistoryItem } from "../../shared/ipc/contracts";

export type ImageWorkbenchMode = "generate" | "edit";

type ResultImage = {
  path: string;
  dataUrl: string;
  mimeType: string;
  revisedPrompt: string | null;
};

type GenerateResult = {
  ok: true;
  model: string;
  prompt: string;
  revisedPrompt: string | null;
  images: ResultImage[];
};

type InputImage = {
  id: string;
  name: string;
  dataUrl: string;
};

function sanitizeCompression(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function initialSettings() {
  return getCachedUserLocalSettings().settings.imageGeneration;
}

const settings = initialSettings();

export const useImageWorkbenchStore = defineStore("imageWorkbench", {
  state: () => ({
    imageSettings: settings,
    prompt: "",
    mode: "generate" as ImageWorkbenchMode,
    count: Math.max(1, Math.min(4, settings.maxImages)),
    size: settings.defaultSize || "1024x1024",
    quality: settings.defaultQuality || "auto",
    outputFormat: settings.outputFormat || "png",
    background: settings.defaultBackground || "auto",
    moderation: settings.defaultModeration || "auto",
    outputCompression: settings.outputCompression ?? 100,
    inputImages: [] as InputImage[],
    maskDataUrl: null as string | null,
    busy: false,
    errorText: "",
    result: null as GenerateResult | null,
    historyItems: [] as ImageGenerationHistoryItem[],
    selectedHistoryId: "" as string,
    historyLoading: false,
    historyErrorText: "",
    dragActive: false,
  }),
  getters: {
    configured(state) {
      return Boolean(state.imageSettings.enabled && state.imageSettings.baseUrl && state.imageSettings.apiKey);
    },
    canGenerate(state): boolean {
      const configured = Boolean(state.imageSettings.enabled && state.imageSettings.baseUrl && state.imageSettings.apiKey);
      return Boolean(configured && state.prompt.trim() && (state.mode === "generate" || state.inputImages.length > 0));
    },
    selectedHistoryItem(state): ImageGenerationHistoryItem | null {
      const id = String(state.selectedHistoryId ?? "").trim();
      if (!id) return null;
      return state.historyItems.find((item) => item.id === id) ?? null;
    },
  },
  actions: {
    syncSettingsFromCache() {
      this.imageSettings = getCachedUserLocalSettings().settings.imageGeneration;
    },
    stopDrag() {
      this.dragActive = false;
    },
    clearMask() {
      this.maskDataUrl = null;
    },
    removeInputImage(id: string) {
      this.inputImages = this.inputImages.filter((item) => item.id !== id);
    },
    async appendFiles(files: FileList | File[]) {
      const picked = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, 4);
      const next: InputImage[] = [...this.inputImages];
      for (const file of picked) {
        if (next.length >= 4) break;
        next.push({
          id: makeId(),
          name: file.name || "image",
          dataUrl: await readFileAsDataUrl(file),
        });
      }
      this.inputImages = next;
    },
    async setMaskFromFile(file: File) {
      this.maskDataUrl = await readFileAsDataUrl(file);
    },
    async loadHistory() {
      if (this.historyLoading) return;
      this.historyLoading = true;
      this.historyErrorText = "";
      try {
        const res = await codexDesktop.app.listImageGenerationHistory();
        this.historyItems = Array.isArray(res.items) ? res.items : [];
        if (this.selectedHistoryId && !this.historyItems.some((item) => item.id === this.selectedHistoryId)) {
          this.selectedHistoryId = "";
        }
      } catch (error: any) {
        this.historyErrorText = String(error?.message ?? error ?? "unknown error");
        showToast({ kind: "error", title: "历史加载失败", message: this.historyErrorText });
      } finally {
        this.historyLoading = false;
      }
    },
    selectHistoryItem(id: string) {
      const normalized = String(id ?? "").trim();
      if (!normalized) return;
      this.selectedHistoryId = normalized;
    },
    backToHistory() {
      this.selectedHistoryId = "";
    },
    async deleteHistoryItem(id: string) {
      const normalized = String(id ?? "").trim();
      if (!normalized) return;
      try {
        const res = await codexDesktop.app.deleteImageGenerationHistory({ id: normalized });
        this.historyItems = Array.isArray(res.items) ? res.items : [];
        if (this.selectedHistoryId === normalized) this.selectedHistoryId = "";
        if (res.deleted) showToast({ kind: "success", title: "已删除图片记录", message: "图片历史已更新。" });
      } catch (error: any) {
        const message = String(error?.message ?? error ?? "unknown error");
        showToast({ kind: "error", title: "删除失败", message });
      }
    },
    async generate() {
      if (this.busy || !this.canGenerate) return;
      this.errorText = "";
      this.busy = true;
      try {
        const res = await codexDesktop.app.generateImage({
          mode: this.mode,
          prompt: this.prompt.trim(),
          inputImages:
            this.mode === "edit" ? this.inputImages.map((item) => ({ dataUrl: item.dataUrl, name: item.name })) : null,
          maskDataUrl: this.mode === "edit" ? this.maskDataUrl : null,
          n: this.count,
          size: this.size,
          quality: this.quality,
          outputFormat: this.outputFormat,
          background: this.background,
          moderation: this.moderation,
          outputCompression: sanitizeCompression(this.outputCompression),
        } as any);
        this.result = res as GenerateResult;
        await this.loadHistory();
        const historyId = String((res as any)?.historyId ?? "").trim();
        if (historyId) this.selectedHistoryId = historyId;
        showToast({ kind: "success", title: "生成完成", message: `返回 ${res.images.length} 张图片。` });
      } catch (error: any) {
        this.errorText = String(error?.message ?? error ?? "unknown error");
        showToast({ kind: "error", title: "生成失败", message: this.errorText });
      } finally {
        this.busy = false;
      }
    },
  },
});
