<template>
  <section class="codex-profiles-page" aria-label="Codex 模型切换">
    <div class="codex-profiles-head">
      <div class="codex-profiles-copy">
        <h2>模型切换</h2>
        <p>保存 Codex provider、model 与 API Key，应用时写入 Codex 全局配置和 <span class="mono">auth.json</span>。</p>
      </div>
      <div class="codex-profiles-actions">
        <button class="btn-mini" type="button" :disabled="profilesStore.loadState === 'loading'" @click="refresh">
          刷新
        </button>
        <button class="btn-mini" type="button" @click="startNewProfile">新建</button>
      </div>
    </div>

    <div class="codex-profiles-layout">
      <aside class="codex-profiles-list" aria-label="模型配置列表">
        <button
          v-for="profile in profilesStore.profiles"
          :key="profile.id"
          type="button"
          class="codex-profile-row"
          :class="{
            'is-selected': selectedProfileId === profile.id,
            'is-active': profilesStore.activeProfileId === profile.id,
          }"
          @click="selectProfile(profile.id)"
        >
          <span class="codex-profile-name">{{ profile.name }}</span>
          <span class="codex-profile-meta mono">{{ profile.modelProviderId }} · {{ profile.model }}</span>
        </button>
        <div v-if="profilesStore.profiles.length === 0" class="codex-profile-empty dim">
          暂无模型配置。
        </div>
      </aside>

      <form class="codex-profile-form" @submit.prevent="saveProfile">
        <div class="global-config-section">
          <div class="codex-form-title-row">
            <div>
              <div class="codex-form-title">{{ selectedProfileId ? "编辑配置" : "新建配置" }}</div>
              <div class="codex-form-subtitle mono" v-tooltip="profilesStore.path">{{ profilesStore.path || "userData" }}</div>
            </div>
            <span class="status-chip mono" :class="activeBadgeClass">{{ activeBadgeText }}</span>
          </div>

          <label class="global-row">
            <span class="context-label">名称</span>
            <input v-model="form.name" class="context-input" type="text" autocomplete="off" placeholder="OpenAI / Moonshot / Local" />
          </label>

          <label class="global-row">
            <span class="context-label">Profile ID</span>
            <input v-model="form.id" class="context-input mono" type="text" autocomplete="off" placeholder="custom" />
          </label>

          <label class="global-row">
            <span class="context-label">Provider ID</span>
            <input
              v-model="form.modelProviderId"
              class="context-input mono"
              type="text"
              autocomplete="off"
              placeholder="custom"
            />
          </label>

          <label class="global-row">
            <span class="context-label">Model</span>
            <input v-model="form.model" class="context-input mono" type="text" autocomplete="off" placeholder="gpt-5.4" />
          </label>

          <label class="global-row">
            <span class="context-label">Base URL</span>
            <input
              v-model="form.baseUrl"
              class="context-input mono"
              type="url"
              autocomplete="off"
              placeholder="https://api.openai.com/v1"
            />
          </label>

          <label class="global-row">
            <span class="context-label">API Key</span>
            <input
              v-model="form.apiKey"
              class="context-input mono"
              type="password"
              autocomplete="off"
              placeholder="sk-..."
            />
          </label>

          <label class="global-row">
            <span class="context-label">Reasoning</span>
            <select v-model="form.modelReasoningEffort" class="context-input mono">
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="xhigh">xhigh</option>
            </select>
          </label>

          <label class="global-row">
            <span class="context-label">Context</span>
            <input
              v-model="form.modelContextWindow"
              class="context-input mono"
              type="number"
              min="1"
              step="1"
              placeholder="留空不覆盖"
            />
          </label>

          <label class="global-row">
            <span class="context-label">Compact</span>
            <input
              v-model="form.modelAutoCompactTokenLimit"
              class="context-input mono"
              type="number"
              min="1"
              step="1"
              placeholder="留空不覆盖"
            />
          </label>

          <div v-if="errorText" class="global-field-error">{{ errorText }}</div>

          <div class="codex-form-actions">
            <button class="btn-mini" type="submit" :disabled="mutationPending">保存</button>
            <button class="btn-mini" type="button" :disabled="mutationPending || !canApply" @click="saveAndApply">
              保存并应用
            </button>
            <button class="btn-mini danger" type="button" :disabled="mutationPending || !selectedProfileId" @click="deleteProfile">
              删除
            </button>
          </div>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { getRuntimeOrchestrator } from "../../../domain/runtimeOrchestrator";
import { useCodexProfilesStore } from "../../../stores/codexProfiles.store";
import {
  DEFAULT_CODEX_PROFILE_MODEL,
  DEFAULT_CODEX_PROFILE_REASONING_EFFORT,
  normalizeCodexProfileId,
  normalizeCodexProviderId,
  type CodexProviderProfile,
  type CodexProviderProfileInput,
} from "../../../../shared/codexProfiles";

