import "./tailwind.css";
import "./styles/index.css";

import { createApp, nextTick } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { initRuntimeOrchestrator } from "./domain/runtimeOrchestrator";
import { loadUserLocalSettings } from "./domain/localSettings";
import { loadLocalDraftState } from "./domain/localDraftState";
import { loadLocalMessageOutbox } from "./domain/localMessageOutbox";
import { useThemeStore } from "./stores/theme.store";
import { useTypographyStore } from "./stores/typography.store";
import { useRuntimeStore } from "./stores/runtime.store";
import { useMessageQueueStore } from "./stores/messageQueue.store";

async function bootstrap() {
  const pinia = createPinia();
  try {
    await loadUserLocalSettings();
  } catch (error) {
    console.warn("[bootstrap] loadUserLocalSettings failed", error);
  }
  useThemeStore(pinia).initTheme();
  useTypographyStore(pinia).initTypography();

  const runtimeStore = useRuntimeStore(pinia);
  const messageQueueStore = useMessageQueueStore(pinia);

  const [draftState, messageOutbox] = await Promise.all([loadLocalDraftState(), loadLocalMessageOutbox()]);

  runtimeStore.hydrateFromLocalDraftState(draftState);
  messageQueueStore.hydrateFromLocalMessageOutbox(messageOutbox);

  const runtime = initRuntimeOrchestrator(pinia);
  const app = createApp(App);
  app.use(pinia);
  app.mount("#app");

  const windowControlsOverlay = (navigator as any).windowControlsOverlay as
    | {
        visible?: boolean;
        getTitlebarAreaRect?: () => DOMRect;
        addEventListener?: (type: string, cb: (evt?: any) => void) => void;
      }
    | undefined;

  if (windowControlsOverlay?.addEventListener) {
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRetry = () => {
      if (retryTimer != null) return;
      if (retryCount >= 8) return;
      retryCount += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        applyWindowControlsPadding();
      }, 180);
    };

    const applyWindowControlsPadding = (evt?: any) => {
      if (windowControlsOverlay.visible === false) {
        document.documentElement.style.setProperty("--window-controls-pad", "0px");
        return;
      }

      const rect: DOMRect | undefined = evt?.titlebarAreaRect ?? windowControlsOverlay.getTitlebarAreaRect?.();
      if (!rect) {
        document.documentElement.style.setProperty("--window-controls-pad", "200px");
        scheduleRetry();
        return;
      }

      retryCount = 0;
      const rightPadPx = Math.max(0, Math.round(window.innerWidth - (rect.x + rect.width)));
      document.documentElement.style.setProperty("--window-controls-pad", `${rightPadPx}px`);
      if (rect.height > 0) {
        document.documentElement.style.setProperty("--topbar-h", `${Math.round(rect.height)}px`);
      }
    };

    windowControlsOverlay.addEventListener("geometrychange", applyWindowControlsPadding);
    window.addEventListener("resize", applyWindowControlsPadding);
    applyWindowControlsPadding();
  }

  window.addEventListener(
    "unload",
    () => {
      runtime.dispose();
    },
    { once: true }
  );

  await nextTick();
}

void bootstrap();
