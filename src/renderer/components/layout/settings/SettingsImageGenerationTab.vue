<template>
  <section class="settings-card" aria-label="图片生成设置">
    <header class="settings-card-head">
      <div class="settings-card-title">图片生成</div>
      <button class="btn-mini" type="button" :disabled="saveDisabled" @click="onSave">
        {{ saveButtonText }}
      </button>
    </header>

    <div class="settings-card-body">
      <div class="settings-grid">
        <label class="settings-row">
          <span class="context-label dim">启用</span>
          <div class="settings-inline">
            <input id="chk-image-generation-enabled" v-model="draft.enabled" type="checkbox" :disabled="saving" />
            <span class="dim mono">{{ draft.enabled ? "enabled" : "disabled" }}</span>
          </div>
        </label>

        <label class="settings-row">
          <span class="context-label dim">服务地址</span>
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
          <span class="context-label dim">模型</span>
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
          <span class="context-label dim">默认尺寸</span>
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
          <span class="context-label dim">默认质量</span>
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
          <span class="context-label dim">输出格式</span>
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
          <span class="context-label dim">默认背景</span>
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
          <span class="context-label dim">审核级别</span>
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
          <span class="context-label dim">输出压缩</span>
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
          <span class="context-label dim">超时</span>
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
          <span class="context-label dim">图片数量</span>
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
            <span class="dim">状态</span>
            <span class="mono">{{ statusText }}</span>
          </div>
          <div class="status-row">
            <span class="dim">模式</span>
            <span class="mono">generate / edit</span>
          </div>
          <div class="status-row">
            <span class="dim">生成</span>
            <span class="mono">{{ generationEndpointPreview }}</span>
          </div>
          <div class="status-row">
            <span class="dim">编辑</span>
            <span class="mono">{{ editEndpointPreview }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import {
  DEFAULT_IMAGE_GENERATION_BACKGROUND,
  DEFAULT_IMAGE_GENERATION_MAX_IMAGES,
  DEFAULT_IMAGE_GENERATION_MODERATION,
  DEFAULT_IMAGE_GENERATION_MODEL,
  DEFAULT_IMAGE_GENERATION_OUTPUT_COMPRESSION,
  DEFAULT_IMAGE_GENERATION_OUTPUT_FORMAT,
  DEFAULT_IMAGE_GENERATION_QUALITY,
  DEFAULT_IMAGE_GENERATION_SIZE,
  DEFAULT_IMAGE_GENERATION_TIMEOUT_MS,
  MAX_IMAGE_GENERATION_OUTPUT_COMPRESSION,
  MAX_IMAGE_GENERATION_MAX_IMAGES,
  MAX_IMAGE_GENERATION_TIMEOUT_MS,
  MIN_IMAGE_GENERATION_OUTPUT_COMPRESSION,
  MIN_IMAGE_GENERATION_MAX_IMAGES,
  MIN_IMAGE_GENERATION_TIMEOUT_MS,
  type LocalImageGenerationSettings,
} from "../../../../shared/localSettings";
import { getCachedUserLocalSettings, patchUserLocalSettings } from "../../../domain/localSettings";
import { showToast } from "../../../ui/toast";

type Draft = LocalImageGenerationSettings;

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

function normalizeOutputFormat(value: unknown): string {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (text === "jpg") return "jpeg";
  if (text === "jpeg" || text === "webp" || text === "png") return text;
  return DEFAULT_IMAGE_GENERATION_OUTPUT_FORMAT;
}

function normalizeBackground(value: unknown): string {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (text === "transparent" || text === "opaque" || text === "auto") return text;
  return DEFAULT_IMAGE_GENERATION_BACKGROUND;
}

function normalizeModeration(value: unknown): string {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (text === "low" || text === "auto") return text;
  return DEFAULT_IMAGE_GENERATION_MODERATION;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function cloneSettings(value: LocalImageGenerationSettings): Draft {
  return {
    enabled: Boolean(value.enabled),
    baseUrl: value.baseUrl,
    apiKey: value.apiKey,
    model: String(value.model || DEFAULT_IMAGE_GENERATION_MODEL),
    defaultSize: String(value.defaultSize || DEFAULT_IMAGE_GENERATION_SIZE),
    defaultQuality: String(value.defaultQuality || DEFAULT_IMAGE_GENERATION_QUALITY),
    outputFormat: normalizeOutputFormat(value.outputFormat),
    defaultBackground: normalizeBackground(value.defaultBackground),
    defaultModeration: normalizeModeration(value.defaultModeration),
    outputCompression: clampInteger(
      value.outputCompression,
      DEFAULT_IMAGE_GENERATION_OUTPUT_COMPRESSION,
      MIN_IMAGE_GENERATION_OUTPUT_COMPRESSION,
      MAX_IMAGE_GENERATION_OUTPUT_COMPRESSION
    ),
    timeoutMs: clampInteger(
      value.timeoutMs,
      DEFAULT_IMAGE_GENERATION_TIMEOUT_MS,
      MIN_IMAGE_GENERATION_TIMEOUT_MS,
      MAX_IMAGE_GENERATION_TIMEOUT_MS
    ),
    maxImages: clampInteger(
      value.maxImages,
      DEFAULT_IMAGE_GENERATION_MAX_IMAGES,
      MIN_IMAGE_GENERATION_MAX_IMAGES,
      MAX_IMAGE_GENERATION_MAX_IMAGES
    ),
  };
}

const initial = cloneSettings(getCachedUserLocalSettings().settings.imageGeneration);
const snapshot = ref<Draft>(cloneSettings(initial));
const draft = reactive<Draft>(cloneSettings(initial));
const saving = ref(false);

const normalizedDraft = computed<Draft>(() => ({
  enabled: Boolean(draft.enabled),
  baseUrl: normalizeHttpBaseUrl(draft.baseUrl),
  apiKey: toNullableText(draft.apiKey),
  model: toNullableText(draft.model) ?? DEFAULT_IMAGE_GENERATION_MODEL,
  defaultSize: toNullableText(draft.defaultSize) ?? DEFAULT_IMAGE_GENERATION_SIZE,
  defaultQuality: toNullableText(draft.defaultQuality) ?? DEFAULT_IMAGE_GENERATION_QUALITY,
  outputFormat: normalizeOutputFormat(draft.outputFormat),
  defaultBackground: normalizeBackground(draft.defaultBackground),
  defaultModeration: normalizeModeration(draft.defaultModeration),
  outputCompression: clampInteger(
    draft.outputCompression,
    DEFAULT_IMAGE_GENERATION_OUTPUT_COMPRESSION,
    MIN_IMAGE_GENERATION_OUTPUT_COMPRESSION,
    MAX_IMAGE_GENERATION_OUTPUT_COMPRESSION
  ),
  timeoutMs: clampInteger(
    draft.timeoutMs,
    DEFAULT_IMAGE_GENERATION_TIMEOUT_MS,
    MIN_IMAGE_GENERATION_TIMEOUT_MS,
    MAX_IMAGE_GENERATION_TIMEOUT_MS
  ),
  maxImages: clampInteger(
    draft.maxImages,
    DEFAULT_IMAGE_GENERATION_MAX_IMAGES,
    MIN_IMAGE_GENERATION_MAX_IMAGES,
    MAX_IMAGE_GENERATION_MAX_IMAGES
  ),
}));

const hasChanges = computed(() => JSON.stringify(normalizedDraft.value) !== JSON.stringify(snapshot.value));
const isConfigured = computed(() =>
  Boolean(normalizedDraft.value.enabled && normalizedDraft.value.baseUrl && normalizedDraft.value.apiKey)
);
const saveButtonText = computed(() => {
  if (saving.value) return "保存中...";
  if (hasChanges.value) return "保存配置";
  return "配置已保存";
});
const saveDisabled = computed(() => saving.value || !hasChanges.value);
const statusText = computed(() => {
  if (!normalizedDraft.value.enabled) return "已关闭";
  if (!normalizedDraft.value.baseUrl) return "缺少服务地址";
  if (!normalizedDraft.value.apiKey) return "缺少 API Key";
  return "已配置";
});
function endpointPreview(kind: "generations" | "edits") {
  const baseUrl = normalizedDraft.value.baseUrl;
  if (!baseUrl) return "-";
  if (/\/images\/(generations|edits)$/i.test(baseUrl)) {
    return baseUrl.replace(/\/images\/(generations|edits)$/i, `/images/${kind}`);
  }
  if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/images/${kind}`;
  return `${baseUrl}/v1/images/${kind}`;
}

const generationEndpointPreview = computed(() => endpointPreview("generations"));
const editEndpointPreview = computed(() => endpointPreview("edits"));

function applySnapshot(next: Draft) {
  snapshot.value = cloneSettings(next);
  Object.assign(draft, cloneSettings(next));
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
    showToast({ kind: "success", title: "保存成功", message: "图片生成配置已更新。" });
  } catch (error: any) {
    showToast({
      kind: "error",
      title: "保存失败",
      message: String(error?.message ?? error ?? "unknown error"),
    });
  } finally {
    saving.value = false;
  }
}
</script>
