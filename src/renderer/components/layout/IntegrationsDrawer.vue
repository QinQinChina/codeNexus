<template>
  <Teleport to="body" :disabled="isSettings">
    <Transition name="global-config-drawer">
      <div
        v-if="open"
        class="global-config-drawer-overlay"
        :class="{ 'is-settings': isSettings }"
        role="dialog"
        aria-modal="true"
        aria-label="扩展能力"
        @click.self="onOverlayClick"
      >
        <div v-if="!isSettings" class="global-config-drawer-backdrop" @click="close"></div>
        <section class="global-config-drawer-panel" @click.stop>
          <header class="global-config-drawer-head">
            <!--
              三段式头部：左标题 / 中间 Tabs 固定居中 / 右侧状态与关闭。
              解决右侧内容长度变化导致 Tabs “被挤向左”的问题。
            -->
            <div class="integrations-head-grid">
              <div class="integrations-head-left">
                <div class="panel-title">扩展能力</div>
              </div>
              <div class="integrations-head-center">
                <div class="integrations-tabs">
                  <button
                    type="button"
                    class="integrations-tab mono"
                    :class="{ 'is-active': activeTab === 'skills' }"
                    @click="activeTab = 'skills'"
                  >
                    Skills
                  </button>
                  <button
                    type="button"
                    class="integrations-tab mono"
                    :class="{ 'is-active': activeTab === 'mcp' }"
                    @click="activeTab = 'mcp'"
                  >
                    MCP
                  </button>
                </div>
              </div>
              <div class="integrations-head-right">
                <span class="status-chip mono integrations-head-chip" :class="activeChipClass">{{
                  activeChipText
                }}</span>
                <button v-if="!isSettings" ref="closeBtnRef" class="btn-mini" type="button" @click="close">关闭</button>
              </div>
            </div>
          </header>

          <div class="global-config-drawer-body app-scrollbar" :class="{ 'is-settings': isSettings }">
            <div class="panel integrations-panel">
              <div class="integrations-toolbar">
                <div class="integrations-toolbar-hint mono dim">{{ activeHintText }}</div>
                <div class="row integrations-toolbar-actions" style="gap: 6px">
                  <template v-if="activeTab === 'skills'">
                    <button class="btn-mini" type="button" :disabled="!canOpenSkillsManager" @click="openSkillsManager">
                      管理器
                    </button>
                    <button class="btn-mini" type="button" :disabled="!canRefreshSkills" @click="onRefreshSkills">
                      刷新
                    </button>
                  </template>
                  <template v-else>
                    <button class="btn-mini" type="button" :disabled="!canRefreshMcp" @click="runtime.refreshMcp">
                      刷新
                    </button>
                    <button class="btn-mini" type="button" :disabled="!canReloadMcp" @click="runtime.reloadMcpConfig">
                      重载
                    </button>
                  </template>
                </div>
              </div>

              <div v-if="activeTab === 'skills'">
                <SkillsList
                  :items="skillsStore.items"
                  :pendingPath="skillPendingPath"
                  :stateText="skillsStateText"
                  emptyText="暂无可用技能"
                  mode="compact"
                  @toggle-skill="onSkillToggleRequest"
                />
              </div>

              <div v-else>
                <div class="integrations-mcp-tab">
                  <section class="integrations-mcp-resource">
                    <div class="integrations-mcp-section-title">资源查看</div>
                    <McpResourcePanel />
                  </section>

                  <div v-if="mcpStateText" class="mcp-list dim">{{ mcpStateText }}</div>
                  <div v-else class="mcp-list">
                    <DetailDisclosure
                      v-for="server in mcpStore.servers"
                      :key="server.id"
                      class="mcp-details"
                      summaryClass="mcp-summary"
                    >
                      <template #summary="{ open: detailsOpen }">
                        <label class="skill-switch" :title="server.enabled ? '关闭 MCP' : '启用 MCP'">
                          <input
                            class="skill-switch-input"
                            type="checkbox"
                            :checked="server.enabled"
                            :disabled="mcpPendingId === server.id"
                            @click.stop
                            @change="onMcpEnabledChanged(server.id, $event)"
                          />
                          <span class="skill-switch-track" aria-hidden="true">
                            <span class="skill-switch-thumb"></span>
                          </span>
                        </label>
                        <div class="mcp-dot" :class="mcpDotClass(server)"></div>
                        <div class="mcp-title-wrap">
                          <div class="mcp-title">{{ server.id }}</div>
                          <div
                            v-if="mcpSummarySubtext(server)"
                            class="mcp-subtitle mono dim"
                            :title="mcpSummarySubtext(server)"
                          >
                            {{ mcpSummarySubtext(server) }}
                          </div>
                        </div>
                        <div class="chevron" :class="{ open: detailsOpen }" aria-hidden="true">▸</div>
                      </template>
                      <div class="mcp-body">
                        <div class="mcp-meta">
                          <div class="mcp-meta-row">
                            <div class="mcp-meta-key dim">状态</div>
                            <div class="mcp-meta-val mono">{{ mcpStateLabel(server) }}</div>
                          </div>
                          <div class="mcp-meta-row">
                            <div class="mcp-meta-key dim">传输</div>
                            <div class="mcp-meta-val mono">{{ mcpTransportLabel(server) }}</div>
                          </div>
                          <div v-if="mcpArgsLabel(server)" class="mcp-meta-row">
                            <div class="mcp-meta-key dim">参数</div>
                            <div class="mcp-meta-val mono">{{ mcpArgsLabel(server) }}</div>
                          </div>
                          <div v-if="typeof server.authenticated === 'boolean'" class="mcp-meta-row">
                            <div class="mcp-meta-key dim">认证</div>
                            <div class="mcp-meta-val mono">{{ server.authenticated ? "已认证" : "未认证" }}</div>
                          </div>
                        </div>

                        <div
                          v-if="server.message"
                          class="mcp-message mono"
                          :class="{ 'is-error': server.state === 'error' }"
                        >
                          {{ server.message }}
                        </div>
                        <div class="mcp-actions">
                          <button type="button" class="btn-mini" @click.prevent.stop="onOpenMcpResources(server.id)">
                            查看资源
                          </button>
                          <button
                            type="button"
                            class="btn-mini"
                            :disabled="!server.enabled || mcpOauthPendingId === server.id"
                            @click.prevent.stop="onMcpOAuth(server.id)"
                          >
                            OAuth 登录
                          </button>
                        </div>
                      </div>
                    </DetailDisclosure>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import McpResourcePanel from "../mcp/McpResourcePanel.vue";
