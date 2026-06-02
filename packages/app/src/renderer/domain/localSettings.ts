import { codexDesktop } from "../api/codexDesktopClient";
import {
  DEFAULT_USER_LOCAL_SETTINGS,
  normalizeUserLocalSettings,
  type UserLocalSettings,
  type UserLocalSettingsPatch,
} from "@codenexus/shared/localSettings";

export type LoadedUserLocalSettings = {
  path: string;
  exists: boolean;
  settings: UserLocalSettings;
};

function createInitialLoadedUserLocalSettings(): LoadedUserLocalSettings {
  return {
    path: String(codexDesktop.localState.initialSettingsSnapshot?.path ?? "").trim(),
    exists: Boolean(codexDesktop.localState.initialSettingsSnapshot?.exists),
    settings: normalizeUserLocalSettings(
      codexDesktop.localState.initialSettingsSnapshot?.settings ?? DEFAULT_USER_LOCAL_SETTINGS
    ),
  };
}

let cached: LoadedUserLocalSettings = createInitialLoadedUserLocalSettings();

let pendingLoad: Promise<LoadedUserLocalSettings> | null = null;

export function getCachedUserLocalSettings(): LoadedUserLocalSettings {
  return {
    path: cached.path,
    exists: cached.exists,
    settings: normalizeUserLocalSettings(cached.settings),
  };
}

export async function loadUserLocalSettings(force = false): Promise<LoadedUserLocalSettings> {
  if (!force && (cached.exists || cached.path)) return getCachedUserLocalSettings();
  if (!pendingLoad) {
    pendingLoad = codexDesktop.localState
      .readSettings()
      .then((res) => {
        cached = {
          path: String(res?.path ?? "").trim(),
          exists: Boolean(res?.exists),
          settings: normalizeUserLocalSettings(res?.settings),
        };
        return getCachedUserLocalSettings();
      })
      .finally(() => {
        pendingLoad = null;
      });
  }
  return pendingLoad;
}

export async function patchUserLocalSettings(patch: UserLocalSettingsPatch): Promise<LoadedUserLocalSettings> {
  const res = await codexDesktop.localState.patchSettings({ patch });
  cached = {
    path: String(res?.path ?? cached.path).trim(),
    exists: true,
    settings: normalizeUserLocalSettings(res?.settings),
  };
  return getCachedUserLocalSettings();
}

export function getLocalSettingsMemoryCacheStats(): { items: number; bytes: number; updatedAt: number } {
  return {
    items: 1,
    bytes: JSON.stringify(cached).length,
    updatedAt: Date.now(),
  };
}

export function clearLocalSettingsMemoryCache(): void {
  cached = createInitialLoadedUserLocalSettings();
  pendingLoad = null;
}
