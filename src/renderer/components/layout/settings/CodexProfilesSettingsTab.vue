<template>
  <section class="codex-providers-page" aria-label="Codex 模型供应商配置">
    <div v-if="profilesStore.errorText || errorText" class="global-field-error">
      {{ profilesStore.errorText || errorText }}
    </div>

    <Transition name="codex-provider-page-fade" mode="out-in">
      <div v-if="!editorOpen" key="list" class="codex-providers-list-page">
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
                <button
                  class="btn-icon"
                  type="button"
                  title="复制"
                  :disabled="mutationPending"
                  @click="duplicateProfile(profile)"
                >
                  <Copy aria-hidden="true" />
                </button>
                <button
                  class="btn-icon"
                  type="button"
                  title="测试连接"
                  :disabled="mutationPending"
                  @click="testProfile(profile)"
                >
                  <FlaskConical aria-hidden="true" />
                </button>
                <button class="btn-icon" type="button" title="状态" @click="showProfileStats(profile)">
                  <BarChart3 aria-hidden="true" />
                </button>
                <button
                  class="btn-icon danger"
                  type="button"
                  title="删除"
                  :disabled="mutationPending"
                  @click="deleteProfile(profile)"
                >
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
            </div>
          </section>

          <div class="codex-providers-floating-actions" aria-label="供应商操作">
            <button
              class="codex-provider-float-btn"
              type="button"
              :disabled="profilesStore.loadState === 'loading'"
              @click="refresh"
            >
              <RefreshCw aria-hidden="true" />
              <span>刷新</span>
            </button>
            <button
              class="codex-provider-float-btn codex-provider-float-btn--primary"
              type="button"
              title="新建供应商"
              aria-label="新建供应商"
              @click="startNewProfile"
            >
              <Plus aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div v-else key="editor" class="codex-provider-editor-page">
        <section class="codex-provider-editor" aria-label="编辑供应商">
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
              <span class="context-label">供应商名称</span>
              <input v-model="form.name" class="context-input" type="text" autocomplete="off" placeholder="xcode" />
            </label>

            <label class="global-row">
              <span class="context-label">模型名称</span>
              <div class="codex-model-picker">
                <input
                  v-model="form.model"
                  class="context-input mono"
                  type="text"
                  autocomplete="off"
                  list="codex-provider-model-options"
                  placeholder="gpt-5.4"
                />
                <button
                  class="btn-mini codex-model-fetch-btn"
                  type="button"
                  :disabled="!canFetchProviderModels"
                  @click="fetchProviderModels"
                >
                  {{ providerModelsLoading ? "获取中" : "获取模型" }}
                </button>
              </div>
            </label>

            <datalist id="codex-provider-model-options">
              <option v-for="modelId in providerModelOptions" :key="modelId" :value="modelId"></option>
            </datalist>

            <div v-if="providerModelOptions.length || providerModelsStatusText" class="codex-model-select-row">
              <span class="context-label"></span>
              <div class="codex-model-select-stack">
                <select
                  v-if="providerModelOptions.length"
                  class="context-input mono codex-model-select"
                  :value="form.model"
                  @change="onProviderModelSelect"
                >
                  <option value="" disabled>选择获取到的模型</option>
                  <option v-if="form.model && !providerModelOptions.includes(form.model)" :value="form.model">
                    {{ form.model }}（当前）
                  </option>
                  <option v-for="modelId in providerModelOptions" :key="modelId" :value="modelId">
                    {{ modelId }}
                  </option>
                </select>
                <div v-if="providerModelsStatusText" class="codex-model-status">
                  {{ providerModelsStatusText }}
                </div>
              </div>
            </div>

            <label class="global-row">
              <span class="context-label">Base URL</span>
              <input
                v-model="form.baseUrl"
                class="context-input mono"
                type="url"
                autocomplete="off"
                placeholder="https://example.com/v1"
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

            <section class="codex-file-editor-block">
              <div class="codex-file-editor-head">
                <div>
                  <div class="codex-file-editor-title">config.toml <span>(TOML)</span> *</div>
                  <div class="codex-file-editor-path mono">{{ resolveConfigFilePath(form.configFilePath) }}</div>
                </div>
              </div>
              <textarea
                v-model="form.configFileContent"
                class="codex-file-editor-textarea app-scrollbar mono"
                spellcheck="false"
                @input="markFileEditorsDirty"
              ></textarea>
            </section>

            <section class="codex-file-editor-block">
              <div class="codex-file-editor-head">
                <div>
                  <div class="codex-file-editor-title">auth.json <span>(JSON)</span> *</div>
                  <div class="codex-file-editor-path mono">{{ resolveAuthFilePath(form.authFilePath) }}</div>
                </div>
              </div>
              <textarea
                v-model="form.authFileContent"
                class="codex-file-editor-textarea app-scrollbar mono"
                spellcheck="false"
                @input="markFileEditorsDirty"
              ></textarea>
            </section>

            <div class="codex-editor-actions">
              <button class="btn-mini" type="button" :disabled="mutationPending" @click="closeEditor">取消</button>
              <button class="btn-mini" type="submit" :disabled="mutationPending">保存</button>
              <button class="btn-mini" type="button" :disabled="mutationPending || !canApplyForm" @click="saveAndApply">
                保存并启用
              </button>
            </div>
          </form>
        </section>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
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
import { showCenterToast } from "../../../ui/centerToast";
import { showToast } from "../../../ui/toast";
import {
  DEFAULT_CODEX_AUTH_FILE_PATH,
  DEFAULT_CODEX_CONFIG_FILE_PATH,
  DEFAULT_CODEX_PROFILE_MODEL,
  normalizeCodexProfileId,
  normalizeCodexProviderId,
  type CodexProviderProfile,
  type CodexProviderProfileInput,
} from "../../../../shared/codexProfiles";

