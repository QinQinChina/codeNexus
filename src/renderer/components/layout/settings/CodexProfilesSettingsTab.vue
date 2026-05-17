<template>
  <section class="codex-providers-page" aria-label="Codex 模型供应商配置">
    <header class="codex-providers-toolbar">
      <div class="codex-providers-title-block">
        <h2>模型供应商</h2>
        <p>配置保存在应用本地，点击启用时写入 Codex CLI 的 config.toml 与 auth.json。</p>
      </div>
      <div class="codex-providers-toolbar-actions">
        <span class="codex-provider-cli-state mono" :class="{ 'is-active': Boolean(activeProfile) }">
          {{ cliStateText }}
        </span>
        <button class="btn-mini" type="button" :disabled="profilesStore.loadState === 'loading'" @click="refresh">
          <RefreshCw aria-hidden="true" />
          刷新
        </button>
        <button class="codex-provider-add-btn" type="button" @click="startNewProfile">
          <Plus aria-hidden="true" />
        </button>
      </div>
    </header>

    <div v-if="profilesStore.errorText || errorText" class="global-field-error">
      {{ profilesStore.errorText || errorText }}
    </div>

    <div class="codex-providers-shell">
      <section class="codex-provider-list" aria-label="供应商列表">
        <article
          v-for="profile in orderedProfiles"
          :key="profile.id"
          class="codex-provider-card"
          :class="{
            'is-active': profilesStore.activeProfileId === profile.id,
            'is-dragging': draggingProfileId === profile.id,
          }"
          draggable="true"
          @dragstart="onDragStart(profile.id)"
          @dragover.prevent
          @drop.prevent="onDrop(profile.id)"
          @dragend="onDragEnd"
        >
          <button class="codex-provider-grip" type="button" aria-label="拖拽排序">
            <GripVertical aria-hidden="true" />
          </button>

          <div class="codex-provider-avatar mono" aria-hidden="true">
            {{ profileInitial(profile) }}
          </div>

          <button class="codex-provider-main" type="button" @click="openEditor(profile)">
            <span class="codex-provider-name">{{ profile.name }}</span>
            <span class="codex-provider-url mono">{{ profile.baseUrl }}</span>
            <span class="codex-provider-meta mono">
              {{ profile.modelProviderId }} / {{ profile.model }}
              <span v-if="profile.lastTestStatus" :class="['codex-provider-test-dot', `is-${profile.lastTestStatus}`]">
                {{ profile.lastTestStatus === "ok" ? "test ok" : "test error" }}
              </span>
            </span>
          </button>

          <div class="codex-provider-actions">
            <button
              class="codex-provider-enable"
              type="button"
              :disabled="!runtimeStore.serverId || mutationPending"
              @click="applyProfile(profile.id)"
            >
              <Play aria-hidden="true" />
              启用
            </button>
            <button class="btn-icon" type="button" title="编辑" @click="openEditor(profile)">
              <SquarePen aria-hidden="true" />
            </button>
            <button class="btn-icon" type="button" title="复制" :disabled="mutationPending" @click="duplicateProfile(profile)">
              <Copy aria-hidden="true" />
            </button>
            <button class="btn-icon" type="button" title="测试连接" :disabled="mutationPending" @click="testProfile(profile)">
              <FlaskConical aria-hidden="true" />
            </button>
            <button class="btn-icon" type="button" title="状态" @click="showProfileStats(profile)">
              <BarChart3 aria-hidden="true" />
            </button>
            <button class="btn-icon danger" type="button" title="删除" :disabled="mutationPending" @click="deleteProfile(profile)">
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        </article>

        <div v-if="orderedProfiles.length === 0" class="codex-provider-empty">
          <Bot aria-hidden="true" />
          <div>
            <strong>暂无供应商</strong>
            <span>新建一条配置，或连接 Codex 服务后从当前 CLI 配置自动导入。</span>
          </div>
          <button class="btn-mini" type="button" @click="startNewProfile">新建供应商</button>
        </div>
      </section>

      <aside v-if="editorOpen" class="codex-provider-editor" aria-label="编辑供应商">
        <div class="codex-editor-head">
          <div>
            <div class="codex-editor-title">{{ selectedProfileId ? "编辑供应商" : "新建供应商" }}</div>
            <div class="codex-editor-subtitle mono">{{ profilesStore.path || "codex-profiles.json" }}</div>
          </div>
          <button class="btn-icon" type="button" @click="closeEditor">
            <X aria-hidden="true" />
          </button>
        </div>

        <form class="codex-editor-form" @submit.prevent="saveProfile">
          <label class="global-row">
            <span class="context-label">名称</span>
            <input v-model="form.name" class="context-input" type="text" autocomplete="off" placeholder="xcode" />
          </label>

          <label class="global-row">
            <span class="context-label">Profile ID</span>
            <input v-model="form.id" class="context-input mono" type="text" autocomplete="off" placeholder="xcode" />
          </label>

          <label class="global-row">
            <span class="context-label">Provider ID</span>
            <input v-model="form.modelProviderId" class="context-input mono" type="text" autocomplete="off" placeholder="xcode" />
          </label>

          <label class="global-row">
            <span class="context-label">Base URL</span>
            <input v-model="form.baseUrl" class="context-input mono" type="url" autocomplete="off" placeholder="https://example.com/v1" />
          </label>

          <label class="global-row">
            <span class="context-label">API Key</span>
            <input v-model="form.apiKey" class="context-input mono" type="password" autocomplete="off" placeholder="sk-..." />
          </label>

          <label class="global-row">
            <span class="context-label">Model ID</span>
            <input v-model="form.model" class="context-input mono" type="text" autocomplete="off" placeholder="gpt-5.4" />
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
            <input v-model="form.modelContextWindow" class="context-input mono" type="number" min="1" step="1" placeholder="留空不覆盖" />
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

          <div class="codex-editor-actions">
            <button class="btn-mini" type="button" :disabled="mutationPending" @click="closeEditor">取消</button>
            <button class="btn-mini" type="submit" :disabled="mutationPending">保存</button>
            <button class="btn-mini" type="button" :disabled="mutationPending || !canApplyForm" @click="saveAndApply">
              保存并启用
            </button>
          </div>
        </form>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  BarChart3,
  Bot,
  Copy,
  FlaskConical,
  GripVertical,
  Play,
  Plus,
  RefreshCw,
  SquarePen,
  Trash2,
  X,
} from "lucide-vue-next";
import { codexDesktop } from "../../../api/codexDesktopClient";
import { getRuntimeOrchestrator } from "../../../domain/runtimeOrchestrator";
import { useCodexProfilesStore } from "../../../stores/codexProfiles.store";
import { useRuntimeStore } from "../../../stores/runtime.store";
import { showToast } from "../../../ui/toast";
import {
  DEFAULT_CODEX_PROFILE_MODEL,
  DEFAULT_CODEX_PROFILE_REASONING_EFFORT,
  normalizeCodexProfileId,
  normalizeCodexProviderId,
  type CodexProviderProfile,
  type CodexProviderProfileInput,
} from "../../../../shared/codexProfiles";
import type { ReasoningEffort } from "../../../../generated/codex-app-server/ReasoningEffort";

