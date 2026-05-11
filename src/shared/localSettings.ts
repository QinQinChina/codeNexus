import { normalizeCustomModelIds } from "./modelCatalog";
import { normalizeBuiltinDynamicToolName, type BuiltinDynamicToolName } from "./dynamicTools";

export type LocalGlobalAppearanceState = {
  backgroundImageRelativePath: string | null;
  surfaceOpacityPercent: number;
  backgroundFitMode: GlobalBackgroundFitMode;
};

export type LocalRemoteSyncSettings = {
  enabled: boolean;
  serverBaseUrl: string | null;
  username: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  desktopId: string | null;
  heartbeatIntervalSec: number;
};

export type LocalImageGenerationSettings = {
  enabled: boolean;
  baseUrl: string | null;
  apiKey: string | null;
  model: string;
  defaultSize: string;
  defaultQuality: string;
  outputFormat: string;
  defaultBackground: string;
  defaultModeration: string;
  outputCompression: number;
  timeoutMs: number;
  maxImages: number;
};

export type LocalThreadWorkspaceGroupsCollapsedState = Record<string, boolean>;
export type LocalDynamicToolsSettings = {
  enabledByName: Record<BuiltinDynamicToolName, boolean>;
};

export type GlobalBackgroundFitMode = "cover" | "contain" | "tile";
export type MainView = "chat" | "image";
export type UiFontFamilyPreset = "alibaba-puhuiti" | "source-han-sans-sc";
export type UiFontSizePreset = "small" | "medium" | "large";
export type UiWorkspaceFileIconTheme = "lucide" | "vscode-icons";
export type AssistantFinalMessageFormat = "markdown" | "structured-json-v1";
export type AssistantPlanMessageFormat = "markdown" | "plan-card-v1";

export type UserLocalSettings = {
  version: 1;
  ui: {
    theme: string | null;
    backgroundOpacityPercent: number;
    mainView: MainView;
    leftSidebarVisible: boolean;
    leftSidebarWidthPx: number;
    filesSidebarVisible: boolean;
    filesSidebarWidthPx: number;
    centerEditorWidthPx: number;
    fontFamilyPreset: UiFontFamilyPreset;
    fontSizePreset: UiFontSizePreset;
    workspaceFileIconTheme: UiWorkspaceFileIconTheme;
    assistantFinalMessageFormat: AssistantFinalMessageFormat;
    assistantPlanMessageFormat: AssistantPlanMessageFormat;
    threadWorkspaceGroupsCollapsed: LocalThreadWorkspaceGroupsCollapsedState;
    globalConfigAdvancedOpen: boolean;
  };
  notification: {
    selectedSoundId: string | null;
    soundVolumePercent: number;
  };
  models: {
    customIds: string[];
  };
  workspaceAppearance: LocalGlobalAppearanceState;
  remoteSync: LocalRemoteSyncSettings;
  imageGeneration: LocalImageGenerationSettings;
  dynamicTools: LocalDynamicToolsSettings;
  developer: {
    debugLogEnabled: boolean;
  };
};

