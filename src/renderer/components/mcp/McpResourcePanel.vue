<template>
  <div class="grid gap-3">
    <div class="grid gap-2">
      <div class="grid gap-1.5">
        <div class="context-label dim">服务器（Server）</div>
        <SelectDropdown
          class="context-input mono w-full"
          :modelValue="selectedServerId"
          :options="serverOptions"
          :disabled="serverOptions.length === 0"
          :minPopoverWidth="220"
          @update:modelValue="onServerChange"
        />
      </div>

      <div v-if="serverStatusText" class="dim text-[12px] leading-[1.35]">{{ serverStatusText }}</div>

      <div
        class="inline-flex w-full items-center gap-1 rounded-full border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] p-1"
      >
        <button
          type="button"
          class="btn-mini flex-1"
          :class="{ 'bg-[var(--bg-accent-soft)]': activeTab === 'resources' }"
          @click="mcpResourceStore.setActiveTab('resources')"
        >
          资源 {{ selectedServer?.resources.length ?? 0 }}
        </button>
        <button
          type="button"
          class="btn-mini flex-1"
          :class="{ 'bg-[var(--bg-accent-soft)]': activeTab === 'templates' }"
          @click="mcpResourceStore.setActiveTab('templates')"
        >
          模板 {{ selectedServer?.resourceTemplates.length ?? 0 }}
        </button>
      </div>

      <div
        v-if="!selectedServer"
        class="rounded-[10px] border border-dashed border-[var(--ui-well-border)] px-3 py-2 text-[12px] leading-[1.35] text-[color:var(--text-muted)]"
      >
        当前没有可用的 MCP 服务器。
      </div>
    </div>

    <template v-if="selectedServer">
      <div v-if="activeTab === 'resources'" class="grid gap-2">
        <div class="text-[12px] font-medium text-[color:var(--text-muted)]">可读资源</div>
        <div
          v-if="selectedServer.resources.length === 0"
          class="rounded-[10px] border border-dashed border-[var(--ui-well-border)] px-3 py-2 text-[12px] leading-[1.35] text-[color:var(--text-muted)]"
        >
          这个服务器当前没有暴露可直接读取的资源。
        </div>
        <div v-else class="grid max-h-[190px] gap-1 overflow-y-auto pr-1 app-scrollbar">
          <button
            v-for="resource in selectedServer.resources"
            :key="resource.uri"
            type="button"
            class="grid gap-1 rounded-[10px] border px-2.5 py-2 text-left transition-colors"
            :class="resourceCardClass(resource.uri === selectedResourceUri)"
            @click="onResourceClick(resource.uri)"
          >
            <div class="truncate text-[12px] font-medium">{{ resourceDisplayTitle(resource) }}</div>
          </button>
        </div>
      </div>

      <div v-else class="grid gap-2">
        <div class="text-[12px] font-medium text-[color:var(--text-muted)]">资源模板</div>
        <div
          v-if="selectedServer.resourceTemplates.length === 0"
          class="rounded-[10px] border border-dashed border-[var(--ui-well-border)] px-3 py-2 text-[12px] leading-[1.35] text-[color:var(--text-muted)]"
        >
          这个服务器当前没有暴露资源模板。
        </div>
        <div v-else class="grid max-h-[190px] gap-1 overflow-y-auto pr-1 app-scrollbar">
          <button
            v-for="template in selectedServer.resourceTemplates"
            :key="template.uriTemplate"
            type="button"
            class="grid gap-1 rounded-[10px] border px-2.5 py-2 text-left transition-colors"
            :class="resourceCardClass(template.uriTemplate === selectedTemplateKey)"
            @click="onTemplateClick(template.uriTemplate)"
          >
            <div class="truncate text-[12px] font-medium">{{ templateDisplayTitle(template) }}</div>
          </button>
        </div>
      </div>

      <div class="grid gap-2 rounded-[12px] border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] p-3">
        <template v-if="activeTab === 'resources' && selectedResource">
          <div class="grid gap-1">
            <div class="text-[12px] font-medium">{{ resourceDisplayTitle(selectedResource) }}</div>
          </div>
        </template>

        <template v-else-if="activeTab === 'templates' && selectedTemplate">
          <div class="grid gap-1">
            <div class="text-[12px] font-medium">{{ templateDisplayTitle(selectedTemplate) }}</div>
          </div>

          <div v-if="selectedTemplateAnalysis.variables.length > 0" class="grid gap-2">
            <div class="text-[12px] font-medium text-[color:var(--text-muted)]">配置参数</div>
            <div class="grid gap-2">
              <div v-for="name in selectedTemplateAnalysis.variables" :key="name" class="grid gap-1">
                <div class="context-label dim">{{ name }}</div>
                <input
                  class="context-input mono"
                  type="text"
                  :value="selectedTemplateDraft.values[name] ?? ''"
                  :placeholder="`填写 ${name}`"
                  @input="onTemplateFieldInput(name, $event)"
                />
              </div>
            </div>
          </div>

          <div class="grid gap-1">
            <div class="context-label dim">展开预览</div>
            <div
              class="rounded-[10px] border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] px-2.5 py-2 mono text-[11px] break-all"
            >
              {{ templatePreviewUri || "请先填写模板变量或手动输入 URI" }}
            </div>
            <div
              v-if="!selectedTemplateAnalysis.supported"
              class="text-[11px] leading-[1.35] text-[color:var(--text-muted)]"
            >
              这个模板包含复杂 URI Template 语法，第一版不自动展开，建议直接填写最终 URI。
            </div>
          </div>

          <div class="grid gap-1">
            <div class="context-label dim">手动 URI</div>
            <input
              class="context-input mono"
              type="text"
              :value="selectedTemplateDraft.manualUri"
              :placeholder="templatePreviewUri || selectedTemplate.uriTemplate"
              @input="onTemplateManualUriInput"
            />
          </div>
        </template>

        <template v-else>
          <div class="text-[12px] leading-[1.4] text-[color:var(--text-muted)]">
            {{ activeTab === "resources" ? "选择一个资源后即可读取内容。" : "选择一个模板后即可填写变量并读取内容。" }}
          </div>
        </template>

        <div
          v-if="threadHintText"
          class="rounded-[10px] border border-dashed border-[var(--ui-well-border)] px-3 py-2 text-[11px] leading-[1.35] text-[color:var(--text-muted)]"
        >
          {{ threadHintText }}
        </div>

        <div
          v-if="mcpResourceStore.loadState === 'error' && mcpResourceStore.errorText"
          class="rounded-[10px] border border-[var(--border-danger)] bg-[var(--bg-danger-soft)] px-3 py-2 text-[11px] leading-[1.35] text-[var(--fg-danger)]"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="min-w-0 flex-1">{{ mcpResourceStore.errorText }}</span>
            <button type="button" class="btn-mini" :disabled="!canReadSelection || isReading" @click="onRetryRead">
              重试
            </button>
          </div>
        </div>

        <template v-if="summaryResourceLabel">
          <div class="grid gap-2 rounded-[10px] border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] p-3">
            <div class="grid gap-1">
              <div class="text-[12px] font-medium text-[color:var(--text-muted)]">资源名</div>
              <div class="text-[12px] font-medium">{{ summaryResourceLabel }}</div>
            </div>
            <div class="grid gap-1">
              <div class="text-[12px] font-medium text-[color:var(--text-muted)]">工具</div>
              <div v-if="summaryToolNames.length === 0" class="mono dim text-[11px]">无工具</div>
              <div v-else class="flex flex-wrap gap-1.5">
                <span
                  v-for="toolName in summaryToolNames"
                  :key="toolName"
                  class="inline-flex items-center rounded-[6px] border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] px-2 py-1 mono text-[11px]"
                >
                  {{ toolName }}
                </span>
              </div>
            </div>
            <div class="grid gap-1">
              <div class="text-[12px] font-medium text-[color:var(--text-muted)]">配置参数</div>
              <div v-if="summaryParameterEntries.length === 0" class="mono dim text-[11px]">无配置参数</div>
              <div v-else class="grid gap-1">
                <div
                  v-for="entry in summaryParameterEntries"
                  :key="`${entry.key}:${entry.value}`"
                  class="rounded-[6px] border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] px-2.5 py-2"
                >
                  <div class="mono dim whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[11px]">
                    {{ entry.key }}
                  </div>
                  <div class="mono whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[11px]">
                    {{ entry.value || "未填写" }}
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="isReading"
              class="mono dim inline-flex items-center gap-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[11px]"
            >
              <span class="running-indicator is-muted" aria-hidden="true"></span>
              <span>读取中…</span>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import SelectDropdown from "../ui/SelectDropdown.vue";
