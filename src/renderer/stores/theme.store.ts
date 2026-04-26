import { defineStore } from "pinia";
import { getCachedUserLocalSettings, patchUserLocalSettings } from "../domain/localSettings";

export type AppThemeName = "light" | "dark";
export type AppThemeTone = "light" | "dark";
type ThemeTransitionOrigin = {
  x: number;
  y: number;
};

const DEFAULT_THEME: AppThemeName = "light";
const DEFAULT_BACKGROUND_OPACITY_PERCENT = 100;
const MIN_BACKGROUND_OPACITY_PERCENT = 10;
const MAX_BACKGROUND_OPACITY_PERCENT = 100;

function normalizeTheme(value: unknown): AppThemeName | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "light") return "light";
  if (raw === "dark") return "dark";
  if (raw === "windsurf" || raw === "aurora" || raw === "moss") return "dark";
  return null;
}

function themeTone(theme: AppThemeName): AppThemeTone {
  if (theme === "light") return "light";
  return "dark";
}

function normalizeBackgroundOpacityPercent(value: unknown): number {
  if (value == null) return DEFAULT_BACKGROUND_OPACITY_PERCENT;
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_BACKGROUND_OPACITY_PERCENT;
  const rounded = Math.round(n);
  if (rounded < MIN_BACKGROUND_OPACITY_PERCENT) return MIN_BACKGROUND_OPACITY_PERCENT;
  if (rounded > MAX_BACKGROUND_OPACITY_PERCENT) return MAX_BACKGROUND_OPACITY_PERCENT;
  return rounded;
}

function applyThemeToDocument(theme: AppThemeName): void {
  try {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.tone = themeTone(theme);
  } catch {}
}

function applyBackgroundOpacityToDocument(percent: number): void {
  try {
    void percent;
    document.documentElement.style.setProperty("--page-bg-opacity", "1");
  } catch {}
}

function supportsThemeViewTransition(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return false;
  return typeof document.startViewTransition === "function";
}

function clampTransitionCoordinate(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

function resolveTransitionMetrics(origin?: ThemeTransitionOrigin): {
  x: number;
  y: number;
  radius: number;
} {
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const fallbackX = viewportWidth / 2;
  const fallbackY = viewportHeight / 2;
  const x = clampTransitionCoordinate(origin?.x ?? fallbackX, viewportWidth);
  const y = clampTransitionCoordinate(origin?.y ?? fallbackY, viewportHeight);
  const radius = Math.ceil(Math.hypot(Math.max(x, viewportWidth - x), Math.max(y, viewportHeight - y)));
  return {
    x,
    y,
    radius: Math.max(radius, 0),
  };
}

function playThemeViewTransition(applyTheme: () => void, origin?: ThemeTransitionOrigin): void {
  if (!supportsThemeViewTransition()) {
    applyTheme();
    return;
  }

  const { x, y, radius } = resolveTransitionMetrics(origin);
  const style = document.documentElement.style;
  style.setProperty("--theme-transition-x", `${x}px`);
  style.setProperty("--theme-transition-y", `${y}px`);
  style.setProperty("--theme-transition-radius", `${radius}px`);

  const cleanup = () => {
    style.removeProperty("--theme-transition-x");
    style.removeProperty("--theme-transition-y");
    style.removeProperty("--theme-transition-radius");
  };

  try {
    const transition = document.startViewTransition(() => {
      applyTheme();
    });
    void transition.finished.then(cleanup, cleanup);
  } catch (error) {
    cleanup();
    applyTheme();
    console.warn("[theme] startViewTransition failed", error);
  }
}

export const useThemeStore = defineStore("theme", {
  state: () => ({
    theme: DEFAULT_THEME as AppThemeName,
    backgroundOpacityPercent: DEFAULT_BACKGROUND_OPACITY_PERCENT,
    ready: false,
  }),
  getters: {
    isLight(state): boolean {
      return themeTone(state.theme) === "light";
    },
  },
  actions: {
    initTheme() {
      const cached = getCachedUserLocalSettings();
      this.theme = normalizeTheme(cached.settings.ui.theme) ?? DEFAULT_THEME;
      this.backgroundOpacityPercent = normalizeBackgroundOpacityPercent(cached.settings.ui.backgroundOpacityPercent);
      this.ready = true;
      applyThemeToDocument(this.theme);
      applyBackgroundOpacityToDocument(this.backgroundOpacityPercent);
      if (!cached.exists) {
        void patchUserLocalSettings({
          ui: {
            theme: this.theme,
            backgroundOpacityPercent: this.backgroundOpacityPercent,
          },
        });
      }
    },
    setTheme(next: AppThemeName, opts?: { save?: boolean; transitionOrigin?: ThemeTransitionOrigin }) {
      const shouldSave = opts?.save ?? true;
      const normalized = normalizeTheme(next) ?? DEFAULT_THEME;
      playThemeViewTransition(() => {
        this.theme = normalized;
        applyThemeToDocument(this.theme);
      }, opts?.transitionOrigin);
      if (!shouldSave) return;
      void patchUserLocalSettings({ ui: { theme: this.theme } });
    },
    setBackgroundOpacityPercent(next: number, opts?: { save?: boolean }) {
      const shouldSave = opts?.save ?? true;
      const normalized = normalizeBackgroundOpacityPercent(next);
      this.backgroundOpacityPercent = normalized;
      applyBackgroundOpacityToDocument(this.backgroundOpacityPercent);
      if (!shouldSave) return;
      void patchUserLocalSettings({ ui: { backgroundOpacityPercent: this.backgroundOpacityPercent } });
    },
    cycleTheme(
      order: AppThemeName[] = ["light", "dark"],
      opts?: { transitionOrigin?: ThemeTransitionOrigin }
    ) {
      const fallback: AppThemeName[] = ["light", "dark"];
      const list = Array.isArray(order) && order.length > 0 ? order : fallback;
      const idx = list.indexOf(this.theme);
      const next = idx >= 0 ? list[(idx + 1) % list.length] : list[0];
      this.setTheme(next, { transitionOrigin: opts?.transitionOrigin });
    },
  },
});
