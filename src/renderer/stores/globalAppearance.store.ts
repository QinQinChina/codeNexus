import { defineStore } from "pinia";
import { codexDesktop } from "../api/codexDesktopClient";
import { resolveLocalStateFilePath } from "../domain/localStateFiles";
import { getCachedUserLocalSettings, patchUserLocalSettings } from "../domain/localSettings";
import {
  DEFAULT_GLOBAL_BACKGROUND_FIT_MODE,
  DEFAULT_GLOBAL_SURFACE_OPACITY_PERCENT,
  MAX_GLOBAL_SURFACE_OPACITY_PERCENT,
  MIN_GLOBAL_SURFACE_OPACITY_PERCENT,
  type GlobalBackgroundFitMode,
  type LocalGlobalAppearanceState,
} from "../../shared/localSettings";

function normalizeRelativePath(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeSurfaceOpacityPercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_GLOBAL_SURFACE_OPACITY_PERCENT;
  const rounded = Math.round(n);
  if (rounded < MIN_GLOBAL_SURFACE_OPACITY_PERCENT) return MIN_GLOBAL_SURFACE_OPACITY_PERCENT;
  if (rounded > MAX_GLOBAL_SURFACE_OPACITY_PERCENT) return MAX_GLOBAL_SURFACE_OPACITY_PERCENT;
  return rounded;
}

function normalizeGlobalBackgroundFitMode(value: unknown): GlobalBackgroundFitMode {
  return value === "contain" || value === "tile" ? value : DEFAULT_GLOBAL_BACKGROUND_FIT_MODE;
}

export const GLOBAL_BACKGROUND_FIT_MODE_OPTIONS: Array<{ value: GlobalBackgroundFitMode; label: string }> = [
  { value: "cover", label: "铺满" },
  { value: "contain", label: "完整" },
  { value: "tile", label: "平铺" },
];

export function getGlobalBackgroundStyleTokens(mode: GlobalBackgroundFitMode): {
  size: string;
  position: string;
  repeat: string;
} {
  if (mode === "contain") {
    return { size: "contain", position: "center center", repeat: "no-repeat" };
  }
  if (mode === "tile") {
    return { size: "auto", position: "left top", repeat: "repeat" };
  }
  return { size: "cover", position: "center center", repeat: "no-repeat" };
}

function cloneGlobalAppearance(value?: Partial<LocalGlobalAppearanceState> | null): LocalGlobalAppearanceState {
  return {
    backgroundImageRelativePath: normalizeRelativePath(value?.backgroundImageRelativePath),
    surfaceOpacityPercent: normalizeSurfaceOpacityPercent(value?.surfaceOpacityPercent),
    backgroundFitMode: normalizeGlobalBackgroundFitMode(value?.backgroundFitMode),
  };
}

function toBackgroundCssValue(dataUrl: string): string {
  return `url(${JSON.stringify(String(dataUrl ?? ""))})`;
}

function applyGlobalAppearanceToDocument(args: {
  backgroundDataUrl: string;
  surfaceOpacityPercent: number;
  backgroundFitMode: GlobalBackgroundFitMode;
}) {
  const backgroundDataUrl = String(args.backgroundDataUrl ?? "").trim();
  const factor = normalizeSurfaceOpacityPercent(args.surfaceOpacityPercent) / 100;
  const tokens = getGlobalBackgroundStyleTokens(normalizeGlobalBackgroundFitMode(args.backgroundFitMode));
  try {
    document.documentElement.style.setProperty("--page-bg-opacity", "1");
    document.documentElement.style.setProperty("--page-shell-opacity-factor", String(factor));
    document.documentElement.style.setProperty(
      "--global-bg-image",
      backgroundDataUrl ? toBackgroundCssValue(backgroundDataUrl) : "none"
    );
    document.documentElement.style.setProperty("--global-bg-size", tokens.size);
    document.documentElement.style.setProperty("--global-bg-position", tokens.position);
    document.documentElement.style.setProperty("--global-bg-repeat", tokens.repeat);
  } catch {}
}