export type UserLocalSettingsPatch = {
  ui?: Partial<{
    theme: string | null;
    backgroundOpacityPercent: number | null;
    mainView: MainView;
    leftSidebarVisible: boolean;
    leftSidebarWidthPx: number | null;
    filesSidebarVisible: boolean;
    filesSidebarWidthPx: number | null;
    centerEditorWidthPx: number | null;
    fontFamilyPreset: UiFontFamilyPreset | null;
    fontSizePreset: UiFontSizePreset | null;
    workspaceFileIconTheme: UiWorkspaceFileIconTheme | null;
    assistantFinalMessageFormat: AssistantFinalMessageFormat | null;
    assistantPlanMessageFormat: AssistantPlanMessageFormat | null;
    threadWorkspaceGroupsCollapsed: Record<string, boolean> | null;
    globalConfigAdvancedOpen: boolean;
  }>;
  notification?: Partial<{
    selectedSoundId: string | null;
    soundVolumePercent: number | null;
  }>;
  models?: Partial<{
    customIds: string[] | null;
  }>;
  workspaceAppearance?: Partial<{
    backgroundImageRelativePath: string | null;
    surfaceOpacityPercent: number | null;
    backgroundFitMode: GlobalBackgroundFitMode | null;
  }>;
  remoteSync?: Partial<{
    enabled: boolean;
    serverBaseUrl: string | null;
    username: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    desktopId: string | null;
    heartbeatIntervalSec: number | null;
  }>;
  imageGeneration?: Partial<{
    enabled: boolean;
    baseUrl: string | null;
    apiKey: string | null;
    model: string | null;
    defaultSize: string | null;
    defaultQuality: string | null;
    outputFormat: string | null;
    defaultBackground: string | null;
    defaultModeration: string | null;
    outputCompression: number | null;
    timeoutMs: number | null;
    maxImages: number | null;
  }>;
  dynamicTools?: Partial<{
    enabledByName: Partial<Record<BuiltinDynamicToolName, boolean>> | null;
  }>;
  developer?: Partial<{
    debugLogEnabled: boolean;
  }>;
};

export const DEFAULT_NOTIFICATION_SOUND_VOLUME_PERCENT = 70;
export const DEFAULT_GLOBAL_SURFACE_OPACITY_PERCENT = 100;
export const MIN_GLOBAL_SURFACE_OPACITY_PERCENT = 10;
export const MAX_GLOBAL_SURFACE_OPACITY_PERCENT = 100;
export const DEFAULT_GLOBAL_BACKGROUND_FIT_MODE: GlobalBackgroundFitMode = "cover";
export const DEFAULT_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC = 15;
export const MIN_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC = 5;
export const MAX_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC = 120;
export const DEFAULT_IMAGE_GENERATION_MODEL = "gpt-image-2";
export const DEFAULT_IMAGE_GENERATION_SIZE = "1024x1024";
export const DEFAULT_IMAGE_GENERATION_QUALITY = "auto";
export const DEFAULT_IMAGE_GENERATION_OUTPUT_FORMAT = "png";
export const DEFAULT_IMAGE_GENERATION_BACKGROUND = "auto";
export const DEFAULT_IMAGE_GENERATION_MODERATION = "auto";
export const DEFAULT_IMAGE_GENERATION_OUTPUT_COMPRESSION = 100;
export const MIN_IMAGE_GENERATION_OUTPUT_COMPRESSION = 0;
export const MAX_IMAGE_GENERATION_OUTPUT_COMPRESSION = 100;
export const DEFAULT_IMAGE_GENERATION_TIMEOUT_MS = 120_000;
export const MIN_IMAGE_GENERATION_TIMEOUT_MS = 10_000;
export const MAX_IMAGE_GENERATION_TIMEOUT_MS = 600_000;
export const DEFAULT_IMAGE_GENERATION_MAX_IMAGES = 1;
export const MIN_IMAGE_GENERATION_MAX_IMAGES = 1;
export const MAX_IMAGE_GENERATION_MAX_IMAGES = 4;
export const DEFAULT_UI_FONT_FAMILY_PRESET: UiFontFamilyPreset = "alibaba-puhuiti";
export const DEFAULT_UI_FONT_SIZE_PRESET: UiFontSizePreset = "medium";
export const DEFAULT_UI_WORKSPACE_FILE_ICON_THEME: UiWorkspaceFileIconTheme = "lucide";
const UI_FONT_SIZE_ZOOM_FACTORS: Record<UiFontSizePreset, number> = {
  small: 0.92,
  medium: 1,
  large: 1.08,
};

function buildDefaultDynamicToolsEnabledByName(): Record<BuiltinDynamicToolName, boolean> {
  return { image_generate: true };
}

