import { codexDesktop } from "../../api/codexDesktopClient";
import {
  readConfiguredNotificationSoundId,
  readConfiguredNotificationSoundVolumePercent,
} from "../../stores/notificationSound.store";

const PLAY_COOLDOWN_MS = 700;
const PLAN_QNA_SOUND_ID = "木琴铃声-手机来电通知音效_爱给网_aigei_com.mp3";
const PLAN_QNA_CLIP_MS = 600;
const PLAN_QNA_REPEAT_COUNT = 2;
const PLAN_QNA_COOLDOWN_MS = 2000;

let sharedAudio: HTMLAudioElement | null = null;
let planQnaAudio: HTMLAudioElement | null = null;
let lastPlayAtMs = 0;
let lastPlanQnaPlayAtMs = 0;
const dataUrlCache = new Map<string, string>();

function getAudio(): HTMLAudioElement {
  if (sharedAudio) return sharedAudio;
  sharedAudio = new Audio();
  sharedAudio.preload = "auto";
  return sharedAudio;
}

function getPlanQnaAudio(): HTMLAudioElement {
  if (planQnaAudio) return planQnaAudio;
  planQnaAudio = new Audio();
  planQnaAudio.preload = "auto";
  return planQnaAudio;
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Math.round(ms))));
}

async function resolveSoundDataUrl(soundId: string): Promise<string> {
  const id = String(soundId ?? "").trim();
  if (!id) throw new Error("notificationSound requires id");
  const cached = dataUrlCache.get(id);
  if (cached) return cached;
  const res = await codexDesktop.app.readNotificationSoundDataUrl({ id });
  const url = String(res?.dataUrl ?? "").trim();
  if (!url) throw new Error("notificationSound empty dataUrl");
  dataUrlCache.set(id, url);
  return url;
}

export async function playNotificationSoundOnce(args: {
  soundId: string;
  force?: boolean;
  volumePercent?: number;
}): Promise<void> {
  const id = String(args?.soundId ?? "").trim();
  if (!id) return;

  const force = Boolean(args?.force);
  const now = Date.now();
  if (!force && now - lastPlayAtMs < PLAY_COOLDOWN_MS) return;
  lastPlayAtMs = now;

  try {
    const audio = getAudio();
    const override = Number(args?.volumePercent);
    const volumePercent = Number.isFinite(override)
      ? Math.max(0, Math.min(100, Math.round(override)))
      : readConfiguredNotificationSoundVolumePercent();
    audio.volume = Math.max(0, Math.min(1, volumePercent / 100));
    const dataUrl = await resolveSoundDataUrl(id);
    if (audio.src !== dataUrl) audio.src = dataUrl;
    try {
      audio.currentTime = 0;
    } catch {}
    await audio.play();
  } catch (e) {
    console.warn("[notificationSound] play failed", e);
  }
}

export async function playConfiguredNotificationSoundOnce(opts?: { force?: boolean }): Promise<void> {
  const id = readConfiguredNotificationSoundId();
  if (!id) return;
  await playNotificationSoundOnce({ soundId: id, force: opts?.force });
}

export async function playPlanQnaNotificationSoundTwice(): Promise<void> {
  const now = Date.now();
  if (now - lastPlanQnaPlayAtMs < PLAN_QNA_COOLDOWN_MS) return;
  lastPlanQnaPlayAtMs = now;

  try {
    const audio = getPlanQnaAudio();
    audio.volume = Math.max(0, Math.min(1, readConfiguredNotificationSoundVolumePercent() / 100));
    const dataUrl = await resolveSoundDataUrl(PLAN_QNA_SOUND_ID);
    if (audio.src !== dataUrl) audio.src = dataUrl;

    for (let i = 0; i < PLAN_QNA_REPEAT_COUNT; i += 1) {
      try {
        audio.currentTime = 0;
      } catch {}
      await audio.play();
      await waitMs(PLAN_QNA_CLIP_MS);
      audio.pause();
    }

    try {
      audio.currentTime = 0;
    } catch {}
  } catch (e) {
    console.warn("[notificationSound] plan qna play failed", e);
  }
}

export function getNotificationSoundCacheStats(): { items: number; bytes: number; updatedAt: number } {
  let bytes = 0;
  for (const [key, value] of dataUrlCache.entries()) {
    bytes += key.length;
    bytes += value.length;
  }
  return {
    items: dataUrlCache.size,
    bytes: Math.max(0, Math.round(bytes)),
    updatedAt: Date.now(),
  };
}

export function clearNotificationSoundCache(): void {
  dataUrlCache.clear();
}