import DetailDisclosure from "../ui/DetailDisclosure.vue";
import SkillsList from "./SkillsList.vue";
import { getRuntimeOrchestrator } from "../../domain/runtimeOrchestrator";
import { useRuntimeStore } from "../../stores/runtime.store";
import { useAppShellStore } from "../../stores/appShell.store";
import { useSkillsStore } from "../../stores/skills.store";
import { useSkillsUiStore } from "../../stores/skillsUi.store";
import { useMcpStore } from "../../stores/mcp.store";
import { useMcpResourceStore } from "../../stores/mcpResource.store";
import type { McpServerState, SkillState } from "../../domain/types";

const runtime = getRuntimeOrchestrator();
const runtimeStore = useRuntimeStore();
const appShellStore = useAppShellStore();
const skillsStore = useSkillsStore();
const skillsUiStore = useSkillsUiStore();
const mcpStore = useMcpStore();
const mcpResourceStore = useMcpResourceStore();

const props = defineProps<{ mode?: "drawer" | "settings" }>();
const isSettings = computed(() => props.mode === "settings");
const open = computed(() => (isSettings.value ? true : appShellStore.integrationsDrawerOpen));
const activeTab = computed<"skills" | "mcp">({
  get: () => {
    const raw = isSettings.value ? appShellStore.settingsIntegrationsTab : appShellStore.integrationsDrawerTab;
    return raw === "mcp" ? "mcp" : "skills";
  },
  set: (next) => {
    if (isSettings.value) {
      appShellStore.setSettingsIntegrationsTab(next);
      return;
    }
    appShellStore.setIntegrationsDrawerTab(next);
  },
});

const closeBtnRef = ref<HTMLButtonElement | null>(null);

function close() {
  if (isSettings.value) return;
  appShellStore.setIntegrationsDrawerOpen(false);
}

function onOverlayClick() {
  if (isSettings.value) return;
  close();
}

function openSkillsManager() {
  // 页面模式：打开管理器时自动收起抽屉，避免叠层与焦点混乱。
  close();
  skillsUiStore.openManager();
}

const totalSkillsCount = computed(() => skillsStore.items.length);
const enabledSkillsCount = computed(() => skillsStore.items.filter((s) => s.enabled).length);

const totalMcpCount = computed(() => mcpStore.servers.length);
const connectedMcpCount = computed(() => mcpStore.servers.filter((s) => s.enabled && s.state === "connected").length);

const skillsChipClass = computed(() => (enabledSkillsCount.value > 0 ? "ok" : "warn"));
const mcpChipClass = computed(() => (connectedMcpCount.value > 0 ? "ok" : "warn"));

const activeChipClass = computed(() => (activeTab.value === "skills" ? skillsChipClass.value : mcpChipClass.value));
const activeChipText = computed(() => {
  if (activeTab.value === "skills") return `Skills ${enabledSkillsCount.value}/${totalSkillsCount.value}`;
  return `MCP ${connectedMcpCount.value}/${totalMcpCount.value}`;
});