function normalizeUiFontFamilyPreset(value: unknown): UiFontFamilyPreset {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "source-han-sans-sc") return "source-han-sans-sc";
  if (raw === "alibaba-puhuiti") return "alibaba-puhuiti";
  return DEFAULT_UI_FONT_FAMILY_PRESET;
}

function normalizeUiFontSizePreset(value: unknown): UiFontSizePreset {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "small") return "small";
  if (raw === "large") return "large";
  return DEFAULT_UI_FONT_SIZE_PRESET;
}

export function normalizeUiWorkspaceFileIconTheme(value: unknown): UiWorkspaceFileIconTheme {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "vscode-icons") return "vscode-icons";
  return DEFAULT_UI_WORKSPACE_FILE_ICON_THEME;
}

function normalizeAssistantFinalMessageFormat(value: unknown): AssistantFinalMessageFormat {
  return value === "structured-json-v1" ? "structured-json-v1" : "markdown";
}

function normalizeAssistantPlanMessageFormat(value: unknown): AssistantPlanMessageFormat {
  return value === "plan-card-v1" ? "plan-card-v1" : "markdown";
}

export function resolveUiFontSizeZoomFactor(value: UiFontSizePreset): number {
  return UI_FONT_SIZE_ZOOM_FACTORS[value] ?? UI_FONT_SIZE_ZOOM_FACTORS[DEFAULT_UI_FONT_SIZE_PRESET];
}

