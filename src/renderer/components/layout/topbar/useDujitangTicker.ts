import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { translate } from "../../../i18n/translate";

type DujitangTickerStatus = "loading" | "ready" | "error";
type DujitangTickerPhase = "idle" | "startPause" | "scrolling" | "endPause";

const DUJITANG_API_URL = "https://v2.xxapi.cn/api/dujitang";
const DUJITANG_REFRESH_INTERVAL_MS = 60 * 1000;
const DUJITANG_FETCH_TIMEOUT_MS = 10_000;
const DUJITANG_TEXT_MAX_CHARS = 120;
const DUJITANG_SCROLL_START_PAUSE_MS = 3_000;
const DUJITANG_SCROLL_END_PAUSE_MS = 3_000;
const DUJITANG_SCROLL_SPEED_PX_PER_SECOND = 36;
const dujitangLoadingText = () => translate("topbarExtra.dujitangLoading");
const dujitangErrorText = () => translate("topbarExtra.dujitangError");

export function useDujitangTicker() {
  const tickerViewportRef = ref<HTMLElement | null>(null);
  const tickerTrackRef = ref<HTMLElement | null>(null);
  const tickerStatus = ref<DujitangTickerStatus>("loading");
  const tickerPhase = ref<DujitangTickerPhase>("idle");
  const tickerFullText = ref(dujitangLoadingText());
  const tickerOverflow = ref(false);
  const tickerOffsetPx = ref(0);
  const tickerTransitionMs = ref(0);

  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let playbackStartTimer: ReturnType<typeof setTimeout> | null = null;
  let playbackReplayTimer: ReturnType<typeof setTimeout> | null = null;
  let measureRafId: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let fetchInFlight = false;
  let cycleToken = 0;
  let restartAfterCycle = false;

  function normalizeTickerText(value: string): string {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function truncateTickerText(value: string, maxChars: number): string {
    const text = normalizeTickerText(value);
    if (!Number.isFinite(maxChars) || maxChars <= 0) return "";
    if (text.length <= maxChars) return text;
    if (maxChars === 1) return "...";
    return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
  }

  const tickerText = computed(() => truncateTickerText(tickerFullText.value, DUJITANG_TEXT_MAX_CHARS));
  const tickerClass = computed(() => ({
    "is-loading": tickerStatus.value === "loading",
    "is-error": tickerStatus.value === "error",
    "is-overflow": tickerOverflow.value,
  }));
  const tickerTrackStyle = computed(() => ({
    transform: `translateX(${tickerOffsetPx.value}px)`,
    transition: tickerTransitionMs.value > 0 ? `transform ${tickerTransitionMs.value}ms linear` : "none",
  }));

  const clearRefreshTimer = () => {
    if (refreshTimer == null) return;
    clearInterval(refreshTimer);
    refreshTimer = null;
  };

  const clearPlaybackTimers = () => {
    if (playbackStartTimer != null) clearTimeout(playbackStartTimer);
    if (playbackReplayTimer != null) clearTimeout(playbackReplayTimer);
    playbackStartTimer = null;
    playbackReplayTimer = null;
  };

  const cancelMeasureRaf = () => {
    if (measureRafId == null) return;
    cancelAnimationFrame(measureRafId);
    measureRafId = null;
  };

  const resetTickerTrack = () => {
    tickerTransitionMs.value = 0;
    tickerOffsetPx.value = 0;
  };

  const measureOverflowPx = (): number => {
    const viewport = tickerViewportRef.value;
    const track = tickerTrackRef.value;
    if (!viewport || !track) return 0;
    let contentWidth = viewport.clientWidth;
    try {
      const style = getComputedStyle(viewport);
      const paddingLeft = Number.parseFloat(style.paddingLeft || "0") || 0;
      const paddingRight = Number.parseFloat(style.paddingRight || "0") || 0;
      contentWidth = Math.max(0, Math.round(contentWidth - paddingLeft - paddingRight));
    } catch {}
    return Math.max(0, Math.ceil(track.scrollWidth - contentWidth));
  };

  const computeScrollDurationMs = (overflowPx: number) => {
    const safe = Math.max(0, overflowPx);
    return Math.max(320, Math.round((safe / DUJITANG_SCROLL_SPEED_PX_PER_SECOND) * 1_000));
  };

  const runTickerCycle = () => {
    cycleToken += 1;
    const token = cycleToken;
    clearPlaybackTimers();
    resetTickerTrack();

    const overflowPx = measureOverflowPx();
    if (overflowPx <= 1) {
      tickerOverflow.value = false;
      tickerPhase.value = "idle";
      restartAfterCycle = false;
      return;
    }

    tickerOverflow.value = true;
    tickerPhase.value = "startPause";

    playbackStartTimer = setTimeout(() => {
      if (cycleToken !== token) return;
      resetTickerTrack();
      const nextOverflowPx = measureOverflowPx();
      if (nextOverflowPx <= 1) {
        tickerOverflow.value = false;
        tickerPhase.value = "idle";
        restartAfterCycle = false;
        return;
      }
      const durationMs = computeScrollDurationMs(nextOverflowPx);
      requestAnimationFrame(() => {
        if (cycleToken !== token) return;
        tickerPhase.value = "scrolling";
        tickerTransitionMs.value = durationMs;
        tickerOffsetPx.value = -nextOverflowPx;
      });
    }, DUJITANG_SCROLL_START_PAUSE_MS);
  };

  const scheduleTickerMeasure = () => {
    cancelMeasureRaf();
    measureRafId = requestAnimationFrame(() => {
      measureRafId = null;
      if (tickerPhase.value === "scrolling") {
        restartAfterCycle = true;
        return;
      }
      runTickerCycle();
    });
  };

  const parseApiText = (payload: unknown): string | null => {
    const toText = (value: unknown): string | null => {
      if (typeof value !== "string") return null;
      const normalized = normalizeTickerText(value);
      return normalized || null;
    };

    if (typeof payload === "string") return toText(payload);
    if (!payload || typeof payload !== "object") return null;

    const root = payload as Record<string, unknown>;
    const rawCode = root.code;
    if (rawCode != null) {
      const code = Number(rawCode);
      if (!Number.isNaN(code) && code !== 200) return null;
    }

    const fromTopLevel =
      toText(root.data) ??
      toText(root.msg) ??
      toText(root.text) ??
      toText(root.content) ??
      toText(root.sentence) ??
      toText(root.hitokoto);
    if (fromTopLevel) return fromTopLevel;

    if (!root.data || typeof root.data !== "object") return null;
    const nested = root.data as Record<string, unknown>;
    return (
      toText(nested.text) ??
      toText(nested.content) ??
      toText(nested.msg) ??
      toText(nested.sentence) ??
      toText(nested.hitokoto)
    );
  };

  const parseResponseText = async (response: Response): Promise<string | null> => {
    let jsonParsed = false;
    try {
      const payload = await response.clone().json();
      jsonParsed = true;
      const parsed = parseApiText(payload);
      if (parsed) return parsed;
    } catch {}
    if (jsonParsed) return null;
    const rawText = await response.text();
    const normalized = normalizeTickerText(rawText);
    return normalized || null;
  };

  const fetchTickerText = async () => {
    if (fetchInFlight) return;
    fetchInFlight = true;

    if (tickerStatus.value !== "ready") {
      tickerStatus.value = "loading";
      tickerFullText.value = dujitangLoadingText();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DUJITANG_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(DUJITANG_API_URL, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`http ${response.status}`);

      const nextText = await parseResponseText(response);
      if (!nextText) throw new Error("invalid payload");

      tickerStatus.value = "ready";
      tickerFullText.value = nextText;
    } catch (error) {
      console.warn("[TopBarAnnouncement] fetch dujitang text failed", error);
      tickerStatus.value = "error";
      tickerFullText.value = dujitangErrorText();
    } finally {
      clearTimeout(timeoutId);
      fetchInFlight = false;
    }
  };

  const onWindowResize = () => {
    scheduleTickerMeasure();
  };

  const onTrackTransitionEnd = (event: TransitionEvent) => {
    if (event.propertyName !== "transform") return;
    const track = tickerTrackRef.value;
    if (!track || event.target !== track) return;
    if (tickerPhase.value !== "scrolling") return;

    tickerPhase.value = "endPause";
    const token = cycleToken;

    clearPlaybackTimers();
    playbackReplayTimer = setTimeout(() => {
      if (cycleToken !== token) return;
      resetTickerTrack();
      tickerPhase.value = "idle";
      if (restartAfterCycle) {
        restartAfterCycle = false;
        runTickerCycle();
        return;
      }
      runTickerCycle();
    }, DUJITANG_SCROLL_END_PAUSE_MS);
  };

  watch(
    () => tickerText.value,
    () => {
      void nextTick(() => {
        restartAfterCycle = false;
        runTickerCycle();
      });
    }
  );

  onMounted(() => {
    resizeObserver = new ResizeObserver(() => {
      scheduleTickerMeasure();
    });
    if (tickerViewportRef.value) resizeObserver.observe(tickerViewportRef.value);
    if (tickerTrackRef.value) resizeObserver.observe(tickerTrackRef.value);

    window.addEventListener("resize", onWindowResize);

    void fetchTickerText();
    refreshTimer = setInterval(() => {
      void fetchTickerText();
    }, DUJITANG_REFRESH_INTERVAL_MS);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("resize", onWindowResize);
    clearRefreshTimer();
    clearPlaybackTimers();
    cancelMeasureRaf();
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  });

  return {
    tickerClass,
    tickerFullText,
    tickerOverflow,
    tickerText,
    tickerTrackRef,
    tickerTrackStyle,
    tickerViewportRef,
    onTrackTransitionEnd,
  };
}