export const useGlobalAppearanceStore = defineStore("globalAppearance", {
  state: () => ({
    appearance: cloneGlobalAppearance() as LocalGlobalAppearanceState,
    currentBackgroundDataUrl: "" as string,
    backgroundMutationPending: false,
    backgroundLoadSeq: 0,
  }),
  actions: {
    initLocalSettings() {
      const cached = getCachedUserLocalSettings();
      this.appearance = cloneGlobalAppearance(cached.settings.workspaceAppearance);
      applyGlobalAppearanceToDocument({
        backgroundDataUrl: "",
        surfaceOpacityPercent: DEFAULT_GLOBAL_SURFACE_OPACITY_PERCENT,
        backgroundFitMode: DEFAULT_GLOBAL_BACKGROUND_FIT_MODE,
      });
    },
    async applyGlobalAppearance() {
      const appearance = cloneGlobalAppearance(this.appearance);
      const loadSeq = this.backgroundLoadSeq + 1;
      this.backgroundLoadSeq = loadSeq;

      let backgroundDataUrl = "";
      if (appearance.backgroundImageRelativePath) {
        const absolutePath = resolveLocalStateFilePath(appearance.backgroundImageRelativePath);
        if (absolutePath) {
          try {
            const result = await codexDesktop.app.readImageFileDataUrl({ path: absolutePath });
            backgroundDataUrl = String(result?.dataUrl ?? "");
          } catch (error) {
            console.warn("[globalAppearance] read background image failed", error);
          }
        }
      }

      if (loadSeq !== this.backgroundLoadSeq) return;
      this.currentBackgroundDataUrl = backgroundDataUrl;
      applyGlobalAppearanceToDocument({
        backgroundDataUrl,
        surfaceOpacityPercent: appearance.surfaceOpacityPercent,
        backgroundFitMode: appearance.backgroundFitMode,
      });
    },
    setSurfaceOpacityPercent(next: number) {
      const normalized = normalizeSurfaceOpacityPercent(next);
      this.appearance = {
        ...this.appearance,
        surfaceOpacityPercent: normalized,
      };
      applyGlobalAppearanceToDocument({
        backgroundDataUrl: this.currentBackgroundDataUrl,
        surfaceOpacityPercent: normalized,
        backgroundFitMode: this.appearance.backgroundFitMode,
      });
      void patchUserLocalSettings({
        workspaceAppearance: {
          surfaceOpacityPercent: normalized,
        },
      });
    },
    setBackgroundFitMode(next: GlobalBackgroundFitMode) {
      const normalized = normalizeGlobalBackgroundFitMode(next);
      this.appearance = {
        ...this.appearance,
        backgroundFitMode: normalized,
      };
      applyGlobalAppearanceToDocument({
        backgroundDataUrl: this.currentBackgroundDataUrl,
        surfaceOpacityPercent: this.appearance.surfaceOpacityPercent,
        backgroundFitMode: normalized,
      });
      void patchUserLocalSettings({
        workspaceAppearance: {
          backgroundFitMode: normalized,
        },
      });
    },
    async importBackgroundImage() {
      this.backgroundMutationPending = true;
      try {
        const result = await codexDesktop.app.importBackgroundImage();
        if (!result.ok) return result;
        this.appearance = {
          ...this.appearance,
          backgroundImageRelativePath: normalizeRelativePath(result.relativePath),
        };
        void patchUserLocalSettings({
          workspaceAppearance: {
            backgroundImageRelativePath: normalizeRelativePath(result.relativePath),
          },
        });
        this.currentBackgroundDataUrl = String(result.dataUrl ?? "");
        applyGlobalAppearanceToDocument({
          backgroundDataUrl: this.currentBackgroundDataUrl,
          surfaceOpacityPercent: this.appearance.surfaceOpacityPercent,
          backgroundFitMode: this.appearance.backgroundFitMode,
        });
        return result;
      } finally {
        this.backgroundMutationPending = false;
      }
    },
    async clearBackgroundImage() {
      this.backgroundMutationPending = true;
      try {
        await codexDesktop.app.clearBackgroundImage();
        this.appearance = {
          ...this.appearance,
          backgroundImageRelativePath: null,
        };
        void patchUserLocalSettings({
          workspaceAppearance: {
            backgroundImageRelativePath: null,
          },
        });
        this.currentBackgroundDataUrl = "";
        applyGlobalAppearanceToDocument({
          backgroundDataUrl: "",
          surfaceOpacityPercent: this.appearance.surfaceOpacityPercent,
          backgroundFitMode: this.appearance.backgroundFitMode,
        });
      } finally {
        this.backgroundMutationPending = false;
      }
    },
  },
});