export const DEFAULT_USER_LOCAL_SETTINGS: UserLocalSettings = {
  version: 1,
  ui: {
    theme: null,
    backgroundOpacityPercent: 100,
    mainView: "chat",
    leftSidebarVisible: true,
    leftSidebarWidthPx: 320,
    filesSidebarVisible: true,
    filesSidebarWidthPx: 300,
    centerEditorWidthPx: 460,
    fontFamilyPreset: DEFAULT_UI_FONT_FAMILY_PRESET,
    fontSizePreset: DEFAULT_UI_FONT_SIZE_PRESET,
    workspaceFileIconTheme: DEFAULT_UI_WORKSPACE_FILE_ICON_THEME,
    assistantFinalMessageFormat: "markdown",
    assistantPlanMessageFormat: "markdown",
    threadWorkspaceGroupsCollapsed: {},
    globalConfigAdvancedOpen: false,
  },
  notification: {
    selectedSoundId: null,
    soundVolumePercent: DEFAULT_NOTIFICATION_SOUND_VOLUME_PERCENT,
  },
  models: {
    customIds: [],
  },
  workspaceAppearance: {
    backgroundImageRelativePath: null,
    surfaceOpacityPercent: DEFAULT_GLOBAL_SURFACE_OPACITY_PERCENT,
    backgroundFitMode: DEFAULT_GLOBAL_BACKGROUND_FIT_MODE,
  },
  remoteSync: {
    enabled: false,
    serverBaseUrl: null,
    username: null,
    accessToken: null,
    refreshToken: null,
    desktopId: null,
    heartbeatIntervalSec: DEFAULT_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC,
  },
  imageGeneration: {
    enabled: false,
    baseUrl: null,
    apiKey: null,
    model: DEFAULT_IMAGE_GENERATION_MODEL,
    defaultSize: DEFAULT_IMAGE_GENERATION_SIZE,
    defaultQuality: DEFAULT_IMAGE_GENERATION_QUALITY,
    outputFormat: DEFAULT_IMAGE_GENERATION_OUTPUT_FORMAT,
    defaultBackground: DEFAULT_IMAGE_GENERATION_BACKGROUND,
    defaultModeration: DEFAULT_IMAGE_GENERATION_MODERATION,
    outputCompression: DEFAULT_IMAGE_GENERATION_OUTPUT_COMPRESSION,
    timeoutMs: DEFAULT_IMAGE_GENERATION_TIMEOUT_MS,
    maxImages: DEFAULT_IMAGE_GENERATION_MAX_IMAGES,
  },
  dynamicTools: {
    enabledByName: buildDefaultDynamicToolsEnabledByName(),
  },
  developer: {
    debugLogEnabled: false,
  },
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toNullableString(value: unknown, fallback: string | null): string | null {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || null;
}

function toPositiveInteger(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  return rounded > 0 ? rounded : fallback;
}

function toIntegerInRange(value: unknown, fallback: number, min: number, max: number): number {
  if (value == null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function toNonEmptyString(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeHttpBaseUrl(value: unknown, fallback: string | null): string | null {
  const text = toNullableString(value, fallback);
  if (!text) return null;
  const normalized = text.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) return fallback;
  return normalized;
}

function normalizeMainView(value: unknown, fallback: MainView): MainView {
  if (value === "image") return "image";
  if (value === "chat") return "chat";
  return fallback;
}

function normalizeGlobalAppearanceState(value: unknown): LocalGlobalAppearanceState {
  const record = toRecord(value);
  return {
    backgroundImageRelativePath: toNullableString(record?.backgroundImageRelativePath, null),
    surfaceOpacityPercent: toIntegerInRange(
      record?.surfaceOpacityPercent,
      DEFAULT_GLOBAL_SURFACE_OPACITY_PERCENT,
      MIN_GLOBAL_SURFACE_OPACITY_PERCENT,
      MAX_GLOBAL_SURFACE_OPACITY_PERCENT
    ),
    backgroundFitMode:
      record?.backgroundFitMode === "contain" || record?.backgroundFitMode === "tile"
        ? record.backgroundFitMode
        : DEFAULT_GLOBAL_BACKGROUND_FIT_MODE,
  };
}

function normalizeRemoteSyncSettings(value: unknown): LocalRemoteSyncSettings {
  const record = toRecord(value);
  return {
    enabled: toBoolean(record?.enabled, DEFAULT_USER_LOCAL_SETTINGS.remoteSync.enabled),
    serverBaseUrl: toNullableString(record?.serverBaseUrl, DEFAULT_USER_LOCAL_SETTINGS.remoteSync.serverBaseUrl),
    username: toNullableString(record?.username, DEFAULT_USER_LOCAL_SETTINGS.remoteSync.username),
    accessToken: toNullableString(record?.accessToken, DEFAULT_USER_LOCAL_SETTINGS.remoteSync.accessToken),
    refreshToken: toNullableString(record?.refreshToken, DEFAULT_USER_LOCAL_SETTINGS.remoteSync.refreshToken),
    desktopId: toNullableString(record?.desktopId, DEFAULT_USER_LOCAL_SETTINGS.remoteSync.desktopId),
    heartbeatIntervalSec: toIntegerInRange(
      record?.heartbeatIntervalSec,
      DEFAULT_USER_LOCAL_SETTINGS.remoteSync.heartbeatIntervalSec,
      MIN_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC,
      MAX_REMOTE_SYNC_HEARTBEAT_INTERVAL_SEC
    ),
  };
}

function normalizeImageGenerationSettings(value: unknown): LocalImageGenerationSettings {
  const record = toRecord(value);
  return {
    enabled: toBoolean(record?.enabled, DEFAULT_USER_LOCAL_SETTINGS.imageGeneration.enabled),
    baseUrl: normalizeHttpBaseUrl(record?.baseUrl, DEFAULT_USER_LOCAL_SETTINGS.imageGeneration.baseUrl),
    apiKey: toNullableString(record?.apiKey, DEFAULT_USER_LOCAL_SETTINGS.imageGeneration.apiKey),
    model: toNonEmptyString(record?.model, DEFAULT_USER_LOCAL_SETTINGS.imageGeneration.model),
    defaultSize: toNonEmptyString(record?.defaultSize, DEFAULT_USER_LOCAL_SETTINGS.imageGeneration.defaultSize),
    defaultQuality: toNonEmptyString(
      record?.defaultQuality,
      DEFAULT_USER_LOCAL_SETTINGS.imageGeneration.defaultQuality
    ),
    outputFormat: toNonEmptyString(record?.outputFormat, DEFAULT_USER_LOCAL_SETTINGS.imageGeneration.outputFormat),
    defaultBackground: toNonEmptyString(
      record?.defaultBackground,
      DEFAULT_USER_LOCAL_SETTINGS.imageGeneration.defaultBackground
    ),
    defaultModeration: toNonEmptyString(
      record?.defaultModeration,
      DEFAULT_USER_LOCAL_SETTINGS.imageGeneration.defaultModeration
    ),
    outputCompression: toIntegerInRange(
      record?.outputCompression,
      DEFAULT_USER_LOCAL_SETTINGS.imageGeneration.outputCompression,
      MIN_IMAGE_GENERATION_OUTPUT_COMPRESSION,
      MAX_IMAGE_GENERATION_OUTPUT_COMPRESSION
    ),
    timeoutMs: toIntegerInRange(
      record?.timeoutMs,
      DEFAULT_USER_LOCAL_SETTINGS.imageGeneration.timeoutMs,
      MIN_IMAGE_GENERATION_TIMEOUT_MS,
      MAX_IMAGE_GENERATION_TIMEOUT_MS
    ),
    maxImages: toIntegerInRange(
      record?.maxImages,
      DEFAULT_USER_LOCAL_SETTINGS.imageGeneration.maxImages,
      MIN_IMAGE_GENERATION_MAX_IMAGES,
      MAX_IMAGE_GENERATION_MAX_IMAGES
    ),
  };
}

function normalizeDynamicToolsSettings(value: unknown): LocalDynamicToolsSettings {
  const record = toRecord(value);
  const enabledRecord = toRecord(record?.enabledByName);
  const enabledByName = buildDefaultDynamicToolsEnabledByName();
  for (const [rawName, rawEnabled] of Object.entries(enabledRecord ?? {})) {
    const name = normalizeBuiltinDynamicToolName(rawName);
    if (!name || typeof rawEnabled !== "boolean") continue;
    (enabledByName as Record<string, boolean>)[name] = rawEnabled;
  }
  return { enabledByName };
}

function mergeDynamicToolsEnabledByName(
  current: Record<BuiltinDynamicToolName, boolean>,
  patchValue: unknown
): Record<BuiltinDynamicToolName, boolean> {
  const patchRecord = toRecord(patchValue);
  const next = { ...current };
  for (const [rawName, rawEnabled] of Object.entries(patchRecord ?? {})) {
    const name = normalizeBuiltinDynamicToolName(rawName);
    if (!name || typeof rawEnabled !== "boolean") continue;
    (next as Record<string, boolean>)[name] = rawEnabled;
  }
  return next;
}

function normalizeThreadWorkspaceGroupsCollapsedState(value: unknown): LocalThreadWorkspaceGroupsCollapsedState {
  const record = toRecord(value);
  const normalized: LocalThreadWorkspaceGroupsCollapsedState = {};
  for (const [rawKey, rawValue] of Object.entries(record ?? {})) {
    const key = String(rawKey ?? "").trim();
    if (!key || rawValue !== true) continue;
    normalized[key] = true;
  }
  return normalized;
}

export function normalizeUserLocalSettings(value: unknown): UserLocalSettings {
  const root = toRecord(value);
  const ui = toRecord(root?.ui);
  const notification = toRecord(root?.notification);
  const models = toRecord(root?.models);
  const globalAppearance = toRecord(root?.workspaceAppearance);
  const remoteSync = toRecord(root?.remoteSync);
  const imageGeneration = toRecord(root?.imageGeneration);
  const dynamicTools = toRecord(root?.dynamicTools);
  const developer = toRecord(root?.developer);
  const inferredMainViewFallback: MainView = DEFAULT_USER_LOCAL_SETTINGS.ui.mainView;

  return {
    version: 1,
    ui: {
      theme: toNullableString(ui?.theme, DEFAULT_USER_LOCAL_SETTINGS.ui.theme),
      backgroundOpacityPercent: toIntegerInRange(
        ui?.backgroundOpacityPercent,
        DEFAULT_USER_LOCAL_SETTINGS.ui.backgroundOpacityPercent,
        10,
        100
      ),
      mainView: normalizeMainView(ui?.mainView, inferredMainViewFallback),
      leftSidebarVisible: toBoolean(ui?.leftSidebarVisible, DEFAULT_USER_LOCAL_SETTINGS.ui.leftSidebarVisible),
      leftSidebarWidthPx: toPositiveInteger(ui?.leftSidebarWidthPx, DEFAULT_USER_LOCAL_SETTINGS.ui.leftSidebarWidthPx),
      filesSidebarVisible: toBoolean(ui?.filesSidebarVisible, DEFAULT_USER_LOCAL_SETTINGS.ui.filesSidebarVisible),
      filesSidebarWidthPx: toPositiveInteger(
        ui?.filesSidebarWidthPx,
        DEFAULT_USER_LOCAL_SETTINGS.ui.filesSidebarWidthPx
      ),
      centerEditorWidthPx: toPositiveInteger(
        ui?.centerEditorWidthPx,
        DEFAULT_USER_LOCAL_SETTINGS.ui.centerEditorWidthPx
      ),
      fontFamilyPreset: normalizeUiFontFamilyPreset(ui?.fontFamilyPreset),
      fontSizePreset: normalizeUiFontSizePreset(ui?.fontSizePreset),
      workspaceFileIconTheme: normalizeUiWorkspaceFileIconTheme(ui?.workspaceFileIconTheme),
      assistantFinalMessageFormat: normalizeAssistantFinalMessageFormat(ui?.assistantFinalMessageFormat),
      assistantPlanMessageFormat: normalizeAssistantPlanMessageFormat(ui?.assistantPlanMessageFormat),
      threadWorkspaceGroupsCollapsed: normalizeThreadWorkspaceGroupsCollapsedState(ui?.threadWorkspaceGroupsCollapsed),
      globalConfigAdvancedOpen: toBoolean(
        ui?.globalConfigAdvancedOpen,
        DEFAULT_USER_LOCAL_SETTINGS.ui.globalConfigAdvancedOpen
      ),
    },
    notification: {
      selectedSoundId: toNullableString(
        notification?.selectedSoundId,
        DEFAULT_USER_LOCAL_SETTINGS.notification.selectedSoundId
      ),
      soundVolumePercent: toIntegerInRange(
        notification?.soundVolumePercent,
        DEFAULT_USER_LOCAL_SETTINGS.notification.soundVolumePercent,
        0,
        100
      ),
    },
    models: {
      customIds: normalizeCustomModelIds(models?.customIds),
    },
    workspaceAppearance: normalizeGlobalAppearanceState(globalAppearance),
    remoteSync: normalizeRemoteSyncSettings(remoteSync),
    imageGeneration: normalizeImageGenerationSettings(imageGeneration),
    dynamicTools: normalizeDynamicToolsSettings(dynamicTools),
    developer: {
      debugLogEnabled: toBoolean(developer?.debugLogEnabled, DEFAULT_USER_LOCAL_SETTINGS.developer.debugLogEnabled),
    },
  };
}

export function mergeUserLocalSettings(
  base: unknown,
  patch: UserLocalSettingsPatch | null | undefined
): UserLocalSettings {
  const current = normalizeUserLocalSettings(base);
  const patchUi = toRecord(patch?.ui);
  const patchNotification = toRecord(patch?.notification);
  const patchModels = toRecord(patch?.models);
  const patchGlobalAppearance = toRecord(patch?.workspaceAppearance);
  const patchRemoteSync = toRecord(patch?.remoteSync);
  const patchImageGeneration = toRecord(patch?.imageGeneration);
  const patchDynamicTools = toRecord(patch?.dynamicTools);
  const patchDeveloper = toRecord(patch?.developer);

  return normalizeUserLocalSettings({
    version: 1,
    ui: {
      theme: patchUi && "theme" in patchUi ? patchUi.theme : current.ui.theme,
      backgroundOpacityPercent:
        patchUi && "backgroundOpacityPercent" in patchUi
          ? patchUi.backgroundOpacityPercent
          : current.ui.backgroundOpacityPercent,
      mainView: patchUi && "mainView" in patchUi ? patchUi.mainView : current.ui.mainView,
      leftSidebarVisible:
        patchUi && "leftSidebarVisible" in patchUi ? patchUi.leftSidebarVisible : current.ui.leftSidebarVisible,
      leftSidebarWidthPx:
        patchUi && "leftSidebarWidthPx" in patchUi ? patchUi.leftSidebarWidthPx : current.ui.leftSidebarWidthPx,
      filesSidebarVisible:
        patchUi && "filesSidebarVisible" in patchUi ? patchUi.filesSidebarVisible : current.ui.filesSidebarVisible,
      filesSidebarWidthPx:
        patchUi && "filesSidebarWidthPx" in patchUi ? patchUi.filesSidebarWidthPx : current.ui.filesSidebarWidthPx,
      centerEditorWidthPx:
        patchUi && "centerEditorWidthPx" in patchUi ? patchUi.centerEditorWidthPx : current.ui.centerEditorWidthPx,
      fontFamilyPreset:
        patchUi && "fontFamilyPreset" in patchUi ? patchUi.fontFamilyPreset : current.ui.fontFamilyPreset,
      fontSizePreset: patchUi && "fontSizePreset" in patchUi ? patchUi.fontSizePreset : current.ui.fontSizePreset,
      workspaceFileIconTheme:
        patchUi && "workspaceFileIconTheme" in patchUi
          ? patchUi.workspaceFileIconTheme
          : current.ui.workspaceFileIconTheme,
      assistantFinalMessageFormat:
        patchUi && "assistantFinalMessageFormat" in patchUi
          ? patchUi.assistantFinalMessageFormat
          : current.ui.assistantFinalMessageFormat,
      assistantPlanMessageFormat:
        patchUi && "assistantPlanMessageFormat" in patchUi
          ? patchUi.assistantPlanMessageFormat
          : current.ui.assistantPlanMessageFormat,
      threadWorkspaceGroupsCollapsed:
        patchUi && "threadWorkspaceGroupsCollapsed" in patchUi
          ? patchUi.threadWorkspaceGroupsCollapsed
          : current.ui.threadWorkspaceGroupsCollapsed,
      globalConfigAdvancedOpen:
        patchUi && "globalConfigAdvancedOpen" in patchUi
          ? patchUi.globalConfigAdvancedOpen
          : current.ui.globalConfigAdvancedOpen,
    },
    notification: {
      selectedSoundId:
        patchNotification && "selectedSoundId" in patchNotification
          ? patchNotification.selectedSoundId
          : current.notification.selectedSoundId,
      soundVolumePercent:
        patchNotification && "soundVolumePercent" in patchNotification
          ? patchNotification.soundVolumePercent
          : current.notification.soundVolumePercent,
    },
    models: {
      customIds: patchModels && "customIds" in patchModels ? patchModels.customIds : current.models.customIds,
    },
    workspaceAppearance: {
      backgroundImageRelativePath:
        patchGlobalAppearance && "backgroundImageRelativePath" in patchGlobalAppearance
          ? patchGlobalAppearance.backgroundImageRelativePath
          : current.workspaceAppearance.backgroundImageRelativePath,
      surfaceOpacityPercent:
        patchGlobalAppearance && "surfaceOpacityPercent" in patchGlobalAppearance
          ? patchGlobalAppearance.surfaceOpacityPercent
          : current.workspaceAppearance.surfaceOpacityPercent,
      backgroundFitMode:
        patchGlobalAppearance && "backgroundFitMode" in patchGlobalAppearance
          ? patchGlobalAppearance.backgroundFitMode
          : current.workspaceAppearance.backgroundFitMode,
    },
    remoteSync: {
      enabled: patchRemoteSync && "enabled" in patchRemoteSync ? patchRemoteSync.enabled : current.remoteSync.enabled,
      serverBaseUrl:
        patchRemoteSync && "serverBaseUrl" in patchRemoteSync
          ? patchRemoteSync.serverBaseUrl
          : current.remoteSync.serverBaseUrl,
      username:
        patchRemoteSync && "username" in patchRemoteSync ? patchRemoteSync.username : current.remoteSync.username,
      accessToken:
        patchRemoteSync && "accessToken" in patchRemoteSync
          ? patchRemoteSync.accessToken
          : current.remoteSync.accessToken,
      refreshToken:
        patchRemoteSync && "refreshToken" in patchRemoteSync
          ? patchRemoteSync.refreshToken
          : current.remoteSync.refreshToken,
      desktopId:
        patchRemoteSync && "desktopId" in patchRemoteSync ? patchRemoteSync.desktopId : current.remoteSync.desktopId,
      heartbeatIntervalSec:
        patchRemoteSync && "heartbeatIntervalSec" in patchRemoteSync
          ? patchRemoteSync.heartbeatIntervalSec
          : current.remoteSync.heartbeatIntervalSec,
    },
    imageGeneration: {
      enabled:
        patchImageGeneration && "enabled" in patchImageGeneration
          ? patchImageGeneration.enabled
          : current.imageGeneration.enabled,
      baseUrl:
        patchImageGeneration && "baseUrl" in patchImageGeneration
          ? patchImageGeneration.baseUrl
          : current.imageGeneration.baseUrl,
      apiKey:
        patchImageGeneration && "apiKey" in patchImageGeneration
          ? patchImageGeneration.apiKey
          : current.imageGeneration.apiKey,
      model:
        patchImageGeneration && "model" in patchImageGeneration
          ? patchImageGeneration.model
          : current.imageGeneration.model,
      defaultSize:
        patchImageGeneration && "defaultSize" in patchImageGeneration
          ? patchImageGeneration.defaultSize
          : current.imageGeneration.defaultSize,
      defaultQuality:
        patchImageGeneration && "defaultQuality" in patchImageGeneration
          ? patchImageGeneration.defaultQuality
          : current.imageGeneration.defaultQuality,
      outputFormat:
        patchImageGeneration && "outputFormat" in patchImageGeneration
          ? patchImageGeneration.outputFormat
          : current.imageGeneration.outputFormat,
      defaultBackground:
        patchImageGeneration && "defaultBackground" in patchImageGeneration
          ? patchImageGeneration.defaultBackground
          : current.imageGeneration.defaultBackground,
      defaultModeration:
        patchImageGeneration && "defaultModeration" in patchImageGeneration
          ? patchImageGeneration.defaultModeration
          : current.imageGeneration.defaultModeration,
      outputCompression:
        patchImageGeneration && "outputCompression" in patchImageGeneration
          ? patchImageGeneration.outputCompression
          : current.imageGeneration.outputCompression,
      timeoutMs:
        patchImageGeneration && "timeoutMs" in patchImageGeneration
          ? patchImageGeneration.timeoutMs
          : current.imageGeneration.timeoutMs,
      maxImages:
        patchImageGeneration && "maxImages" in patchImageGeneration
          ? patchImageGeneration.maxImages
          : current.imageGeneration.maxImages,
    },
    dynamicTools: {
      enabledByName:
        patchDynamicTools && "enabledByName" in patchDynamicTools
          ? mergeDynamicToolsEnabledByName(current.dynamicTools.enabledByName, patchDynamicTools.enabledByName)
          : current.dynamicTools.enabledByName,
    },
    developer: {
      debugLogEnabled:
        patchDeveloper && "debugLogEnabled" in patchDeveloper
          ? patchDeveloper.debugLogEnabled
          : current.developer.debugLogEnabled,
    },
  });
}