import type {
  McpResourceParameterEntry,
  McpResourceEntry as Resource,
  McpResourceTemplateEntry as ResourceTemplate,
} from "../../domain/types";
import { getRuntimeOrchestrator } from "../../domain/runtimeOrchestrator";
import { useMcpStore } from "../../stores/mcp.store";
import { useMcpResourceStore } from "../../stores/mcpResource.store";
import { useRuntimeStore } from "../../stores/runtime.store";

type TemplateAnalysis = {
  variables: string[];
  supported: boolean;
};

const SIMPLE_TEMPLATE_EXPR_RE = /\{([^{}]+)\}/g;
const TEMPLATE_AUTOREAD_DEBOUNCE_MS = 350;
const runtime = getRuntimeOrchestrator();
const runtimeStore = useRuntimeStore();
const mcpStore = useMcpStore();
const mcpResourceStore = useMcpResourceStore();

function resourceCardClass(active: boolean) {
  return active
    ? "border-[var(--border-accent)] bg-[var(--bg-accent-soft)]"
    : "border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] hover:border-[var(--ui-well-border-hover)] hover:bg-[var(--ui-well-bg-strong)]";
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function toReadTargetKey(threadIdValue: unknown, serverIdValue: unknown, uriValue: unknown): string {
  const threadId = normalizeText(threadIdValue);
  const serverId = normalizeText(serverIdValue);
  const uri = normalizeText(uriValue);
  return threadId && serverId && uri ? `${threadId}::${serverId}::${uri}` : "";
}

function resourceDisplayTitle(resource: Resource): string {
  return normalizeText(resource.title) || normalizeText(resource.name) || normalizeText(resource.uri) || "未命名资源";
}

function templateDisplayTitle(template: ResourceTemplate): string {
  return (
    normalizeText(template.title) || normalizeText(template.name) || normalizeText(template.uriTemplate) || "未命名模板"
  );
}

function buildTemplateParameterEntries(
  variableNames: string[],
  values: Record<string, string>,
  manualUriValue: string,
  resolvedUriValue: string
): McpResourceParameterEntry[] {
  const entries: McpResourceParameterEntry[] = variableNames.map((name) => ({
    key: name,
    value: normalizeText(values[name]),
  }));
  const manualUri = normalizeText(manualUriValue);
  const resolvedUri = normalizeText(resolvedUriValue);
  if (manualUri) entries.push({ key: "manualUri", value: manualUri });
  if (resolvedUri && resolvedUri !== manualUri) entries.push({ key: "resolvedUri", value: resolvedUri });
  return entries;
}

function analyzeTemplate(templateValue: unknown): TemplateAnalysis {
  const template = String(templateValue ?? "");
  const variables: string[] = [];
  let supported = true;
  let match: RegExpExecArray | null = null;
  SIMPLE_TEMPLATE_EXPR_RE.lastIndex = 0;
  while ((match = SIMPLE_TEMPLATE_EXPR_RE.exec(template)) !== null) {
    const expression = String(match[1] ?? "").trim();
    if (!expression) {
      supported = false;
      continue;
    }
    const hasComplexSyntax =
      /^[+#./;?&]/.test(expression) || expression.includes(",") || expression.includes("*") || expression.includes(":");
    if (hasComplexSyntax) supported = false;
    const candidateParts = expression
      .replace(/^[+#./;?&]/, "")
      .split(",")
      .map((item) => item.replace(/[:*].*$/, "").trim())
      .filter(Boolean);
    for (const part of candidateParts) {
      if (!/^[A-Za-z0-9_.-]+$/.test(part)) {
        supported = false;
        continue;
      }
      if (!variables.includes(part)) variables.push(part);
    }
  }
  return { variables, supported };
}

function buildTemplatePreviewUri(templateValue: unknown, values: Record<string, string>): string {
  const template = String(templateValue ?? "");
  const analysis = analyzeTemplate(template);
  if (!analysis.supported) return template;
  SIMPLE_TEMPLATE_EXPR_RE.lastIndex = 0;
  return template.replace(SIMPLE_TEMPLATE_EXPR_RE, (_, expr: string) => {
    const key = String(expr ?? "").trim();
    const value = normalizeText(values[key]);
    return value ? encodeURIComponent(value) : `{${key}}`;
  });
}

const serverOptions = computed(() => {
  return mcpStore.servers.map((server) => ({
    value: server.id,
    label: server.id,
  }));
});

const selectedServerId = computed(() => mcpResourceStore.selectedServerId);
const activeTab = computed(() => mcpResourceStore.activeTab);
const selectedResourceUri = computed(() => mcpResourceStore.selectedResourceUri);
const selectedTemplateKey = computed(() => mcpResourceStore.selectedTemplateKey);
const currentResult = computed(() => mcpResourceStore.currentResult);
const isReading = computed(() => mcpResourceStore.loadState === "loading");
const currentThreadId = computed(() => normalizeText(runtimeStore.currentThreadId));

const selectedServer = computed(() => {
  return mcpStore.servers.find((server) => server.id === selectedServerId.value) ?? null;
});

const selectedResource = computed(() => {
  if (!selectedServer.value || !selectedResourceUri.value) return null;
  return selectedServer.value.resources.find((resource) => resource.uri === selectedResourceUri.value) ?? null;
});

const selectedTemplate = computed(() => {
  if (!selectedServer.value || !selectedTemplateKey.value) return null;
  return (
    selectedServer.value.resourceTemplates.find((template) => template.uriTemplate === selectedTemplateKey.value) ??
    null
  );
});

const selectedTemplateAnalysis = computed(() => analyzeTemplate(selectedTemplate.value?.uriTemplate ?? ""));
const selectedTemplateDraft = computed(() => mcpResourceStore.getTemplateDraft(selectedTemplateKey.value));
const templatePreviewUri = computed(() => {
  if (!selectedTemplate.value) return "";
  return buildTemplatePreviewUri(selectedTemplate.value.uriTemplate, selectedTemplateDraft.value.values);
});
const resolvedTemplateUri = computed(() => {
  const manual = normalizeText(selectedTemplateDraft.value.manualUri);
  if (manual) return manual;
  return normalizeText(templatePreviewUri.value);
});

const activeSelectionUri = computed(() => {
  if (activeTab.value === "resources") return selectedResourceUri.value;
  return resolvedTemplateUri.value;
});

const currentSelectionReadKey = computed(() => {
  return toReadTargetKey(currentThreadId.value, selectedServer.value?.id ?? "", activeSelectionUri.value);
});

const hasMatchingResult = computed(() => {
  const result = currentResult.value;
  if (!result || !selectedServer.value || !currentThreadId.value) return false;
  return (
    result.threadId === currentThreadId.value &&
    result.serverId === selectedServer.value.id &&
    result.uri === activeSelectionUri.value
  );
});

const fallbackResourceLabel = computed(() => {
  if (activeTab.value === "templates") {
    return selectedTemplate.value
      ? templateDisplayTitle(selectedTemplate.value)
      : normalizeText(activeSelectionUri.value);
  }
  return selectedResource.value
    ? resourceDisplayTitle(selectedResource.value)
    : normalizeText(activeSelectionUri.value);
});

const fallbackToolNames = computed(() => {
  return (selectedServer.value?.tools ?? [])
    .map((tool) => normalizeText(tool.title) || normalizeText(tool.name))
    .filter(Boolean);
});

const fallbackParameterEntries = computed(() => {
  if (activeTab.value !== "templates") return [] as McpResourceParameterEntry[];
  return buildTemplateParameterEntries(
    selectedTemplateAnalysis.value.variables,
    selectedTemplateDraft.value.values,
    selectedTemplateDraft.value.manualUri,
    resolvedTemplateUri.value
  );
});

const summaryResourceLabel = computed(() => {
  if (hasMatchingResult.value && currentResult.value?.resourceLabel) return currentResult.value.resourceLabel;
  return fallbackResourceLabel.value;
});

const summaryToolNames = computed(() => {
  if (hasMatchingResult.value && currentResult.value) return currentResult.value.toolNames ?? [];
  return fallbackToolNames.value;
});

const summaryParameterEntries = computed(() => {
  if (hasMatchingResult.value && currentResult.value) return currentResult.value.parameterEntries ?? [];
  return fallbackParameterEntries.value;
});

const serverStatusText = computed(() => {
  const server = selectedServer.value;
  if (!server) return "";
  const parts = [
    server.enabled ? "已启用" : "未启用",
    server.state === "connected"
      ? "已连接"
      : server.state === "error"
        ? "异常"
        : server.state === "disabled"
          ? "已禁用"
          : "待确认",
    typeof server.authenticated === "boolean" ? (server.authenticated ? "已认证" : "未认证") : "",
    `资源 ${server.resources.length}`,
    `模板 ${server.resourceTemplates.length}`,
  ].filter(Boolean);
  return parts.join(" · ");
});

const threadHintText = computed(() => {
  if (currentThreadId.value) return "";
  return "读取 MCP 资源需要当前线程上下文；请先进入一个线程，再执行读取。";
});

const canReadSelection = computed(() => {
  if (!selectedServer.value || !currentThreadId.value) return false;
  return Boolean(activeSelectionUri.value);
});

let templateAutoReadTimer: ReturnType<typeof window.setTimeout> | null = null;
let latestReadSeq = 0;
let inflightReadTargetKey = "";

function clearTemplateAutoReadTimer() {
  if (templateAutoReadTimer == null) return;
  window.clearTimeout(templateAutoReadTimer);
  templateAutoReadTimer = null;
}

function clearSelectionResult() {
  clearTemplateAutoReadTimer();
  mcpResourceStore.clearResult();
}

function ensureValidServerSelection() {
  if (mcpStore.servers.length === 0) {
    mcpResourceStore.resetState();
    return;
  }
  if (!selectedServer.value) {
    mcpResourceStore.setSelectedServer(mcpStore.servers[0]?.id ?? "");
  }
}

function ensureValidTabSelection() {
  const server = selectedServer.value;
  if (!server) return;
  if (activeTab.value === "resources") {
    const hasSelected = Boolean(server.resources.find((resource) => resource.uri === selectedResourceUri.value));
    if (hasSelected) return;
    mcpResourceStore.selectResource(server.id, server.resources[0]?.uri ?? "");
    return;
  }
  const hasSelected = Boolean(
    server.resourceTemplates.find((template) => template.uriTemplate === selectedTemplateKey.value)
  );
  if (hasSelected) return;
  mcpResourceStore.selectTemplate(server.id, server.resourceTemplates[0]?.uriTemplate ?? "");
}

watch(
  () =>
    mcpStore.servers
      .map((server) => `${server.id}:${server.resources.length}:${server.resourceTemplates.length}`)
      .join("|"),
  () => {
    ensureValidServerSelection();
    ensureValidTabSelection();
  },
  { immediate: true }
);

watch(
  () => activeTab.value,
  () => {
    ensureValidTabSelection();
  },
  { immediate: true }
);

function onServerChange(next: string) {
  mcpResourceStore.setSelectedServer(next);
  ensureValidTabSelection();
}

async function readUri(uriValue: string, force = false) {
  const uri = normalizeText(uriValue);
  const server = selectedServer.value;
  const threadId = currentThreadId.value;
  const sourceTab = activeTab.value;
  const templateKey = sourceTab === "templates" ? selectedTemplateKey.value : "";
  const requestKey = toReadTargetKey(threadId, server?.id ?? "", uri);
  if (!server || !uri) return;
  if (!threadId) {
    mcpResourceStore.clearResult();
    return;
  }
  if (!requestKey) {
    mcpResourceStore.clearResult();
    return;
  }
  if (!force && mcpResourceStore.hydrateFromCache(threadId, server.id, uri)) return;
  if (!force && inflightReadTargetKey === requestKey) return;
  const requestSeq = ++latestReadSeq;
  inflightReadTargetKey = requestKey;
  mcpResourceStore.setLoadState("loading");
  try {
    const result = await runtime.readMcpResource({
      threadId,
      serverKey: server.id,
      uri,
      sourceTab,
      templateKey,
    });
    if (requestSeq !== latestReadSeq || currentSelectionReadKey.value !== requestKey) return;
    mcpResourceStore.setCurrentResult({
      threadId,
      serverId: server.id,
      uri,
      contents: Array.isArray(result.contents) ? [...result.contents] : [],
      fetchedAt: Date.now(),
      resourceLabel: result.resourceLabel,
      toolNames: Array.isArray(result.toolNames) ? [...result.toolNames] : [],
      parameterEntries: Array.isArray(result.parameterEntries)
        ? result.parameterEntries.map((entry) => ({ ...entry }))
        : [],
    });
    mcpResourceStore.setLoadState("ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "读取失败");
    if (requestSeq !== latestReadSeq || currentSelectionReadKey.value !== requestKey) return;
    mcpResourceStore.setCurrentResult(null, { cache: false });
    mcpResourceStore.setLoadState("error", message);
  } finally {
    if (inflightReadTargetKey === requestKey) inflightReadTargetKey = "";
  }
}

function scheduleAutoRead(uriValue: string, opts?: { debounceMs?: number; force?: boolean }) {
  const uri = normalizeText(uriValue);
  if (!selectedServer.value || !currentThreadId.value || !uri) {
    clearSelectionResult();
    return;
  }
  const debounceMs = Math.max(0, Math.round(Number(opts?.debounceMs ?? 0)));
  const trigger = () => {
    templateAutoReadTimer = null;
    void readUri(uri, Boolean(opts?.force));
  };
  if (debounceMs > 0) {
    clearTemplateAutoReadTimer();
    templateAutoReadTimer = window.setTimeout(trigger, debounceMs);
    return;
  }
  clearTemplateAutoReadTimer();
  trigger();
}

function onResourceClick(uriValue: string) {
  if (!selectedServer.value) return;
  mcpResourceStore.selectResource(selectedServer.value.id, uriValue);
}

function onTemplateClick(templateKeyValue: string) {
  if (!selectedServer.value) return;
  mcpResourceStore.selectTemplate(selectedServer.value.id, templateKeyValue);
}

function onRetryRead() {
  clearTemplateAutoReadTimer();
  if (activeTab.value === "templates") {
    if (!resolvedTemplateUri.value) return;
    void readUri(resolvedTemplateUri.value, true);
    return;
  }
  if (!selectedResourceUri.value) return;
  void readUri(selectedResourceUri.value, true);
}

function onTemplateFieldInput(name: string, event: Event) {
  const target = event.target as HTMLInputElement | null;
  mcpResourceStore.setTemplateField(selectedTemplateKey.value, name, target?.value ?? "");
}

function onTemplateManualUriInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  mcpResourceStore.setTemplateManualUri(selectedTemplateKey.value, target?.value ?? "");
}

watch(
  () => [currentThreadId.value, selectedServerId.value, activeTab.value, selectedResourceUri.value] as const,
  () => {
    if (activeTab.value !== "resources") return;
    if (!selectedResourceUri.value) {
      clearSelectionResult();
      return;
    }
    scheduleAutoRead(selectedResourceUri.value);
  },
  { immediate: true }
);

watch(
  () =>
    [
      currentThreadId.value,
      selectedServerId.value,
      activeTab.value,
      selectedTemplateKey.value,
      resolvedTemplateUri.value,
    ] as const,
  () => {
    if (activeTab.value !== "templates") {
      clearTemplateAutoReadTimer();
      return;
    }
    if (!selectedTemplateKey.value || !resolvedTemplateUri.value) {
      clearSelectionResult();
      return;
    }
    scheduleAutoRead(resolvedTemplateUri.value, { debounceMs: TEMPLATE_AUTOREAD_DEBOUNCE_MS });
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  clearTemplateAutoReadTimer();
});
</script>
