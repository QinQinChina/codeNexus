<template>
  <section class="settings-card" :aria-label="t('settingsImageGeneration.aria')">
    <header class="settings-card-head">
      <div class="settings-card-title">{{ t("settingsImageGeneration.title") }}</div>
      <button class="btn-mini" type="button" :disabled="saveDisabled" @click="onSave">
        {{ saveButtonText }}
      </button>
    </header>

    <div class="settings-card-body">
      <div class="settings-grid">
        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsImageGeneration.enable") }}</span>
          <div class="settings-inline">
            <input id="chk-image-generation-enabled" v-model="draft.enabled" type="checkbox" :disabled="saving" />
            <span class="dim mono">{{ draft.enabled ? "enabled" : "disabled" }}</span>
          </div>
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsImageGeneration.serviceUrl") }}</span>
          <input
            id="inp-image-generation-base-url"
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
            id="inp-image-generation-api-key"
            v-model="draft.apiKey"
            class="context-input mono"
            type="password"
            autocomplete="off"
            placeholder="sk-..."
            :disabled="saving"
          />
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsImageGeneration.model") }}</span>
          <input
            id="inp-image-generation-model"
            v-model="draft.model"
            class="context-input mono"
            type="text"
            placeholder="gpt-image-2"
            :disabled="saving"
          />
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsImageGeneration.defaultSize") }}</span>
          <select
            id="sel-image-generation-size"
            v-model="draft.defaultSize"
            class="context-input mono"
            :disabled="saving"
          >
            <option value="1024x1024">1024x1024</option>
            <option value="1024x1536">1024x1536</option>
            <option value="1536x1024">1536x1024</option>
            <option value="auto">auto</option>
          </select>
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsImageGeneration.defaultQuality") }}</span>
          <select
            id="sel-image-generation-quality"
            v-model="draft.defaultQuality"
            class="context-input mono"
            :disabled="saving"
          >
            <option value="auto">auto</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsImageGeneration.outputFormat") }}</span>
          <select
            id="sel-image-generation-output-format"
            v-model="draft.outputFormat"
            class="context-input mono"
            :disabled="saving"
          >
            <option value="png">png</option>
            <option value="jpeg">jpeg</option>
            <option value="webp">webp</option>
          </select>
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsImageGeneration.defaultBackground") }}</span>
          <select
            id="sel-image-generation-background"
            v-model="draft.defaultBackground"
            class="context-input mono"
            :disabled="saving"
          >
            <option value="auto">auto</option>
            <option value="transparent">transparent</option>
            <option value="opaque">opaque</option>
          </select>
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsImageGeneration.moderation") }}</span>
          <select
            id="sel-image-generation-moderation"
            v-model="draft.defaultModeration"
            class="context-input mono"
            :disabled="saving"
          >
            <option value="auto">auto</option>
            <option value="low">low</option>
          </select>
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsImageGeneration.outputCompression") }}</span>
          <div class="settings-inline">
            <input
              id="inp-image-generation-output-compression"
              v-model.number="draft.outputCompression"
              class="context-input mono"
              type="number"
              :min="MIN_IMAGE_GENERATION_OUTPUT_COMPRESSION"
              :max="MAX_IMAGE_GENERATION_OUTPUT_COMPRESSION"
              step="1"
              :disabled="saving"
              @blur="normalizeDraftNumbers"
            />
            <span class="dim mono">jpeg/webp</span>
          </div>
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsImageGeneration.timeout") }}</span>
          <div class="settings-inline">
            <input
              id="inp-image-generation-timeout"
              v-model.number="draft.timeoutMs"
              class="context-input mono"
              type="number"
              :min="MIN_IMAGE_GENERATION_TIMEOUT_MS"
              :max="MAX_IMAGE_GENERATION_TIMEOUT_MS"
              step="1000"
              :disabled="saving"
              @blur="normalizeDraftNumbers"
            />
            <span class="dim mono">ms</span>
          </div>
        </label>

        <label class="settings-row">
          <span class="context-label dim">{{ t("settingsImageGeneration.imageCount") }}</span>
          <div class="settings-inline">
            <input
              id="inp-image-generation-max-images"
              v-model.number="draft.maxImages"
              class="context-input mono"
              type="number"
              :min="MIN_IMAGE_GENERATION_MAX_IMAGES"
              :max="MAX_IMAGE_GENERATION_MAX_IMAGES"
              step="1"
              :disabled="saving"
              @blur="normalizeDraftNumbers"
            />
            <span class="dim mono">max</span>
          </div>
        </label>

        <div class="status-panel" :class="{ 'is-ready': isConfigured, 'is-disabled': !normalizedDraft.enabled }">
          <div class="status-row">
            <span class="dim">{{ t("settingsImageGeneration.status") }}</span>
            <span class="mono">{{ statusText }}</span>
          </div>
          <div class="status-row">
            <span class="dim">{{ t("settingsImageGeneration.mode") }}</span>
            <span class="mono">generate / edit</span>
          </div>
          <div class="status-row">
            <span class="dim">{{ t("settingsImageGeneration.generate") }}</span>
            <span class="mono">{{ generationEndpointPreview }}</span>
          </div>
          <div class="status-row">
            <span class="dim">{{ t("settingsImageGeneration.edit") }}</span>
            <span class="mono">{{ editEndpointPreview }}</span>
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
  MAX_IMAGE_GENERATION_OUTPUT_COMPRESSION,
  MAX_IMAGE_GENERATION_MAX_IMAGES,
  MAX_IMAGE_GENERATION_TIMEOUT_MS,
  MIN_IMAGE_GENERATION_OUTPUT_COMPRESSION,
  MIN_IMAGE_GENERATION_MAX_IMAGES,
  MIN_IMAGE_GENERATION_TIMEOUT_MS,
  cloneImageGenerationSettings,
  normalizeImageGenerationSettings,
  resolveImageGenerationEndpointPreview,
  type LocalImageGenerationSettings,
} from "@codenexus/feature-imagegen/settings";
import { getCachedUserLocalSettings, patchUserLocalSettings } from "../../../domain/localSettings";
import { showToast } from "../../../ui/toast";