type ProfileForm = {
  id: string;
  name: string;
  modelProviderId: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  modelReasoningEffort: "low" | "medium" | "high" | "xhigh";
  modelContextWindow: string;
  modelAutoCompactTokenLimit: string;
};

const runtime = getRuntimeOrchestrator();
const profilesStore = useCodexProfilesStore();
const selectedProfileId = ref("");
const errorText = ref("");
const localSaving = ref(false);

const form = reactive<ProfileForm>({
  id: "",
  name: "",
  modelProviderId: "custom",
  model: DEFAULT_CODEX_PROFILE_MODEL,
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  modelReasoningEffort: DEFAULT_CODEX_PROFILE_REASONING_EFFORT,
  modelContextWindow: "",
  modelAutoCompactTokenLimit: "",
});

const mutationPending = computed(
  () => profilesStore.saving || localSaving.value || Boolean(profilesStore.applyingProfileId)
);
const canApply = computed(() => Boolean(normalizedTargetProfileId.value && form.baseUrl.trim() && form.model.trim()));
const activeBadgeText = computed(() => {
  if (!selectedProfileId.value) return "未保存";
  return profilesStore.activeProfileId === selectedProfileId.value ? "当前启用" : "未启用";
});
const activeBadgeClass = computed(() => (profilesStore.activeProfileId === selectedProfileId.value ? "ok" : "warn"));
const normalizedTargetProfileId = computed(() => {
  return normalizeCodexProfileId(form.id) || normalizeCodexProviderId(form.modelProviderId || form.name);
});

function toNullableNumber(value: string): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function fillForm(profile: CodexProviderProfile) {
  form.id = profile.id;
  form.name = profile.name;
  form.modelProviderId = profile.modelProviderId;
  form.model = profile.model;
  form.baseUrl = profile.baseUrl;
  form.apiKey = profile.apiKey;
  form.modelReasoningEffort = profile.modelReasoningEffort;
  form.modelContextWindow = profile.modelContextWindow == null ? "" : String(profile.modelContextWindow);
  form.modelAutoCompactTokenLimit =
    profile.modelAutoCompactTokenLimit == null ? "" : String(profile.modelAutoCompactTokenLimit);
}

function startNewProfile() {
  selectedProfileId.value = "";
  errorText.value = "";
  form.id = "";
  form.name = "";
  form.modelProviderId = "custom";
  form.model = DEFAULT_CODEX_PROFILE_MODEL;
  form.baseUrl = "https://api.openai.com/v1";
  form.apiKey = "";
  form.modelReasoningEffort = DEFAULT_CODEX_PROFILE_REASONING_EFFORT;
  form.modelContextWindow = "";
  form.modelAutoCompactTokenLimit = "";
}

function selectProfile(id: string) {
  const profile = profilesStore.profiles.find((item) => item.id === id);
  if (!profile) return;
  selectedProfileId.value = profile.id;
  errorText.value = "";
  fillForm(profile);
}

function buildInput(): CodexProviderProfileInput {
  const id = normalizedTargetProfileId.value;
  return {
    id,
    name: form.name,
    modelProviderId: form.modelProviderId,
    model: form.model,
    baseUrl: form.baseUrl,
    apiKey: form.apiKey,
    modelReasoningEffort: form.modelReasoningEffort,
    modelContextWindow: toNullableNumber(form.modelContextWindow),
    modelAutoCompactTokenLimit: toNullableNumber(form.modelAutoCompactTokenLimit),
  };
}

async function saveProfile(): Promise<string> {
  errorText.value = "";
  const input = buildInput();
  if (!String(input.baseUrl ?? "").trim()) throw new Error("Base URL 不能为空。");
  if (!String(input.model ?? "").trim()) throw new Error("Model 不能为空。");
  localSaving.value = true;
  try {
    await profilesStore.upsert(input);
    const id = String(input.id ?? "").trim();
    selectedProfileId.value = id;
    return id;
  } catch (error: any) {
    errorText.value = String(error?.message ?? error ?? "保存失败");
    throw error;
  } finally {
    localSaving.value = false;
  }
}

async function saveAndApply() {
  try {
    const id = await saveProfile();
    if (!id) return;
    await runtime.applyCodexProfile(id);
  } catch (error: any) {
    errorText.value = String(error?.message ?? error ?? "应用失败");
  }
}

async function deleteProfile() {
  const id = String(selectedProfileId.value ?? "").trim();
  if (!id) return;
  if (!window.confirm(`删除模型配置「${form.name || id}」？`)) return;
  errorText.value = "";
  localSaving.value = true;
  try {
    await profilesStore.deleteProfile(id);
    startNewProfile();
  } catch (error: any) {
    errorText.value = String(error?.message ?? error ?? "删除失败");
  } finally {
    localSaving.value = false;
  }
}

async function refresh() {
  await profilesStore.refresh();
  const activeId = String(profilesStore.activeProfileId ?? "").trim();
  const first = activeId || profilesStore.profiles[0]?.id || "";
  if (first) selectProfile(first);
}

onMounted(() => {
  void refresh();
});
</script>