type ProfileForm = {
  id: string;
  name: string;
  modelProviderId: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  modelReasoningEffort: ReasoningEffort;
  modelContextWindow: string;
  modelAutoCompactTokenLimit: string;
  order: number;
};

const runtime = getRuntimeOrchestrator();
const runtimeStore = useRuntimeStore();
const profilesStore = useCodexProfilesStore();
const selectedProfileId = ref("");
const errorText = ref("");
const localSaving = ref(false);
const editorOpen = ref(false);
const draggingProfileId = ref("");

const form = reactive<ProfileForm>({
  id: "",
  name: "",
  modelProviderId: "custom",
  model: DEFAULT_CODEX_PROFILE_MODEL,
  baseUrl: "",
  apiKey: "",
  modelReasoningEffort: DEFAULT_CODEX_PROFILE_REASONING_EFFORT,
  modelContextWindow: "",
  modelAutoCompactTokenLimit: "",
  order: 0,
});

const activeProfile = computed(() => profilesStore.activeProfile);
const orderedProfiles = computed(() => [...profilesStore.profiles].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)));
const mutationPending = computed(() => profilesStore.saving || localSaving.value || Boolean(profilesStore.applyingProfileId));
const canApplyForm = computed(() => Boolean(form.baseUrl.trim() && form.model.trim() && form.apiKey.trim()));
const cliStateText = computed(() => {
  if (profilesStore.loadState === "loading") return "loading";
  if (profilesStore.applyingProfileId) return "applying";
  const active = activeProfile.value;
  return active ? `${active.name} / ${active.model}` : "未启用";
});

