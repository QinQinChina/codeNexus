<template>
  <section class="settings-card" :aria-label="t('settingsFlowchartAi.aria')">
    <header class="settings-card-head">
      <div class="settings-card-title">{{ t("settingsFlowchartAi.title") }}</div>
      <button class="btn-mini" type="button" :disabled="saveDisabled" @click="onSave">
        {{ saveButtonText }}
      </button>
    </header>

    <div class="settings-card-body">
      <div class="settings-grid">
        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsFlowchartAi.enable") }}</span>
          <div class="settings-inline">
            <input id="chk-flowchart-ai-enabled" v-model="draft.enabled" type="checkbox" :disabled="saving" />
            <span class="dim mono">{{ draft.enabled ? "enabled" : "disabled" }}</span>
          </div>
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsFlowchartAi.serviceUrl") }}</span>
          <input
            id="inp-flowchart-ai-base-url"
            v-model="draft.baseUrl"
            class="context-input mono"
            type="text"
            placeholder="https://api.example.com/v1"
            :disabled="saving"
          />
        </label>

        <label class="settings-row">
          <span class="context-label dim">API Key</span>
          <input
            id="inp-flowchart-ai-api-key"
            v-model="draft.apiKey"
            class="context-input mono"
            type="password"
            autocomplete="off"
            placeholder="sk-..."
            :disabled="saving"
          />
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsFlowchartAi.model") }}</span>
          <input
            id="inp-flowchart-ai-model"
            v-model="draft.model"
            class="context-input mono"
            type="text"
            placeholder="gpt-4o-mini"
            :disabled="saving"
          />
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsFlowchartAi.timeout") }}</span>
          <div class="settings-inline">
            <input
              id="inp-flowchart-ai-timeout"
              v-model.number="draft.timeoutMs"
              class="context-input mono"
              type="number"
              :min="MIN_FLOWCHART_AI_TIMEOUT_MS"
              :max="MAX_FLOWCHART_AI_TIMEOUT_MS"
              step="1000"
              :disabled="saving"
              @blur="normalizeDraftNumbers"
            />
            <span class="dim mono">ms</span>
          </div>
        </label>

        <div class="status-panel" :class="{ 'is-ready': isConfigured, 'is-disabled': !normalizedDraft.enabled }">
          <div class="status-row">
            <span class="dim">{{ t("settingsFlowchartAi.status") }}</span>
            <span class="mono">{{ statusText }}</span>
          </div>
          <div class="status-row">
            <span class="dim">{{ t("settingsFlowchartAi.endpoint") }}</span>
            <span class="mono">{{ endpointPreview }}</span>
          </div>
          <div class="status-row">
            <span class="dim">{{ t("settingsFlowchartAi.mode") }}</span>
            <span class="mono">generate / modify</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  DEFAULT_FLOWCHART_AI_MODEL,
  DEFAULT_FLOWCHART_AI_TIMEOUT_MS,
  MAX_FLOWCHART_AI_TIMEOUT_MS,
  MIN_FLOWCHART_AI_TIMEOUT_MS,
} from "../../../../shared/flowchart";
import { type LocalFlowchartAiSettings } from "../../../../shared/localSettings";
import { getCachedUserLocalSettings, patchUserLocalSettings } from "../../../domain/localSettings";
import { showToast } from "../../../ui/toast";

type Draft = LocalFlowchartAiSettings;

function toNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeHttpBaseUrl(value: unknown): string | null {
  const text = toNullableText(value);
  if (!text) return null;
  const trimmed = text.replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function cloneSettings(value: LocalFlowchartAiSettings): Draft {
  return {
    enabled: Boolean(value.enabled),
    baseUrl: value.baseUrl,
    apiKey: value.apiKey,
    model: toNullableText(value.model) ?? DEFAULT_FLOWCHART_AI_MODEL,
    timeoutMs: clampInteger(
      value.timeoutMs,
      DEFAULT_FLOWCHART_AI_TIMEOUT_MS,
      MIN_FLOWCHART_AI_TIMEOUT_MS,
      MAX_FLOWCHART_AI_TIMEOUT_MS
    ),
  };
}

const { t } = useI18n();
const initial = cloneSettings(getCachedUserLocalSettings().settings.flowchartAi);
const snapshot = ref<Draft>(cloneSettings(initial));
const draft = reactive<Draft>(cloneSettings(initial));
const saving = ref(false);

const normalizedDraft = computed<Draft>(() => ({
  enabled: Boolean(draft.enabled),
  baseUrl: normalizeHttpBaseUrl(draft.baseUrl),
  apiKey: toNullableText(draft.apiKey),
  model: toNullableText(draft.model) ?? DEFAULT_FLOWCHART_AI_MODEL,
  timeoutMs: clampInteger(
    draft.timeoutMs,
    DEFAULT_FLOWCHART_AI_TIMEOUT_MS,
    MIN_FLOWCHART_AI_TIMEOUT_MS,
    MAX_FLOWCHART_AI_TIMEOUT_MS
  ),
}));

const hasChanges = computed(() => JSON.stringify(normalizedDraft.value) !== JSON.stringify(snapshot.value));
const isConfigured = computed(() =>
  Boolean(normalizedDraft.value.enabled && normalizedDraft.value.baseUrl && normalizedDraft.value.apiKey)
);
const saveButtonText = computed(() => {
  if (saving.value) return t("settingsFlowchartAi.saving");
  if (hasChanges.value) return t("settingsFlowchartAi.saveConfig");
  return t("settingsFlowchartAi.configSaved");
});
const saveDisabled = computed(() => saving.value || !hasChanges.value);
const statusText = computed(() => {
  if (!normalizedDraft.value.enabled) return t("settingsFlowchartAi.disabled");
  if (!normalizedDraft.value.baseUrl) return t("settingsFlowchartAi.missingServiceUrl");
  if (!normalizedDraft.value.apiKey) return t("settingsFlowchartAi.missingApiKey");
  return t("settingsFlowchartAi.configured");
});
const endpointPreview = computed(() => {
  const baseUrl = normalizedDraft.value.baseUrl;
  if (!baseUrl) return "-";
  if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl;
  if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
});

function applySnapshot(next: Draft) {
  snapshot.value = cloneSettings(next);
  Object.assign(draft, cloneSettings(next));
}

function normalizeDraftNumbers() {
  draft.timeoutMs = normalizedDraft.value.timeoutMs;
}

async function onSave() {
  saving.value = true;
  try {
    const result = await patchUserLocalSettings({ flowchartAi: normalizedDraft.value });
    applySnapshot(result.settings.flowchartAi);
    showToast({
      kind: "success",
      title: t("settingsFlowchartAi.saveSuccessTitle"),
      message: t("settingsFlowchartAi.saveSuccessMessage"),
    });
  } catch (error: any) {
    showToast({
      kind: "error",
      title: t("settingsFlowchartAi.saveFailedTitle"),
      message: String(error?.message ?? error ?? "unknown error"),
    });
  } finally {
    saving.value = false;
  }
}
</script>