const activeHintText = computed(() => {
  if (activeTab.value === "skills") {
    if (!runtimeStore.serverId) return "未连接服务";
    if (!runtimeStore.workspacePath) return "未选择工作区";
    if (skillsStore.loadState === "loading") return "加载中…";
    if (skillsStore.loadState === "error")
      return skillsStore.errorText ? `加载失败：${skillsStore.errorText}` : "加载失败";
    return "按需启用，保持精简。";
  }
  if (!runtimeStore.serverId) return "未连接服务";
  if (mcpStore.loadState === "loading") return "加载中…";
  if (mcpStore.loadState === "error") return mcpStore.errorText ? `加载失败：${mcpStore.errorText}` : "加载失败";
  return "按需启用，减少依赖。";
});

const skillPendingPath = ref("");
const canRefreshSkills = computed(
  () => Boolean(runtimeStore.serverId) && Boolean(runtimeStore.workspacePath) && skillsStore.loadState !== "loading"
);
const canOpenSkillsManager = computed(
  () => Boolean(runtimeStore.serverId) || Boolean(runtimeStore.workspacePath) || skillsStore.items.length > 0
);
const skillsStateText = computed(() => {
  if (!runtimeStore.serverId) return "未连接服务";
  if (!runtimeStore.workspacePath) return "未选择工作区";
  if (skillsStore.loadState === "loading") return "加载中…";
  if (skillsStore.loadState === "error")
    return skillsStore.errorText ? `加载失败：${skillsStore.errorText}` : "加载失败";
  if (skillsStore.items.length === 0) {
    if (skillsStore.parseErrors.length > 0) return `暂无可用技能（errors=${skillsStore.parseErrors.length}）`;
    return "暂无可用技能";
  }
  return "";
});

const onRefreshSkills = () => {
  void runtime.refreshSkills(true);
};

const onToggleSkill = async (skill: SkillState, enabled: boolean) => {
  const path = String(skill.path ?? "").trim();
  if (!path || !skill.configurable) return;
  if (skillPendingPath.value === path) return;
  skillPendingPath.value = path;
  try {
    await runtime.toggleSkill(path, enabled);
  } finally {
    skillPendingPath.value = "";
  }
};

const onSkillToggleRequest = ({ skill, enabled }: { skill: SkillState; enabled: boolean }) => {
  void onToggleSkill(skill, enabled);
};

const canRefreshMcp = computed(() => Boolean(runtimeStore.serverId) && mcpStore.loadState !== "loading");
const canReloadMcp = computed(() => Boolean(runtimeStore.serverId) && mcpStore.loadState !== "loading");
const mcpStateText = computed(() => {
  if (!runtimeStore.serverId) return "未连接服务";
  if (mcpStore.loadState === "loading") return "加载中…";
  if (mcpStore.loadState === "error") return mcpStore.errorText ? `加载失败：${mcpStore.errorText}` : "加载失败";
  if (mcpStore.servers.length === 0) return "暂无 MCP 配置（config.toml 中未配置 mcp_servers）";
  return "";
});

const mcpPendingId = ref("");
const mcpOauthPendingId = ref("");

const onToggleMcp = async (serverId: string, enabled: boolean) => {
  if (!serverId || mcpPendingId.value === serverId) return;
  mcpPendingId.value = serverId;
  try {
    await runtime.toggleMcpEnabled(serverId, enabled);
  } finally {
    mcpPendingId.value = "";
  }
};

const onMcpEnabledChanged = (serverId: string, event: Event) => {
  const target = event.target as HTMLInputElement | null;
  const enabled = Boolean(target?.checked);
  void onToggleMcp(serverId, enabled);
};

const onMcpOAuth = async (serverId: string) => {
  if (!serverId || mcpOauthPendingId.value === serverId) return;
  mcpOauthPendingId.value = serverId;
  try {
    await runtime.startMcpOAuthLogin(serverId);
  } finally {
    mcpOauthPendingId.value = "";
  }
};

const onOpenMcpResources = (serverId: string) => {
  const id = String(serverId ?? "").trim();
  if (!id) return;
  mcpResourceStore.requestOpen(id, "resources");
  appShellStore.openSettings("integrations", { integrationsTab: "mcp" });
};

const mcpDotClass = (server: McpServerState) => {
  if (!server.enabled || server.state === "disabled") return "";
  if (server.state === "connected") return "state-connected";
  if (server.state === "connecting") return "state-connecting";
  if (server.state === "error") return "state-error";
  return "";
};