type Draft = LocalImageGenerationSettings;

const initial = cloneImageGenerationSettings(getCachedUserLocalSettings().settings.imageGeneration);
const { t } = useI18n();
const snapshot = ref<Draft>(cloneImageGenerationSettings(initial));
const draft = reactive<Draft>(cloneImageGenerationSettings(initial));
const saving = ref(false);

const normalizedDraft = computed<Draft>(() => normalizeImageGenerationSettings({ ...draft }));

const hasChanges = computed(() => JSON.stringify(normalizedDraft.value) !== JSON.stringify(snapshot.value));
const isConfigured = computed(() =>
  Boolean(normalizedDraft.value.enabled && normalizedDraft.value.baseUrl && normalizedDraft.value.apiKey)
);
const saveButtonText = computed(() => {
  if (saving.value) return t("settingsImageGeneration.saving");
  if (hasChanges.value) return t("settingsImageGeneration.saveConfig");
  return t("settingsImageGeneration.configSaved");
});
const saveDisabled = computed(() => saving.value || !hasChanges.value);
const statusText = computed(() => {
  if (!normalizedDraft.value.enabled) return t("settingsImageGeneration.disabled");
  if (!normalizedDraft.value.baseUrl) return t("settingsImageGeneration.missingServiceUrl");
  if (!normalizedDraft.value.apiKey) return t("settingsImageGeneration.missingApiKey");
  return t("settingsImageGeneration.configured");
});
const generationEndpointPreview = computed(() =>
  resolveImageGenerationEndpointPreview(normalizedDraft.value.baseUrl, "generations")
);
const editEndpointPreview = computed(() =>
  resolveImageGenerationEndpointPreview(normalizedDraft.value.baseUrl, "edits")
);

function applySnapshot(next: Draft) {
  snapshot.value = cloneImageGenerationSettings(next);
  Object.assign(draft, cloneImageGenerationSettings(next));
}

function normalizeDraftNumbers() {
  draft.timeoutMs = normalizedDraft.value.timeoutMs;
  draft.maxImages = normalizedDraft.value.maxImages;
  draft.outputCompression = normalizedDraft.value.outputCompression;
}

async function onSave() {
  saving.value = true;
  try {
    const next = normalizedDraft.value;
    const result = await patchUserLocalSettings({ imageGeneration: next });
    applySnapshot(result.settings.imageGeneration);
    showToast({
      kind: "success",
      title: t("settingsImageGeneration.saveSuccessTitle"),
      message: t("settingsImageGeneration.saveSuccessMessage"),
    });
  } catch (error: any) {
    showToast({
      kind: "error",
      title: t("settingsImageGeneration.saveFailedTitle"),
      message: String(error?.message ?? error ?? "unknown error"),
    });
  } finally {
    saving.value = false;
  }
}
</script>