function toNullableNumber(value: string): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function uniqueProfileId(base: string, currentId = ""): string {
  const normalized = normalizeCodexProfileId(base) || "provider";
  const used = new Set(profilesStore.profiles.filter((item) => item.id !== currentId).map((item) => item.id));
  if (!used.has(normalized)) return normalized;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${normalized}-${index}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${normalized}-${Date.now()}`;
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
  form.modelAutoCompactTokenLimit = profile.modelAutoCompactTokenLimit == null ? "" : String(profile.modelAutoCompactTokenLimit);
  form.order = profile.order;
}

function resetForm() {
  const nextOrder = orderedProfiles.value.length;
  form.id = "";
  form.name = "";
  form.modelProviderId = "custom";
  form.model = DEFAULT_CODEX_PROFILE_MODEL;
  form.baseUrl = "";
  form.apiKey = "";
  form.modelReasoningEffort = DEFAULT_CODEX_PROFILE_REASONING_EFFORT;
  form.modelContextWindow = "";
  form.modelAutoCompactTokenLimit = "";
  form.order = nextOrder;
}

function startNewProfile() {
  selectedProfileId.value = "";
  errorText.value = "";
  resetForm();
  editorOpen.value = true;
}

function openEditor(profile: CodexProviderProfile) {
  selectedProfileId.value = profile.id;
  errorText.value = "";
  fillForm(profile);
  editorOpen.value = true;
}

function closeEditor() {
  editorOpen.value = false;
  selectedProfileId.value = "";
  errorText.value = "";
}

function buildInput(): CodexProviderProfileInput {
  const fallbackId = form.id || form.modelProviderId || form.name;
  const id = uniqueProfileId(fallbackId, selectedProfileId.value);
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
    order: form.order,
  };
}

async function saveProfile(): Promise<string> {
  errorText.value = "";
  const input = buildInput();
  if (!String(input.baseUrl ?? "").trim()) throw new Error("Base URL 不能为空。");
  if (!String(input.model ?? "").trim()) throw new Error("Model ID 不能为空。");
  if (!String(input.apiKey ?? "").trim()) throw new Error("API Key 不能为空。");
  localSaving.value = true;
  try {
    await profilesStore.upsert(input);
    const id = String(input.id ?? "").trim();
    if (selectedProfileId.value && selectedProfileId.value !== id) {
      await profilesStore.deleteProfile(selectedProfileId.value);
    }
    selectedProfileId.value = id;
    editorOpen.value = false;
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
    if (id) await applyProfile(id);
  } catch (error: any) {
    errorText.value = String(error?.message ?? error ?? "应用失败");
  }
}

async function applyProfile(id: string) {
  if (!runtimeStore.serverId) {
    showToast({ kind: "warn", title: "未连接 Codex 服务", message: "连接服务后才能写入 config.toml。" });
    return;
  }
  await runtime.applyCodexProfile(id);
}

async function duplicateProfile(profile: CodexProviderProfile) {
  const id = uniqueProfileId(`${profile.id}-copy`);
  await profilesStore.upsert({
    ...profile,
    id,
    name: `${profile.name} copy`,
    modelProviderId: uniqueProfileId(`${profile.modelProviderId}-copy`),
    order: orderedProfiles.value.length,
    lastTestedAt: null,
    lastTestStatus: null,
    lastTestMessage: null,
  });
  showToast({ kind: "success", title: "已复制供应商", message: `${profile.name} copy` });
}

async function deleteProfile(profile: CodexProviderProfile) {
  if (!window.confirm(`删除供应商「${profile.name}」？`)) return;
  await profilesStore.deleteProfile(profile.id);
  if (selectedProfileId.value === profile.id) closeEditor();
}

async function testProfile(profile: CodexProviderProfile) {
  localSaving.value = true;
  try {
    const result = await codexDesktop.app.testCodexProvider({
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      timeoutMs: 15_000,
    });
    await profilesStore.upsert({
      ...profile,
      lastTestedAt: Date.now(),
      lastTestStatus: result.ok ? "ok" : "error",
      lastTestMessage: result.message,
    });
    showToast({
      kind: result.ok ? "success" : "error",
      title: result.ok ? "连接成功" : "连接失败",
      message: result.message,
    });
  } finally {
    localSaving.value = false;
  }
}

function showProfileStats(profile: CodexProviderProfile) {
  const tested = profile.lastTestedAt ? new Date(profile.lastTestedAt).toLocaleString() : "未测试";
  const status = profile.lastTestStatus ? `${profile.lastTestStatus}: ${profile.lastTestMessage ?? ""}` : "无测试结果";
  window.alert(`供应商：${profile.name}\n模型：${profile.model}\n最近测试：${tested}\n状态：${status}`);
}

function profileInitial(profile: CodexProviderProfile): string {
  return (profile.name || profile.modelProviderId || "?").trim().slice(0, 1).toUpperCase() || "?";
}

function onDragStart(id: string) {
  draggingProfileId.value = id;
}

function onDragEnd() {
  draggingProfileId.value = "";
}

async function onDrop(targetId: string) {
  const sourceId = draggingProfileId.value;
  draggingProfileId.value = "";
  if (!sourceId || sourceId === targetId) return;
  const list = [...orderedProfiles.value];
  const sourceIndex = list.findIndex((item) => item.id === sourceId);
  const targetIndex = list.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [source] = list.splice(sourceIndex, 1);
  list.splice(targetIndex, 0, source);
  localSaving.value = true;
  try {
    for (let index = 0; index < list.length; index += 1) {
      await profilesStore.upsert({ ...list[index], order: index });
    }
  } finally {
    localSaving.value = false;
  }
}

async function readCodexConfig(): Promise<Record<string, unknown> | null> {
  const serverId = String(runtimeStore.serverId ?? "").trim();
  if (!serverId) return null;
  const cwd = String(runtimeStore.workspacePath ?? "").trim();
  const { result } = await codexDesktop.codexServer.rpc({
    serverId,
    method: "config/read",
    params: { includeLayers: true, ...(cwd ? { cwd } : {}) },
  });
  return readRecord((result as any)?.config);
}

async function autoImportCurrentCodexConfig() {
  if (!runtimeStore.serverId) return;
  const config = await readCodexConfig().catch(() => null);
  if (!config) return;
  const providerId = String(config.model_provider ?? "").trim();
  const model = String(config.model ?? "").trim();
  if (!providerId || !model) return;
  const providers = readRecord(config.model_providers);
  const provider = readRecord(providers?.[providerId]);
  const baseUrl = String(provider?.base_url ?? "").trim();
  if (!baseUrl) return;
  const exists = profilesStore.profiles.some((item) => item.modelProviderId === providerId || item.id === providerId);
  if (exists) return;
  const auth = await codexDesktop.app.readCodexAuthApiKey().catch(() => null);
  await profilesStore.upsert({
    id: uniqueProfileId(providerId),
    name: String(provider?.name ?? providerId).trim() || providerId,
    modelProviderId: normalizeCodexProviderId(providerId),
    model,
    baseUrl,
    apiKey: auth?.apiKey ?? "",
    order: orderedProfiles.value.length,
  });
  showToast({ kind: "success", title: "已导入当前 Codex 配置", message: `${providerId} / ${model}` });
}

async function refresh() {
  errorText.value = "";
  await profilesStore.refresh();
  await autoImportCurrentCodexConfig();
}

onMounted(() => {
  void refresh();
});
</script>
