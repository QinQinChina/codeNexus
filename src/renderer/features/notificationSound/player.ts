import { codexDesktop } from "../../api/codexDesktopClient";
import {
  readConfiguredNotificationSoundId,
  readConfiguredNotificationSoundVolumePercent,
} from "../../stores/notificationSound.store";

const PLAY_COOLDOWN_MS = 700;

let sharedAudio: HTMLAudioElement | null = null;
let lastPlayAtMs = 0;
const dataUrlCache = new Map<string, string>();

function getAudio(): HTMLAudioElement {
  if (sharedAudio) return sharedAudio;
  sharedAudio = new Audio();
  sharedAudio.preload = "auto";
  return sharedAudio;
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