const mcpStateLabel = (server: McpServerState) => {
  if (!server.enabled) return "未启用";
  if (server.state === "connected") return "已连接";
  if (server.state === "connecting") return "连接中";
  if (server.state === "error") return "异常";
  if (server.state === "disabled") return "已禁用";
  return server.state ? String(server.state) : "未知";
};

const mcpSummarySubtext = (server: McpServerState) => {
  const transport = mcpTransportLabel(server);
  if (!transport || transport === "未知") return "";
  return transport;
};

const mcpTransportLabel = (server: McpServerState) => {
  if (server.url) return String(server.url);
  if (server.command) return `cmd=${String(server.command)}`;
  return "未知";
};

const mcpArgsLabel = (server: McpServerState) => {
  const args = server.args && server.args.length > 0 ? server.args : null;
  if (!args) return "";
  const raw = JSON.stringify(args);
  if (raw.length <= 180) return raw;
  return raw.slice(0, 90) + " … " + raw.slice(-70);
};

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return;
    if (runtimeStore.serverId) {
      if (activeTab.value === "skills") void runtime.refreshSkills(false);
      else void runtime.refreshMcp();
    }
    void nextTick().then(() => {
      try {
        closeBtnRef.value?.focus();
      } catch {}
    });
  }
);

watch(
  () => activeTab.value,
  (tab) => {
    if (!open.value) return;
    if (tab === "skills") {
      if (runtimeStore.serverId) void runtime.refreshSkills(false);
      return;
    }
    if (runtimeStore.serverId) void runtime.refreshMcp();
  }
);

onMounted(() => {
  if (runtimeStore.serverId) {
    void runtime.refreshMcp();
    void runtime.refreshSkills(false);
  }
});

onBeforeUnmount(() => {
  // No-op: drawer doesn't register window listeners.
});
</script>

<style scoped>
.integrations-head-grid {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
}

.integrations-head-left {
  min-width: 0;
  justify-self: start;
}

.integrations-head-center {
  justify-self: center;
}

.integrations-head-right {
  min-width: 0;
  justify-self: end;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.integrations-head-chip {
  min-width: 104px;
  justify-content: center;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.integrations-tabs {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, var(--surface-1) 72%, transparent);
}

.integrations-tab {
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: color-mix(in srgb, var(--text) 76%, transparent);
  font-size: 12px;
}

.integrations-tab.is-active {
  background: color-mix(in srgb, var(--bg-accent-soft, var(--accent-soft)) 86%, var(--surface-1));
  border-color: color-mix(in srgb, var(--border-accent, var(--accent-soft)) 58%, transparent);
  color: var(--text);
}

.integrations-tab:hover:not(.is-active) {
  background: color-mix(in srgb, var(--surface-1) 56%, transparent);
}

.integrations-panel {
  margin-bottom: 0;
  /* 清爽：抽屉内避免“面板套面板”的二次边框与阴影 */
  --panel-bg: transparent;
  --panel-border: transparent;
  --panel-shadow: none;
  padding: 0;
}

.integrations-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.integrations-toolbar-hint {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.integrations-mcp-tab {
  display: grid;
  gap: 12px;
}

.integrations-mcp-resource {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
  background: color-mix(in srgb, var(--surface-1) 76%, transparent);
}

.integrations-mcp-section-title {
  font-size: 12px;
  font-weight: 600;
  color: color-mix(in srgb, var(--text) 72%, transparent);
}

.mcp-list {
  gap: 8px;
  margin-top: 6px;
}

.mcp-details {
  padding: 10px 10px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-1) 78%, transparent);
}

.mcp-summary {
  gap: 10px;
}

.mcp-dot {
  width: 9px;
  height: 9px;
}

.mcp-title {
  font-weight: 650;
}

.mcp-title-wrap {
  min-width: 0;
  flex: 1 1 auto;
  display: grid;
  gap: 2px;
}

.mcp-subtitle {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  transition: transform 0.15s ease;
}

.chevron.open {
  transform: rotate(90deg);
}

.mcp-details.is-open .mcp-summary .chevron {
  transform: rotate(90deg);
}

.mcp-body {
  gap: 10px;
}

.mcp-meta {
  display: grid;
  gap: 8px;
}

.mcp-meta-row {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 10px;
  align-items: start;
  min-width: 0;
}

.mcp-meta-key {
  font-size: 12px;
  line-height: 1.25;
}

.mcp-meta-val {
  font-size: 12px;
  overflow-wrap: anywhere;
  color: color-mix(in srgb, var(--text) 76%, transparent);
}

.mcp-message {
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: color-mix(in srgb, var(--surface-1) 78%, transparent);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
  color: color-mix(in srgb, var(--text) 76%, transparent);
}

.mcp-message.is-error {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--border));
  background: color-mix(in srgb, var(--bg-danger-soft) 42%, var(--surface-1));
}
</style>