type ProfileForm = {
  name: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  authFilePath: string;
  configFilePath: string;
  authFileContent: string;
  configFileContent: string;
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
const defaultAuthFilePath = ref(DEFAULT_CODEX_AUTH_FILE_PATH);
const defaultConfigFilePath = ref(DEFAULT_CODEX_CONFIG_FILE_PATH);
const fileEditorsDirty = ref(false);
const providerModelOptions = ref<string[]>([]);
const providerModelsLoading = ref(false);
const providerModelsStatusText = ref("");

const form = reactive<ProfileForm>({
  name: "",
  model: DEFAULT_CODEX_PROFILE_MODEL,
  baseUrl: "",
  apiKey: "",
  authFilePath: "",
  configFilePath: "",
  authFileContent: "",
  configFileContent: "",
  order: 0,
});

const orderedProfiles = computed(() =>
  [...profilesStore.profiles].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
);
const mutationPending = computed(
  () => profilesStore.saving || localSaving.value || Boolean(profilesStore.applyingProfileId)
);
const canApplyForm = computed(() =>
  Boolean(
    form.name.trim() &&
    form.baseUrl.trim() &&
    form.model.trim() &&
    form.apiKey.trim() &&
    form.authFileContent.trim() &&
    form.configFileContent.trim()
  )
);
const canFetchProviderModels = computed(
  () => Boolean(form.baseUrl.trim() && form.apiKey.trim()) && !providerModelsLoading.value && !mutationPending.value
);

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

function siblingConfigPath(authPath: string): string {
  const text = String(authPath ?? "").trim();
  if (!text) return DEFAULT_CODEX_CONFIG_FILE_PATH;
  if (/auth\.json$/i.test(text)) return text.replace(/auth\.json$/i, "config.toml");
  const separatorIndex = Math.max(text.lastIndexOf("/"), text.lastIndexOf("\\"));
  if (separatorIndex < 0) return "config.toml";
  return `${text.slice(0, separatorIndex + 1)}config.toml`;
}

function resolveAuthFilePath(value: string): string {
  return String(value ?? "").trim() || defaultAuthFilePath.value || DEFAULT_CODEX_AUTH_FILE_PATH;
}

function resolveConfigFilePath(value: string): string {
  return String(value ?? "").trim() || defaultConfigFilePath.value || DEFAULT_CODEX_CONFIG_FILE_PATH;
}

function escapeTomlString(value: string): string {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function currentModelProviderId(): string {
  const existing = selectedProfileId.value
    ? profilesStore.profiles.find((item) => item.id === selectedProfileId.value)
    : null;
  if (existing?.modelProviderId) return existing.modelProviderId;
  const id = normalizeCodexProfileId(form.name || form.model || "provider") || "provider";
  return normalizeCodexProviderId(id);
}

function buildAuthJsonContent(): string {
  return `${JSON.stringify({ OPENAI_API_KEY: form.apiKey.trim() }, null, 2)}\n`;
}

function buildConfigTomlContent(): string {
  const providerId = currentModelProviderId();
  const name = form.name.trim() || providerId;
  const model = form.model.trim() || DEFAULT_CODEX_PROFILE_MODEL;
  const baseUrl = form.baseUrl.trim();
  return [
    `model_provider = "${escapeTomlString(providerId)}"`,
    `model = "${escapeTomlString(model)}"`,
    "",
    `[model_providers.${providerId}]`,
    `name = "${escapeTomlString(name)}"`,
    `base_url = "${escapeTomlString(baseUrl)}"`,
    'wire_api = "responses"',
    "requires_openai_auth = true",
    "",
  ].join("\n");
}

function refreshGeneratedFileEditors() {
  form.authFileContent = buildAuthJsonContent();
  form.configFileContent = buildConfigTomlContent();
}

function markFileEditorsDirty() {
  fileEditorsDirty.value = true;
}

function resetProviderModels() {
  providerModelOptions.value = [];
  providerModelsStatusText.value = "";
  providerModelsLoading.value = false;
}

function fillForm(profile: CodexProviderProfile) {
  fileEditorsDirty.value = false;
  resetProviderModels();
  form.name = profile.name;
  form.model = profile.model;
  form.baseUrl = profile.baseUrl;
  form.apiKey = profile.apiKey;
  form.authFilePath = resolveAuthFilePath(profile.authFilePath);
  form.configFilePath = resolveConfigFilePath(profile.configFilePath);
  form.authFileContent = profile.authFileContent || buildAuthJsonContent();
  form.configFileContent = profile.configFileContent || buildConfigTomlContent();
  form.order = profile.order;
  fileEditorsDirty.value = Boolean(profile.authFileContent || profile.configFileContent);
}

function resetForm() {
  fileEditorsDirty.value = false;
  resetProviderModels();
  const nextOrder = orderedProfiles.value.length;
  form.name = "";
  form.model = DEFAULT_CODEX_PROFILE_MODEL;
  form.baseUrl = "";
  form.apiKey = "";
  form.authFilePath = defaultAuthFilePath.value;
  form.configFilePath = defaultConfigFilePath.value;
  refreshGeneratedFileEditors();
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
  const existing = selectedProfileId.value
    ? profilesStore.profiles.find((item) => item.id === selectedProfileId.value)
    : null;
  const id = existing?.id || uniqueProfileId(form.name || form.model || "provider");
  const modelProviderId = existing?.modelProviderId || normalizeCodexProviderId(id);
  return {
    id,
    name: form.name,
    modelProviderId,
    model: form.model,
    baseUrl: form.baseUrl,
    apiKey: form.apiKey,
    authFilePath: resolveAuthFilePath(form.authFilePath),
    configFilePath: resolveConfigFilePath(form.configFilePath),
    authFileContent: form.authFileContent,
    configFileContent: form.configFileContent,
    order: form.order,
  };
}

async function saveProfile(options?: { showSuccessToast?: boolean }): Promise<string> {
  const showSuccessToast = options?.showSuccessToast !== false;
  errorText.value = "";
  localSaving.value = true;
  try {
    const input = buildInput();
    if (!String(input.name ?? "").trim()) throw new Error("供应商名称不能为空。");
    if (!String(input.baseUrl ?? "").trim()) throw new Error("Base URL 不能为空。");
    if (!String(input.model ?? "").trim()) throw new Error("模型名称不能为空。");
    if (!String(input.apiKey ?? "").trim()) throw new Error("API Key 不能为空。");
    if (!String(input.configFileContent ?? "").trim()) throw new Error("config.toml 不能为空。");
    if (!String(input.authFileContent ?? "").trim()) throw new Error("auth.json 不能为空。");
    try {
      JSON.parse(String(input.authFileContent ?? ""));
    } catch {
      throw new Error("auth.json 不是有效 JSON。");
    }
    await profilesStore.upsert(input);
    const id = String(input.id ?? "").trim();
    if (selectedProfileId.value && selectedProfileId.value !== id) {
      await profilesStore.deleteProfile(selectedProfileId.value);
    }
    selectedProfileId.value = id;
    editorOpen.value = false;
    if (showSuccessToast) {
      showCenterToast({ kind: "success", title: "保存成功", message: `${input.name} 配置已更新。` });
    }
    return id;
  } catch (error: any) {
    errorText.value = String(error?.message ?? error ?? "保存失败");
    showCenterToast({ kind: "error", title: "保存失败", message: errorText.value });
    throw error;
  } finally {
    localSaving.value = false;
  }
}

async function saveAndApply() {
  try {
    const id = await saveProfile({ showSuccessToast: false });
    if (id) await applyProfile(id);
  } catch (error: any) {
    errorText.value = String(error?.message ?? error ?? "应用失败");
  }
}

function formatProviderLatency(elapsedMs: number | null | undefined): string {
  const n = Number(elapsedMs);
  if (!Number.isFinite(n) || n < 0) return "";
  return `${Math.round(n)}ms`;
}

async function fetchProviderModels() {
  if (!form.baseUrl.trim() || !form.apiKey.trim() || providerModelsLoading.value) return;
  providerModelsLoading.value = true;
  providerModelsStatusText.value = "正在获取模型...";
  try {
    const result = await codexDesktop.app.testCodexProvider({
      baseUrl: form.baseUrl,
      apiKey: form.apiKey,
      timeoutMs: 15_000,
    });
    if (!result.ok) {
      providerModelOptions.value = [];
      providerModelsStatusText.value = result.message || "获取模型失败。";
      showCenterToast({ kind: "error", title: "获取模型失败", message: providerModelsStatusText.value });
      return;
    }

    providerModelOptions.value = result.models;
    const elapsed = formatProviderLatency(result.elapsedMs);
    const suffix = elapsed ? `，响应时间 ${elapsed}` : "";
    providerModelsStatusText.value =
      result.models.length > 0
        ? `已获取 ${result.models.length} 个模型${suffix}。`
        : `连接成功，但未读取到模型${suffix}。`;
    if (result.models.length > 0 && !form.model.trim()) {
      form.model = result.models[0];
    }
  } catch (error: any) {
    providerModelOptions.value = [];
    providerModelsStatusText.value = String(error?.message ?? error ?? "获取模型失败");
    showCenterToast({ kind: "error", title: "获取模型失败", message: providerModelsStatusText.value });
  } finally {
    providerModelsLoading.value = false;
  }
}

function onProviderModelSelect(event: Event) {
  const target = event.target as HTMLSelectElement | null;
  const next = String(target?.value ?? "").trim();
  if (next) form.model = next;
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
    authFilePath: profile.authFilePath,
    configFilePath: profile.configFilePath,
    authFileContent: profile.authFileContent,
    configFileContent: profile.configFileContent,
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
      lastTestMessage: result.ok
        ? `连接成功${result.elapsedMs == null ? "" : `，响应时间 ${formatProviderLatency(result.elapsedMs)}`}`
        : result.message,
    });
    const elapsed = formatProviderLatency(result.elapsedMs);
    showToast({
      kind: result.ok ? "success" : "error",
      title: result.ok ? "连接成功" : "连接失败",
      message: result.ok ? (elapsed ? `响应时间 ${elapsed}` : "连接成功。") : result.message,
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

async function loadDefaultCodexPaths() {
  const auth = await codexDesktop.app.readCodexAuthApiKey().catch(() => null);
  const authPath = String(auth?.path ?? "").trim();
  defaultAuthFilePath.value = authPath || DEFAULT_CODEX_AUTH_FILE_PATH;
  defaultConfigFilePath.value = siblingConfigPath(authPath) || DEFAULT_CODEX_CONFIG_FILE_PATH;
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
    authFilePath: defaultAuthFilePath.value,
    configFilePath: defaultConfigFilePath.value,
    authFileContent: `${JSON.stringify({ OPENAI_API_KEY: auth?.apiKey ?? "" }, null, 2)}\n`,
    configFileContent: [
      `model_provider = "${escapeTomlString(normalizeCodexProviderId(providerId))}"`,
      `model = "${escapeTomlString(model)}"`,
      "",
      `[model_providers.${normalizeCodexProviderId(providerId)}]`,
      `name = "${escapeTomlString(String(provider?.name ?? providerId).trim() || providerId)}"`,
      `base_url = "${escapeTomlString(baseUrl)}"`,
      'wire_api = "responses"',
      "requires_openai_auth = true",
      "",
    ].join("\n"),
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
  void loadDefaultCodexPaths().finally(() => refresh());
});

watch(
  () => [form.name, form.model, form.baseUrl, form.apiKey],
  () => {
    if (!editorOpen.value || fileEditorsDirty.value) return;
    refreshGeneratedFileEditors();
  }
);

watch(
  () => [form.baseUrl, form.apiKey],
  () => {
    if (!editorOpen.value || providerModelsLoading.value) return;
    providerModelOptions.value = [];
    providerModelsStatusText.value = "";
  }
);
</script>
