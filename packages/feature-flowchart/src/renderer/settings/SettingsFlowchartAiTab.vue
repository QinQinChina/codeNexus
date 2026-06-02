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
  MAX_FLOWCHART_AI_TIMEOUT_MS,
  MIN_FLOWCHART_AI_TIMEOUT_MS,
  cloneFlowchartAiSettings,
  normalizeFlowchartAiSettings,
  resolveFlowchartAiEndpointPreview,
  type LocalFlowchartAiSettings,
} from "@codenexus/feature-flowchart/settings";
import { getInitialFlowchartAiSettings, patchFlowchartAiSettings, showFlowchartToast } from "../runtimeBridge";

type Draft = LocalFlowchartAiSettings;

const { t } = useI18n();
const initial = cloneFlowchartAiSettings(getInitialFlowchartAiSettings());
const snapshot = ref<Draft>(cloneFlowchartAiSettings(initial));
const draft = reactive<Draft>(cloneFlowchartAiSettings(initial));
const saving = ref(false);

const normalizedDraft = computed<Draft>(() => normalizeFlowchartAiSettings({ ...draft }));

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
const endpointPreview = computed(() => resolveFlowchartAiEndpointPreview(normalizedDraft.value.baseUrl));

function applySnapshot(next: Draft) {
  snapshot.value = cloneFlowchartAiSettings(next);
  Object.assign(draft, cloneFlowchartAiSettings(next));
}

function normalizeDraftNumbers() {
  draft.timeoutMs = normalizedDraft.value.timeoutMs;
}

async function onSave() {
  saving.value = true;
  try {
    const nextSettings = await patchFlowchartAiSettings(normalizedDraft.value);
    applySnapshot(nextSettings);
    showFlowchartToast({
      kind: "success",
      title: t("settingsFlowchartAi.saveSuccessTitle"),
      message: t("settingsFlowchartAi.saveSuccessMessage"),
    });
  } catch (error: any) {
    showFlowchartToast({
      kind: "error",
      title: t("settingsFlowchartAi.saveFailedTitle"),
      message: String(error?.message ?? error ?? "unknown error"),
    });
  } finally {
    saving.value = false;
  }
}
</script>
