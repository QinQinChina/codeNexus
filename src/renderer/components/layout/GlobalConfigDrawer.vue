<template>
  <Teleport to="body" :disabled="isSettings">
    <Transition name="global-config-drawer">
      <div
        v-if="open"
        class="global-config-drawer-overlay"
        :class="{ 'is-settings': isSettings }"
        role="dialog"
        aria-modal="true"
        aria-label="全局配置"
        @click.self="onOverlayClick"
      >
        <div v-if="!isSettings" class="global-config-drawer-backdrop" @click="onRequestClose"></div>
        <section class="global-config-drawer-panel" @click.stop>
          <header class="global-config-drawer-head">
            <div class="panel-title">全局配置</div>
            <div class="row global-config-head-actions">
              <div class="global-config-status global-config-status--inline" :class="['is-' + globalConfigStatusKind]">
                <span class="global-config-status-text">{{ globalConfigStatusText }}</span>
                <span
                  v-if="globalConfigRefreshFxNonce > 0"
                  :key="globalConfigRefreshFxNonce"
                  class="global-config-status-refresh-fx"
                  aria-hidden="true"
                >
                  <RotateCw class="global-config-status-refresh-icon" />
                </span>
              </div>
              <button class="btn-mini" type="button" :disabled="!canResetGlobalConfig" @click="onResetGlobalConfig">
                重置
              </button>
              <button class="btn-mini" type="button" :disabled="!canRefreshGlobalConfig" @click="onRefreshGlobalConfig">
                刷新
              </button>
              <button
                v-if="!isSettings"
                ref="closeBtnRef"
                class="btn-mini"
                type="button"
                :disabled="globalConfigActionPending || configStore.saving"
                @click="onRequestClose"
              >
                关闭
              </button>
            </div>
          </header>

          <div class="global-config-drawer-body app-scrollbar" :class="{ 'is-settings': isSettings }">
            <div v-if="configStore.isDirty" class="global-config-topbar">
              <div class="global-config-dirty-badge mono">已修改 {{ globalConfigDirtyCount }} 项</div>
            </div>

            <section class="global-config-guide-entry global-config-local-entry">
              <div class="guide-entry-text global-appearance-copy">
                <div class="guide-entry-title">全局背景外观</div>
                <div class="guide-entry-desc">{{ globalAppearanceDescription }}</div>
              </div>
              <div class="global-appearance-controls">
                <div
                  class="global-appearance-preview"
                  :class="{ 'is-empty': !globalAppearanceStore.currentBackgroundDataUrl }"
                  :style="globalBackgroundPreviewStyle"
                >
                  <span v-if="!globalAppearanceStore.currentBackgroundDataUrl">未设置背景图</span>
                </div>
                <div class="global-appearance-actions">
                  <button
                    class="btn-mini"
                    type="button"
                    :disabled="globalAppearanceStore.backgroundMutationPending"
                    @click="onImportGlobalBackground"
                  >
                    {{ currentGlobalAppearance.backgroundImageRelativePath ? "更换图片" : "选择图片" }}
                  </button>
                  <button
                    class="btn-mini"
                    type="button"
                    :disabled="
                      !currentGlobalAppearance.backgroundImageRelativePath ||
                      globalAppearanceStore.backgroundMutationPending
                    "
                    @click="onClearGlobalBackground"
                  >
                    清除
                  </button>
                </div>
                <label class="global-appearance-fit-row">
                  <span class="global-appearance-fit-label dim">适配模式</span>
                  <SelectDropdown
                    id="sel-global-background-fit-mode"
                    class="context-input mono"
                    :modelValue="currentGlobalAppearance.backgroundFitMode"
                    :options="globalBackgroundFitModeOptions"
                    @update:modelValue="onGlobalBackgroundFitModeChanged"
                  />
                </label>
                <div class="page-bg-opacity-controls">
                  <input
                    class="page-bg-opacity-slider"
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    :value="currentGlobalAppearance.surfaceOpacityPercent"
                    @input="onGlobalSurfaceOpacityInput"
                  />
                  <span class="page-bg-opacity-value mono">{{ currentGlobalAppearance.surfaceOpacityPercent }}%</span>
                  <button
                    class="btn-mini"
                    type="button"
                    :disabled="currentGlobalAppearance.surfaceOpacityPercent === DEFAULT_GLOBAL_SURFACE_OPACITY_PERCENT"
                    @click="resetGlobalSurfaceOpacity"
                  >
                    重置
                  </button>
                </div>
              </div>
            </section>

            <section class="global-config-guide-entry global-config-local-entry">
              <div class="guide-entry-text">
                <div class="guide-entry-title">字体与字号</div>
                <div class="guide-entry-desc">切换全局字体样式与整体字号缩放，立即生效。</div>
              </div>
              <div class="typography-controls">
                <label class="typography-row">
                  <span class="typography-label dim">字体</span>
                  <SelectDropdown
                    id="sel-ui-font-family"
                    class="context-input mono"
                    :modelValue="typographyStore.fontFamilyPreset"
                    :options="uiFontFamilyPresetOptions"
                    @update:modelValue="onUiFontFamilyPresetChanged"
                  />
                </label>
                <label class="typography-row">
                  <span class="typography-label dim">字号</span>
                  <SelectDropdown
                    id="sel-ui-font-size"
                    class="context-input mono"
                    :modelValue="typographyStore.fontSizePreset"
                    :options="uiFontSizePresetOptions"
                    @update:modelValue="onUiFontSizePresetChanged"
                  />
                </label>
              </div>
            </section>

            <section class="global-config-guide-entry global-config-local-entry">
              <div class="guide-entry-text">
                <div class="guide-entry-title">文件树图标</div>
                <div class="guide-entry-desc">选择工作区文件树图标主题，立即生效。</div>
              </div>
              <div class="typography-controls">
                <label class="typography-row">
                  <span class="typography-label dim">主题</span>
                  <SelectDropdown
                    id="sel-workspace-file-icon-theme"
                    class="context-input mono"
                    :modelValue="appShellStore.workspaceFileIconTheme"
                    :options="workspaceFileIconThemeOptions"
                    @update:modelValue="onWorkspaceFileIconThemeChanged"
                  />
                </label>
              </div>
            </section>

            <section class="global-config-guide-entry global-config-local-entry">
              <div class="guide-entry-text">
                <div class="guide-entry-title">AI 最终答复格式</div>
                <div class="guide-entry-desc">仅在执行（agent/default）模式生效；计划（plan）模式保持原有输出。</div>
              </div>
              <div class="typography-controls">
                <label class="typography-row">
                  <span class="typography-label dim">格式</span>
                  <SelectDropdown
                    id="sel-assistant-final-message-format"
                    class="context-input mono"
                    :modelValue="appShellStore.assistantFinalMessageFormat"
                    :options="assistantFinalMessageFormatOptions"
                    @update:modelValue="onAssistantFinalMessageFormatChanged"
                  />
                </label>
              </div>
            </section>

            <section class="global-config-guide-entry global-config-local-entry">
              <div class="guide-entry-text">
                <div class="guide-entry-title">AI 计划输出格式</div>
                <div class="guide-entry-desc">仅影响计划（plan）模式的计划输出（item/plan/delta）。</div>
              </div>
              <div class="typography-controls">
                <label class="typography-row">
                  <span class="typography-label dim">格式</span>
                  <SelectDropdown
                    id="sel-assistant-plan-message-format"
                    class="context-input mono"
                    :modelValue="appShellStore.assistantPlanMessageFormat"
                    :options="assistantPlanMessageFormatOptions"
                    @update:modelValue="onAssistantPlanMessageFormatChanged"
                  />
                </label>
              </div>
            </section>

            <div class="global-config-grid">
              <section class="global-config-section">
                <label class="global-row" :class="{ 'is-dirty': isGlobalConfigFieldDirty('model') }">
                  <span class="context-label dim">模型</span>
                  <div class="global-field-stack">
                    <SelectDropdown
                      id="sel-global-model"
                      class="context-input mono"
                      :modelValue="configStore.draft.model"
                      :disabled="globalControlsDisabled"
                      :options="globalModelOptions"
                      @update:modelValue="onModelChanged"
                    />
                    <div class="global-model-manage-hint">内置预设保留，可在下方追加自定义模型。</div>
                  </div>
                </label>
                <div
                  class="global-row global-row-service-tier"
                  :class="{ 'is-dirty': isGlobalConfigFieldDirty('fastModeEnabled') }"
                >
                  <span class="context-label dim">服务层级</span>
                  <div class="global-field-stack service-tier-field">
                    <div
                      id="service-tier-toggle"
                      class="service-tier-segment"
                      :class="{ 'is-fast': configStore.draft.fastModeEnabled, 'is-disabled': globalControlsDisabled }"
                      role="radiogroup"
                      aria-label="服务层级"
                      :aria-disabled="globalControlsDisabled ? 'true' : 'false'"
                      @keydown.left.prevent="onServiceTierArrowKey(false)"
                      @keydown.right.prevent="onServiceTierArrowKey(true)"
                      @keydown.up.prevent="onServiceTierArrowKey(false)"
                      @keydown.down.prevent="onServiceTierArrowKey(true)"
                    >
                      <span class="service-tier-thumb" aria-hidden="true"></span>
                      <button
                        id="btn-service-tier-flex"
                        type="button"
                        class="service-tier-option mono"
                        role="radio"
                        :aria-checked="!configStore.draft.fastModeEnabled ? 'true' : 'false'"
                        :tabindex="configStore.draft.fastModeEnabled ? -1 : 0"
                        :disabled="globalControlsDisabled"
                        @click="setServiceTier(false)"
                      >
                        标准
                      </button>
                      <button
                        id="btn-service-tier-fast"
                        type="button"
                        class="service-tier-option mono"
                        role="radio"
                        :aria-checked="configStore.draft.fastModeEnabled ? 'true' : 'false'"
                        :tabindex="configStore.draft.fastModeEnabled ? 0 : -1"
                        :disabled="globalControlsDisabled"
                        @click="setServiceTier(true)"
                      >
                        快速
                      </button>
                    </div>
                  </div>
                </div>
                <div class="global-row">
                  <span class="context-label dim">自定义模型</span>
                  <div class="global-field-stack global-model-manager">
                    <div class="global-model-add-row">
                      <SelectDropdown
                        id="sel-global-custom-model-available"
                        v-model="remoteModelPick"
                        class="context-input mono"
                        :disabled="remoteModelSelectDisabled"
                        :options="remoteModelDropdownOptions"
                        :minPopoverWidth="0"
                        aria-label="可用模型"
                      />
                      <button
                        class="btn-mini"
                        type="button"
                        :disabled="!canRefreshRemoteModels"
                        @click="onRefreshRemoteModels"
                      >
                        刷新
                      </button>
                      <button class="btn-mini" type="button" :disabled="!canAddRemoteModel" @click="onAddRemoteModel">
                        添加
                      </button>
                    </div>
                    <div v-if="remoteModelStatusText" class="global-model-manage-hint">{{ remoteModelStatusText }}</div>
                    <div v-if="modelCatalogStore.remoteErrorText" class="global-field-error">
                      加载失败：{{ modelCatalogStore.remoteErrorText }}
                    </div>

                    <div class="global-model-add-row">
                      <SelectDropdown
                        id="sel-global-custom-model-cn-presets"
                        v-model="cnPresetPick"
                        class="context-input mono"
                        :disabled="modelCatalogControlsDisabled"
                        :options="cnPresetDropdownOptions"
                        :minPopoverWidth="0"
                        aria-label="国内模型预设"
                      />
                      <button
                        class="btn-mini"
                        type="button"
                        :disabled="!canAddCnPresetModel"
                        @click="onAddCnPresetModel"
                      >
                        添加
                      </button>
                    </div>
                    <div v-if="cnPresetHintText" class="global-model-manage-hint">{{ cnPresetHintText }}</div>

                    <div class="global-model-add-row">
                      <input
                        id="inp-global-custom-model"
                        class="context-input mono"
                        :value="customModelInput"
                        placeholder="例如 deepseek-chat"
                        :disabled="modelCatalogControlsDisabled"
                        @input="onCustomModelInput"
                        @keydown.enter.prevent="onAddCustomModel"
                      />
                      <button class="btn-mini" type="button" :disabled="!canAddCustomModel" @click="onAddCustomModel">
                        添加
                      </button>
                    </div>
                    <div v-if="customModelHintText" class="global-model-manage-hint">{{ customModelHintText }}</div>
                    <div v-if="modelCatalogStore.errorText" class="global-field-error">
                      保存失败：{{ modelCatalogStore.errorText }}
                    </div>
                    <div v-if="modelCatalogStore.customIds.length > 0" class="global-model-list">
                      <div v-for="id in modelCatalogStore.customIds" :key="id" class="global-model-item">
                        <span class="global-model-item-id mono" :title="id">{{ id }}</span>
                        <button
                          class="btn-mini"
                          type="button"
                          :disabled="modelCatalogControlsDisabled"
                          @click="onRemoveCustomModel(id)"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <div v-else class="global-model-empty">尚未添加自定义模型，当前下拉仅显示内置预设。</div>
                  </div>
                </div>
              </section>

              <section class="global-config-section">
                <div class="global-row">
                  <span class="context-label dim">上下文预设</span>
                  <div class="global-field-stack">
                    <div class="row" style="align-items: center; gap: 8px; flex-wrap: wrap">
                      <button
                        class="btn-mini"
                        type="button"
                        :disabled="globalControlsDisabled"
                        @click="apply400kContextPreset"
                      >
                        400K
                      </button>
                      <span class="dim mono">400000 / 360000</span>
                    </div>
                  </div>
                </div>
                <label class="global-row" :class="{ 'is-dirty': isGlobalConfigFieldDirty('modelContextWindow') }">
                  <span class="context-label dim">窗口上限</span>
                  <div class="global-field-stack">
                    <input
                      class="context-input mono"
                      :class="{ 'is-invalid': Boolean(modelContextWindowError) }"
                      inputmode="numeric"
                      :value="modelContextWindowInputText"
                      placeholder="例如 400000"
                      :disabled="globalControlsDisabled"
                      :aria-invalid="modelContextWindowError ? 'true' : 'false'"
                      @input="onModelContextWindowInput"
                    />
                    <span v-if="modelContextWindowError" class="global-field-error">{{ modelContextWindowError }}</span>
                  </div>
                </label>
                <label
                  class="global-row"
                  :class="{ 'is-dirty': isGlobalConfigFieldDirty('modelAutoCompactTokenLimit') }"
                >
                  <span class="context-label dim">压缩阈值</span>
                  <div class="global-field-stack">
                    <input
                      class="context-input mono"
                      :class="{ 'is-invalid': Boolean(modelAutoCompactTokenLimitError) }"
                      inputmode="numeric"
                      :value="modelAutoCompactTokenLimitInputText"
                      placeholder="例如 360000"
                      :disabled="globalControlsDisabled"
                      :aria-invalid="modelAutoCompactTokenLimitError ? 'true' : 'false'"
                      @input="onModelAutoCompactTokenLimitInput"
                    />
                    <span v-if="modelAutoCompactTokenLimitError" class="global-field-error">{{
                      modelAutoCompactTokenLimitError
                    }}</span>
                  </div>
                </label>
              </section>

              <section class="global-config-section">
                <div
                  v-if="configRequirementsSummaryText"
                  class="global-config-requirements-summary"
                  :class="configRequirementsSummaryClass"
                >
                  {{ configRequirementsSummaryText }}
                </div>
                <label class="global-row" :class="{ 'is-dirty': isGlobalConfigFieldDirty('modelReasoningEffort') }">
                  <span class="context-label dim">推理强度</span>
                  <div class="global-field-stack">
                    <SelectDropdown
                      id="sel-global-reasoning-effort"
                      v-model="configStore.draft.modelReasoningEffort"
                      class="context-input mono"
                      :disabled="globalControlsDisabled"
                      :options="OFFICIAL_REASONING_EFFORT_OPTIONS"
                    />
                  </div>
                </label>
                <label class="global-row" :class="{ 'is-dirty': isGlobalConfigFieldDirty('modelReasoningSummary') }">
                  <span class="context-label dim">思考摘要</span>
                  <div class="global-field-stack">
                    <SelectDropdown
                      id="sel-global-reasoning-summary"
                      v-model="configStore.draft.modelReasoningSummary"
                      class="context-input mono"
                      :disabled="globalControlsDisabled"
                      :options="OFFICIAL_REASONING_SUMMARY_OPTIONS"
                    />
                  </div>
                </label>
                <label class="global-row" :class="{ 'is-dirty': isGlobalConfigFieldDirty('approvalPolicy') }">
                  <span class="context-label dim">审批策略</span>
                  <div class="global-field-stack">
                    <SelectDropdown
                      id="sel-global-approval-policy"
                      v-model="configStore.draft.approvalPolicy"
                      class="context-input mono"
                      :disabled="approvalPolicySelectDisabled"
                      :options="approvalPolicyOptions"
                    />
                    <div v-if="approvalPolicyHintText" class="global-model-manage-hint">
                      {{ approvalPolicyHintText }}
                    </div>
                  </div>
                </label>
                <label class="global-row" :class="{ 'is-dirty': isGlobalConfigFieldDirty('approvalsReviewer') }">
                  <span class="context-label dim">审批复核方</span>
                  <div class="global-field-stack">
                    <SelectDropdown
                      id="sel-global-approvals-reviewer"
                      v-model="configStore.draft.approvalsReviewer"
                      class="context-input mono"
                      :disabled="approvalsReviewerSelectDisabled"
                      :options="approvalsReviewerOptions"
                    />
                    <div v-if="approvalsReviewerHintText" class="global-model-manage-hint">
                      {{ approvalsReviewerHintText }}
                    </div>
                  </div>
                </label>
                <label class="global-row" :class="{ 'is-dirty': isGlobalConfigFieldDirty('sandboxMode') }">
                  <span class="context-label dim">沙箱模式</span>
                  <div class="global-field-stack">
                    <SelectDropdown
                      id="sel-global-sandbox-mode"
                      v-model="configStore.draft.sandboxMode"
                      class="context-input mono"
                      :disabled="sandboxModeSelectDisabled"
                      :options="sandboxModeOptions"
                    />
                    <div v-if="sandboxModeHintText" class="global-model-manage-hint">{{ sandboxModeHintText }}</div>
                  </div>
                </label>

                <div class="global-toggle-list global-advanced-body">
                  <label
                    class="global-toggle-row"
                    :class="{ 'is-dirty': isGlobalConfigFieldDirty('windowsElevatedSandboxEnabled') }"
                  >
                    <div class="global-toggle-copy">
                      <span class="global-toggle-title">提权沙箱</span>
                      <span class="global-toggle-note mono">启用后使用提权沙箱</span>
                    </div>
                    <span class="skill-switch">
                      <input
                        v-model="configStore.draft.windowsElevatedSandboxEnabled"
                        class="skill-switch-input"
                        type="checkbox"
                        :disabled="globalControlsDisabled"
                      />
                      <span class="skill-switch-track" aria-hidden="true"
                        ><span class="skill-switch-thumb"></span
                      ></span>
                    </span>
                  </label>
                  <label
                    class="global-toggle-row"
                    :class="{ 'is-dirty': isGlobalConfigFieldDirty('powershellUtf8Enabled') }"
                  >
                    <div class="global-toggle-copy">
                      <span class="global-toggle-title">终端编码</span>
                      <span class="global-toggle-note mono">启用统一终端编码</span>
                    </div>
                    <span class="skill-switch">
                      <input
                        v-model="configStore.draft.powershellUtf8Enabled"
                        class="skill-switch-input"
                        type="checkbox"
                        :disabled="globalControlsDisabled"
                      />
                      <span class="skill-switch-track" aria-hidden="true"
                        ><span class="skill-switch-thumb"></span
                      ></span>
                    </span>
                  </label>
                  <label
                    class="global-toggle-row"
                    :class="{ 'is-dirty': isGlobalConfigFieldDirty('unifiedExecEnabled') }"
                  >
                    <div class="global-toggle-copy">
                      <span class="global-toggle-title">统一执行</span>
                      <span class="global-toggle-note mono">启用统一执行流程</span>
                    </div>
                    <span class="skill-switch">
                      <input
                        v-model="configStore.draft.unifiedExecEnabled"
                        class="skill-switch-input"
                        type="checkbox"
                        :disabled="globalControlsDisabled"
                      />
                      <span class="skill-switch-track" aria-hidden="true"
                        ><span class="skill-switch-thumb"></span
                      ></span>
                    </span>
                  </label>
                </div>
              </section>
            </div>

            <div class="global-config-actions">
              <div class="global-config-actions-meta">
                <div class="global-config-actions-summary">{{ globalConfigActionsSummary }}</div>
                <div class="global-config-actions-hint">{{ globalConfigActionsHint }}</div>
              </div>
              <div class="global-config-actions-buttons">
                <button class="btn-mini" type="button" :disabled="!canSaveGlobalConfig" @click="onSaveGlobalConfig">
                  保存
                </button>
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
import { RotateCw } from "lucide-vue-next";
import SelectDropdown from "../ui/SelectDropdown.vue";
import { getRuntimeOrchestrator } from "../../domain/runtimeOrchestrator";
import { actionModal, confirmModal } from "../../ui/modal";
import { useRuntimeStore } from "../../stores/runtime.store";
import { useAppShellStore } from "../../stores/appShell.store";
import { useConfigStore } from "../../stores/config.store";
import { useConfigRequirementsStore } from "../../stores/configRequirements.store";
import {
  GLOBAL_BACKGROUND_FIT_MODE_OPTIONS,
  getGlobalBackgroundStyleTokens,
  useGlobalAppearanceStore,
} from "../../stores/globalAppearance.store";
import {
  UI_FONT_FAMILY_PRESET_OPTIONS,
  UI_FONT_SIZE_PRESET_OPTIONS,
  useTypographyStore,
} from "../../stores/typography.store";
import {
  OFFICIAL_APPROVALS_REVIEWER_OPTIONS,
  OFFICIAL_APPROVAL_POLICY_OPTIONS,
  OFFICIAL_REASONING_EFFORT_OPTIONS,
  OFFICIAL_REASONING_SUMMARY_OPTIONS,
  OFFICIAL_SANDBOX_MODE_OPTIONS,
  createDefaultGlobalConfigDraft,
} from "../../domain/serverInterop";
import type { GlobalConfigDraft } from "../../domain/types";
import { useModelCatalogStore } from "../../stores/modelCatalog.store";
import {
  DEFAULT_GLOBAL_SURFACE_OPACITY_PERCENT,
  type AssistantFinalMessageFormat,
  type AssistantPlanMessageFormat,
  type GlobalBackgroundFitMode,
  type UiWorkspaceFileIconTheme,
} from "../../../shared/localSettings";
import { buildModelPickerOptions, normalizeModelId } from "../../../shared/modelCatalog";
import { CN_MODEL_PRESETS } from "../../../shared/modelPresets";

const runtime = getRuntimeOrchestrator();
const runtimeStore = useRuntimeStore();
const appShellStore = useAppShellStore();
const configStore = useConfigStore();
const configRequirementsStore = useConfigRequirementsStore();
const globalAppearanceStore = useGlobalAppearanceStore();
const typographyStore = useTypographyStore();
const modelCatalogStore = useModelCatalogStore();

const props = defineProps<{ mode?: "drawer" | "settings" }>();
const isSettings = computed(() => props.mode === "settings");
const open = computed(() => (isSettings.value ? true : appShellStore.globalConfigDrawerOpen));
const closeBtnRef = ref<HTMLButtonElement | null>(null);
const currentGlobalAppearance = computed(() => globalAppearanceStore.appearance);
const globalBackgroundFitModeOptions = GLOBAL_BACKGROUND_FIT_MODE_OPTIONS;
const uiFontFamilyPresetOptions = UI_FONT_FAMILY_PRESET_OPTIONS;
const uiFontSizePresetOptions = UI_FONT_SIZE_PRESET_OPTIONS;
const workspaceFileIconThemeOptions: Array<{ value: UiWorkspaceFileIconTheme; label: string }> = [
  { value: "lucide", label: "Lucide（内置）" },
  { value: "vscode-icons", label: "VSCode Icons" },
];
const globalAppearanceDescription = computed(() => {
  if (currentGlobalAppearance.value.backgroundImageRelativePath) {
    return "当前应用已设置全局背景图，图片保存在本机应用数据目录。";
  }
  return "为整个应用设置统一背景图，并可调节界面蒙层透明度。";
});

const assistantFinalMessageFormatOptions: Array<{ value: AssistantFinalMessageFormat; label: string }> = [
  { value: "markdown", label: "Markdown（默认）" },
  { value: "structured-json-v1", label: "结构化（JSON 卡片）" },
];
const assistantPlanMessageFormatOptions: Array<{ value: AssistantPlanMessageFormat; label: string }> = [
  { value: "markdown", label: "Markdown（默认）" },
  { value: "plan-card-v1", label: "计划卡片（解释/步骤/原文）" },
];
const globalBackgroundPreviewStyle = computed(() => {
  const tokens = getGlobalBackgroundStyleTokens(currentGlobalAppearance.value.backgroundFitMode);
  return {
    backgroundImage: globalAppearanceStore.currentBackgroundDataUrl
      ? `url(${JSON.stringify(globalAppearanceStore.currentBackgroundDataUrl)})`
      : "none",
    backgroundSize: tokens.size,
    backgroundPosition: tokens.position,
    backgroundRepeat: tokens.repeat,
  } as Record<string, string>;
});

const closeDrawer = () => {
  if (isSettings.value) {
    appShellStore.closeSettings();
    return;
  }
  appShellStore.setGlobalConfigDrawerOpen(false);
};

const onOverlayClick = () => {
  if (isSettings.value) return;
  void onRequestClose();
};

const onAssistantFinalMessageFormatChanged = (value: unknown) => {
  const normalized: AssistantFinalMessageFormat = value === "structured-json-v1" ? "structured-json-v1" : "markdown";
  appShellStore.setAssistantFinalMessageFormat(normalized);
};

const onAssistantPlanMessageFormatChanged = (value: unknown) => {
  const normalized: AssistantPlanMessageFormat = value === "plan-card-v1" ? "plan-card-v1" : "markdown";
  appShellStore.setAssistantPlanMessageFormat(normalized);
};

const GLOBAL_CONFIG_PENDING_ACTION_COPY = {
  close: {
    title: "关闭前保存修改？",
    message: "当前主配置有未保存修改。",
    saveLabel: "保存并关闭",
    discardLabel: "放弃并关闭",
    unsavableMessage: "关闭会丢失当前主配置修改。",
  },
  refresh: {
    title: "刷新前保存修改？",
    message: "刷新会覆盖当前主配置草稿。",
    saveLabel: "保存并刷新",
    discardLabel: "放弃并刷新",
    unsavableMessage: "刷新会覆盖当前主配置草稿。",
  },
} as const;

type GlobalConfigPendingActionKey = keyof typeof GLOBAL_CONFIG_PENDING_ACTION_COPY;

const globalConfigActionPending = ref(false);

const saveGlobalConfigManually = async (options?: { silentSuccessToast?: boolean }): Promise<boolean> => {
  if (!canSaveGlobalConfig.value) return false;
  await runtime.saveGlobalConfig({ source: "manual", silentSuccessToast: options?.silentSuccessToast });
  return !configStore.isDirty && configStore.loadState !== "error";
};

const discardGlobalConfigDraft = () => {
  runtime.resetGlobalConfig();
};

const runWithGlobalConfigDirtyGuard = async (
  actionKey: GlobalConfigPendingActionKey,
  callback: () => void | Promise<void>
) => {
  if (globalConfigActionPending.value || configStore.saving) return;
  if (!configStore.isDirty) {
    await callback();
    return;
  }

  const copy = GLOBAL_CONFIG_PENDING_ACTION_COPY[actionKey];
  globalConfigActionPending.value = true;
  try {
    if (!canSaveGlobalConfig.value) {
      const confirmedDiscard = await confirmModal({
        title: "放弃未保存修改？",
        message: copy.unsavableMessage,
        detail: globalConfigValidationError.value
          ? `当前内容无法保存：${globalConfigValidationError.value}`
          : "当前主配置暂时无法保存，只能放弃修改或继续编辑。",
        confirmText: copy.discardLabel,
        cancelText: "继续编辑",
        danger: true,
      });
      if (!confirmedDiscard) return;
      discardGlobalConfigDraft();
      await callback();
      return;
    }

    const decision = await actionModal({
      title: copy.title,
      message: copy.message,
      detail: "主配置需要手动保存；全局背景外观仍保持即时生效。",
      cancelKey: "cancel",
      buttons: [
        { key: "cancel", label: "继续编辑" },
        { key: "discard", label: copy.discardLabel, kind: "danger" },
        { key: "save", label: copy.saveLabel, autoFocus: true },
      ],
    });

    if (decision === "cancel") return;
    if (decision === "discard") {
      discardGlobalConfigDraft();
      await callback();
      return;
    }

    const saved = await saveGlobalConfigManually();
    if (!saved) return;
    await callback();
  } finally {
    globalConfigActionPending.value = false;
  }
};

const requestClose = async () => {
  await runWithGlobalConfigDirtyGuard("close", () => {
    closeDrawer();
  });
};

const onRequestClose = () => {
  void requestClose();
};

const onGlobalSurfaceOpacityInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  const next = Number.parseInt(String(target?.value ?? ""), 10);
  globalAppearanceStore.setSurfaceOpacityPercent(next);
};

const resetGlobalSurfaceOpacity = () => {
  globalAppearanceStore.setSurfaceOpacityPercent(DEFAULT_GLOBAL_SURFACE_OPACITY_PERCENT);
};

const onUiFontFamilyPresetChanged = (next: string) => {
  typographyStore.setFontFamilyPreset(next);
};

const onUiFontSizePresetChanged = (next: string) => {
  typographyStore.setFontSizePreset(next);
};

const onWorkspaceFileIconThemeChanged = (next: string) => {
  appShellStore.setWorkspaceFileIconTheme(next);
};

const onImportGlobalBackground = async () => {
  await globalAppearanceStore.importBackgroundImage();
};

const onGlobalBackgroundFitModeChanged = (next: string) => {
  globalAppearanceStore.setBackgroundFitMode(next as GlobalBackgroundFitMode);
};

const onClearGlobalBackground = async () => {
  await globalAppearanceStore.clearBackgroundImage();
};

const onWindowKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  if (!open.value) return;
  void requestClose();
};

onMounted(() => {
  window.addEventListener("keydown", onWindowKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onWindowKeydown);
});

watch(open, async (next) => {
  if (!next) return;
  await nextTick();
  closeBtnRef.value?.focus();
  void modelCatalogStore.ensureRemoteModels();
});

const globalConfigRefreshFxNonce = ref(0);
const onRefreshGlobalConfig = () => {
  void runWithGlobalConfigDirtyGuard("refresh", async () => {
    globalConfigRefreshFxNonce.value += 1;
    await runtime.refreshGlobalConfig();
  });
};

const globalControlsDisabled = computed(
  () =>
    globalConfigActionPending.value || !runtimeStore.serverId || configStore.loadState !== "ready" || configStore.saving
);
const canRefreshGlobalConfig = computed(
  () => Boolean(runtimeStore.serverId) && !configStore.saving && !globalConfigActionPending.value
);
const modelCatalogControlsDisabled = computed(() => modelCatalogStore.saving);

type RestrictedSelectState = {
  hasRestrictions: boolean;
  hasUnsupported: boolean;
  values: string[] | null;
};

const APPROVALS_REVIEWER_LABELS: Record<string, string> = {
  user: "user（用户）",
};

const SANDBOX_MODE_LABELS: Record<string, string> = {
  "read-only": "read-only（只读）",
  "workspace-write": "workspace-write（工作区可写）",
  "danger-full-access": "danger-full-access（完全权限）",
};

const buildRestrictedSelectState = (
  allowedValues: readonly unknown[] | null | undefined,
  officialOptions: readonly string[]
): RestrictedSelectState => {
  if (!Array.isArray(allowedValues)) {
    return { hasRestrictions: false, hasUnsupported: false, values: null };
  }

  const values: string[] = [];
  let hasUnsupported = false;
  for (const entry of allowedValues) {
    if (typeof entry !== "string") {
      hasUnsupported = true;
      continue;
    }
    const normalized = officialOptions.find((option) => option === entry);
    if (!normalized) {
      hasUnsupported = true;
      continue;
    }
    if (!values.includes(normalized)) values.push(normalized);
  }

  return { hasRestrictions: true, hasUnsupported, values };
};

const formatRestrictedValues = (values: string[], labels?: Record<string, string>) => {
  return values.map((value) => labels?.[value] ?? value).join(" / ");
};

const buildRestrictedSelectOptions = (
  currentValue: string,
  officialOptions: readonly string[],
  restriction: RestrictedSelectState,
  labels?: Record<string, string>
) => {
  const options: Array<{ value: string; label: string; disabled?: boolean }> = [];
  const effectiveValues = restriction.values ?? [...officialOptions];
  const seen = new Set<string>();
  const labelFor = (value: string) => labels?.[value] ?? value;

  if (currentValue && !effectiveValues.includes(currentValue)) {
    options.push({ value: currentValue, label: `${labelFor(currentValue)}（当前值）`, disabled: true });
    seen.add(currentValue);
  }

  for (const value of effectiveValues) {
    if (seen.has(value)) continue;
    options.push({ value, label: labelFor(value) });
    seen.add(value);
  }

  return options;
};

const buildRestrictedHintText = (restriction: RestrictedSelectState, labels?: Record<string, string>) => {
  if (!restriction.hasRestrictions) return "";
  if (!restriction.values || restriction.values.length === 0) {
    return restriction.hasUnsupported
      ? "当前服务端 requirements 仅返回桌面端暂未映射的限制项。"
      : "当前服务端 requirements 未允许可选项。";
  }
  const allowedText = formatRestrictedValues(restriction.values, labels);
  return restriction.hasUnsupported
    ? `当前服务端仅允许：${allowedText}；其余限制项桌面端暂未映射。`
    : `当前服务端仅允许：${allowedText}`;
};

const approvalPolicyRestriction = computed(() =>
  buildRestrictedSelectState(
    configRequirementsStore.requirements?.allowedApprovalPolicies,
    OFFICIAL_APPROVAL_POLICY_OPTIONS
  )
);
const approvalsReviewerRestriction = computed(() =>
  buildRestrictedSelectState(
    configRequirementsStore.requirements?.allowedApprovalsReviewers,
    OFFICIAL_APPROVALS_REVIEWER_OPTIONS
  )
);
const sandboxModeRestriction = computed(() =>
  buildRestrictedSelectState(configRequirementsStore.requirements?.allowedSandboxModes, OFFICIAL_SANDBOX_MODE_OPTIONS)
);

const approvalPolicyOptions = computed(() =>
  buildRestrictedSelectOptions(
    String(configStore.draft.approvalPolicy ?? ""),
    OFFICIAL_APPROVAL_POLICY_OPTIONS,
    approvalPolicyRestriction.value
  )
);
const approvalsReviewerOptions = computed(() =>
  buildRestrictedSelectOptions(
    String(configStore.draft.approvalsReviewer ?? ""),
    OFFICIAL_APPROVALS_REVIEWER_OPTIONS,
    approvalsReviewerRestriction.value,
    APPROVALS_REVIEWER_LABELS
  )
);
const sandboxModeOptions = computed(() =>
  buildRestrictedSelectOptions(
    String(configStore.draft.sandboxMode ?? ""),
    OFFICIAL_SANDBOX_MODE_OPTIONS,
    sandboxModeRestriction.value,
    SANDBOX_MODE_LABELS
  )
);

const approvalPolicySelectDisabled = computed(
  () =>
    globalControlsDisabled.value ||
    (approvalPolicyRestriction.value.hasRestrictions && (approvalPolicyRestriction.value.values?.length ?? 0) === 0)
);
const approvalsReviewerSelectDisabled = computed(
  () =>
    globalControlsDisabled.value ||
    (approvalsReviewerRestriction.value.hasRestrictions &&
      (approvalsReviewerRestriction.value.values?.length ?? 0) === 0)
);
const sandboxModeSelectDisabled = computed(
  () =>
    globalControlsDisabled.value ||
    (sandboxModeRestriction.value.hasRestrictions && (sandboxModeRestriction.value.values?.length ?? 0) === 0)
);

const configRequirementsSummaryClass = computed(() => {
  if (configRequirementsStore.loadState === "error") return "is-error";
  if (configRequirementsStore.loadState === "loading") return "is-loading";
  return "is-ready";
});

const configRequirementsSummaryText = computed(() => {
  if (!runtimeStore.serverId) return "";
  if (configRequirementsStore.loadState === "loading") return "正在读取服务端 requirements...";
  if (configRequirementsStore.loadState === "error") {
    return configRequirementsStore.statusText || "requirements 读取失败，当前按无约束展示配置选项。";
  }
  if (!configRequirementsStore.requirements) {
    return configRequirementsStore.statusText || "当前服务端未配置 requirements，使用完整配置选项。";
  }
  if (
    approvalPolicyRestriction.value.hasRestrictions ||
    approvalsReviewerRestriction.value.hasRestrictions ||
    sandboxModeRestriction.value.hasRestrictions
  ) {
    return "已按服务端 requirements 限制审批策略、审批复核方与沙箱模式。";
  }
  return configRequirementsStore.statusText || "当前服务端未限制审批策略、审批复核方与沙箱模式。";
});

const approvalPolicyHintText = computed(() => {
  if (configRequirementsStore.loadState === "error") return "";
  return buildRestrictedHintText(approvalPolicyRestriction.value);
});

const sandboxModeHintText = computed(() => {
  if (configRequirementsStore.loadState === "error") return "";
  return buildRestrictedHintText(sandboxModeRestriction.value, SANDBOX_MODE_LABELS);
});

const approvalsReviewerHintText = computed(() => {
  if (!runtimeStore.serverId) return "";
  if (configRequirementsStore.loadState === "loading") return "正在读取服务端 requirements...";
  if (configRequirementsStore.loadState === "error") {
    return configRequirementsStore.statusText || "requirements 读取失败，当前按无约束显示 reviewer。";
  }

  const restriction = approvalsReviewerRestriction.value;
  if (!restriction.hasRestrictions) {
    return "默认由 user 处理审批。";
  }
  if (!restriction.values || restriction.values.length === 0) {
    return restriction.hasUnsupported
      ? "当前服务端 requirements 返回了桌面端暂未映射的 reviewer 限制。"
      : "当前服务端 requirements 未允许可选 reviewer。";
  }

  const allowedText = formatRestrictedValues(restriction.values, APPROVALS_REVIEWER_LABELS);
  const suffix = restriction.hasUnsupported ? "；其余 reviewer 限制桌面端暂未映射。" : "";
  return `当前服务端仅允许 reviewer：${allowedText}${suffix}`;
});

const isGlobalConfigFieldDirty = (key: keyof GlobalConfigDraft): boolean => {
  return JSON.stringify(configStore.draft[key]) !== JSON.stringify(configStore.snapshot[key]);
};

const GLOBAL_CONFIG_DIRTY_KEYS: Array<keyof GlobalConfigDraft> = [
  "model",
  "fastModeEnabled",
  "modelContextWindow",
  "modelAutoCompactTokenLimit",
  "modelReasoningEffort",
  "modelReasoningSummary",
  "approvalPolicy",
  "approvalsReviewer",
  "sandboxMode",
  "windowsElevatedSandboxEnabled",
  "powershellUtf8Enabled",
  "unifiedExecEnabled",
];

const globalConfigDirtyCount = computed(
  () => GLOBAL_CONFIG_DIRTY_KEYS.filter((key) => isGlobalConfigFieldDirty(key)).length
);

const normalizeOptionalPositiveIntegerInput = (value: unknown): number | null => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    return rounded > 0 ? rounded : null;
  }
  const digits = String(value ?? "")
    .replace(/\\D+/g, "")
    .trim();
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const formatOptionalPositiveIntegerInput = (value: number | null | undefined): string => {
  return value == null || !Number.isFinite(value) || value <= 0 ? "" : String(Math.round(value));
};

const globalConfigFieldErrors = computed(() => {
  const contextWindow = normalizeOptionalPositiveIntegerInput(configStore.draft.modelContextWindow);
  const compactLimit = normalizeOptionalPositiveIntegerInput(configStore.draft.modelAutoCompactTokenLimit);
  const baselineContextWindow = normalizeOptionalPositiveIntegerInput(configStore.snapshot.modelContextWindow);
  const baselineCompactLimit = normalizeOptionalPositiveIntegerInput(configStore.snapshot.modelAutoCompactTokenLimit);
  const contextChanged = contextWindow !== baselineContextWindow;
  const compactChanged = compactLimit !== baselineCompactLimit;
  const errors = { modelContextWindow: "", modelAutoCompactTokenLimit: "" };
  if (!contextChanged && !compactChanged) return errors;
  if (contextWindow == null && compactLimit == null) return errors;
  if (contextWindow == null) return { ...errors, modelContextWindow: "请先填写上下文窗口。" };
  if (compactLimit == null) return { ...errors, modelAutoCompactTokenLimit: "请填写自动压缩阈值。" };
  if (compactLimit >= contextWindow) return { ...errors, modelAutoCompactTokenLimit: "必须小于上下文窗口。" };
  return errors;
});

const modelContextWindowError = computed(() => globalConfigFieldErrors.value.modelContextWindow);
const modelAutoCompactTokenLimitError = computed(() => globalConfigFieldErrors.value.modelAutoCompactTokenLimit);
const globalConfigValidationError = computed(
  () => modelContextWindowError.value || modelAutoCompactTokenLimitError.value || ""
);

const canSaveGlobalConfig = computed(
  () =>
    Boolean(runtimeStore.serverId) &&
    !configStore.saving &&
    configStore.loadState === "ready" &&
    configStore.isDirty &&
    !globalConfigValidationError.value
);

const canResetGlobalConfig = computed(
  () =>
    Boolean(runtimeStore.serverId) && !configStore.saving && configStore.loadState === "ready" && configStore.isDirty
);

const globalConfigStatusKind = computed(() => {
  if (!runtimeStore.serverId) return "neutral";
  if (configStore.loadState === "error" || globalConfigValidationError.value) return "error";
  if (configStore.saving || configStore.loadState === "loading") return "info";
  if (configStore.isDirty) return "warning";
  return "success";
});

const globalConfigStatusText = computed(() => {
  if (!runtimeStore.serverId) return "未连接服务";
  if (configStore.saving) return "保存中...";
  if (configStore.loadState === "loading") return "读取配置中...";
  if (configStore.loadState === "error") return configStore.statusText || "读取失败";
  if (globalConfigValidationError.value) return globalConfigValidationError.value;
  return configStore.isDirty ? "有未保存改动" : "已同步生效配置";
});

const globalConfigActionsSummary = computed(() => {
  if (!runtimeStore.serverId) return "主配置未连接服务";
  if (configStore.saving) return "正在保存主配置...";
  if (configStore.isDirty) return `主配置待保存 ${globalConfigDirtyCount.value} 项`;
  return "主配置已同步";
});

const globalConfigActionsHint = computed(() => {
  if (!runtimeStore.serverId) return "连接服务后才能保存主配置；背景外观仍即时生效。";
  if (globalConfigValidationError.value) return "修正当前校验错误后，才能保存主配置。";
  return "主配置改动需要点击保存；全局背景外观保持即时生效。";
});

const onSaveGlobalConfig = () => {
  void saveGlobalConfigManually();
};

const onResetGlobalConfig = () => {
  runtime.resetGlobalConfig();
};

const globalModelOptions = computed(() =>
  buildModelPickerOptions({
    customIds: modelCatalogStore.customIds,
    current: configStore.draft.model,
  })
);

const onModelChanged = (nextRaw: string) => {
  const next = normalizeModelId(nextRaw);
  if (!next) return;
  configStore.setDraft({ model: next });
};

const customModelInput = ref("");
const normalizedCustomModelInput = computed(() => normalizeModelId(customModelInput.value));
const customModelExists = computed(() => {
  const next = normalizedCustomModelInput.value;
  return Boolean(next) && modelCatalogStore.availableModelIds.includes(next);
});
const canAddCustomModel = computed(
  () => Boolean(normalizedCustomModelInput.value) && !customModelExists.value && !modelCatalogControlsDisabled.value
);
const customModelHintText = computed(() => {
  const next = normalizedCustomModelInput.value;
  if (!next) return "添加后会同步到全局配置、主输入区和执行计划工具条。";
  if (customModelExists.value) return "该模型已在可选列表中。";
  return "点击添加后，会立即出现在所有模型下拉里。";
});

const remoteModelPick = ref("");
const normalizedRemoteModelPick = computed(() => normalizeModelId(remoteModelPick.value));
const remoteModelPickExists = computed(() => {
  const next = normalizedRemoteModelPick.value;
  return Boolean(next) && modelCatalogStore.availableModelIds.includes(next);
});
const canRefreshRemoteModels = computed(
  () => Boolean(runtimeStore.serverId) && modelCatalogStore.remoteLoadState !== "loading"
);
const canAddRemoteModel = computed(
  () => Boolean(normalizedRemoteModelPick.value) && !remoteModelPickExists.value && !modelCatalogControlsDisabled.value
);
const remoteModelSelectDisabled = computed(
  () =>
    !runtimeStore.serverId ||
    modelCatalogStore.remoteLoadState === "loading" ||
    modelCatalogStore.remoteIds.length === 0
);
const remoteModelStatusText = computed(() => {
  if (!runtimeStore.serverId) return "连接服务后可从 Codex 读取可用模型（model/list），无需手动查找。";
  if (modelCatalogStore.remoteLoadState === "loading") return "正在读取可用模型...";
  if (modelCatalogStore.remoteLoadState === "error") return "读取可用模型失败，可点击刷新重试。";
  if (modelCatalogStore.remoteIds.length > 0) return `已读取 ${modelCatalogStore.remoteIds.length} 个可用模型。`;
  return "点击刷新读取可用模型列表。";
});
const remoteModelDropdownOptions = computed(() => {
  const hasServer = Boolean(runtimeStore.serverId);
  const loading = modelCatalogStore.remoteLoadState === "loading";
  const errored = modelCatalogStore.remoteLoadState === "error";
  const ids = modelCatalogStore.remoteIds;
  let placeholder = "未加载，点击刷新";
  if (!hasServer) placeholder = "未连接服务";
  else if (loading) placeholder = "加载中...";
  else if (errored) placeholder = "加载失败，点击刷新";
  else if (ids.length === 0) placeholder = "未加载，点击刷新";
  else placeholder = "选择可用模型";
  return [{ value: "", label: placeholder, disabled: true }, ...ids.map((id) => ({ value: id, label: id }))];
});

const onRefreshRemoteModels = () => {
  void modelCatalogStore.refreshRemoteModels();
};

const onAddRemoteModel = async () => {
  const next = normalizedRemoteModelPick.value;
  if (!next || remoteModelPickExists.value || modelCatalogControlsDisabled.value) return;
  const added = await modelCatalogStore.addCustomModel(next);
  if (added) remoteModelPick.value = "";
};

const cnPresetPick = ref("");
const normalizedCnPresetPick = computed(() => normalizeModelId(cnPresetPick.value));
const cnPresetPickExists = computed(() => {
  const next = normalizedCnPresetPick.value;
  return Boolean(next) && modelCatalogStore.availableModelIds.includes(next);
});
const canAddCnPresetModel = computed(
  () => Boolean(normalizedCnPresetPick.value) && !cnPresetPickExists.value && !modelCatalogControlsDisabled.value
);
const selectedCnPreset = computed(() => {
  const next = normalizedCnPresetPick.value;
  if (!next) return null;
  return CN_MODEL_PRESETS.find((preset) => preset.id === next) ?? null;
});
const cnPresetHintText = computed(() => {
  const next = normalizedCnPresetPick.value;
  if (!next) return "从常见国内厂商的 OpenAI 兼容模型中一键添加 model id（不会自动配置 base_url / api_key）。";
  if (cnPresetPickExists.value) return "该模型已在可选列表中。";
  const preset = selectedCnPreset.value;
  if (!preset) return "点击添加后，会立即出现在所有模型下拉里。";
  if (preset.baseUrlHint) return `提示：${preset.provider} 建议 base_url = ${preset.baseUrlHint}。`;
  return `提示：${preset.provider}，base_url 参考厂商文档。`;
});
const cnPresetDropdownOptions = computed(() => {
  const options = CN_MODEL_PRESETS.map((preset) => ({
    value: preset.id,
    label: `${preset.provider} · ${preset.id}`,
  }));
  return [{ value: "", label: "选择国内常用模型预设", disabled: true }, ...options];
});

const onAddCnPresetModel = async () => {
  const next = normalizedCnPresetPick.value;
  if (!next || cnPresetPickExists.value || modelCatalogControlsDisabled.value) return;
  const added = await modelCatalogStore.addCustomModel(next);
  if (added) cnPresetPick.value = "";
};

const onCustomModelInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  customModelInput.value = String(target?.value ?? "");
};

const onAddCustomModel = async () => {
  const next = normalizedCustomModelInput.value;
  if (!next || customModelExists.value || modelCatalogControlsDisabled.value) return;
  const added = await modelCatalogStore.addCustomModel(next);
  if (added) customModelInput.value = "";
};

const onRemoveCustomModel = async (id: string) => {
  if (modelCatalogControlsDisabled.value) return;
  await modelCatalogStore.removeCustomModel(id);
};

const modelContextWindowInputText = computed(() =>
  formatOptionalPositiveIntegerInput(configStore.draft.modelContextWindow)
);
const modelAutoCompactTokenLimitInputText = computed(() =>
  formatOptionalPositiveIntegerInput(configStore.draft.modelAutoCompactTokenLimit)
);

const onModelContextWindowInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  configStore.setDraft({ modelContextWindow: normalizeOptionalPositiveIntegerInput(target?.value ?? "") });
};

const onModelAutoCompactTokenLimitInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  configStore.setDraft({ modelAutoCompactTokenLimit: normalizeOptionalPositiveIntegerInput(target?.value ?? "") });
};

const setServiceTier = (fastModeEnabled: boolean) => {
  if (globalControlsDisabled.value) return;
  configStore.setDraft({ fastModeEnabled });
};

const onServiceTierArrowKey = (fastModeEnabled: boolean) => {
  setServiceTier(fastModeEnabled);
};

const CONTEXT_WINDOW_PRESET_400K = 400000;
const AUTO_COMPACT_TOKEN_LIMIT_PRESET_400K = 360000;
const apply400kContextPreset = () => {
  configStore.setDraft({
    modelContextWindow: CONTEXT_WINDOW_PRESET_400K,
    modelAutoCompactTokenLimit: AUTO_COMPACT_TOKEN_LIMIT_PRESET_400K,
  });
};

// 断连时给 store 一个可用的 baseline，避免首次打开抽屉时表单空态闪烁。
if (!configStore.snapshot) configStore.applySnapshot(createDefaultGlobalConfigDraft());
</script>

<style scoped>
.global-config-guide-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
  background: color-mix(in srgb, var(--surface-2) 30%, transparent);
  margin-bottom: 10px;
}

.guide-entry-text {
  display: grid;
  gap: 6px;
}

.guide-entry-title {
  font-weight: 600;
  font-size: 14.5px;
  color: var(--text-1);
}

.guide-entry-desc {
  font-size: 13px;
  color: var(--text-2);
}

.global-config-local-entry {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.global-appearance-copy {
  min-width: 0;
}

.global-model-manager {
  gap: 10px;
}

.global-model-manage-hint,
.global-model-empty {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--text-2);
}

.global-config-requirements-summary {
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
  background: color-mix(in srgb, var(--surface-1) 80%, transparent);
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-2);
}

.global-config-requirements-summary.is-loading {
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
}

.global-config-requirements-summary.is-error {
  border-color: color-mix(in srgb, var(--danger) 40%, transparent);
  color: var(--danger);
}

.global-model-add-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.global-model-add-row .context-input {
  flex: 1 1 220px;
  min-width: 0;
}

.global-model-list {
  display: grid;
  gap: 8px;
}

.global-model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 5px;
  border: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
  background: color-mix(in srgb, var(--surface-2) 30%, transparent);
}

.global-model-item-id {
  font-size: 13px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-appearance-controls {
  display: grid;
  gap: 10px;
  width: min(100%, 320px);
}

.typography-controls {
  display: grid;
  gap: 10px;
  width: min(100%, 320px);
}

.typography-row {
  display: grid;
  gap: 8px;
}

.typography-label {
  font-size: 12.5px;
  color: var(--text-2);
}

.global-appearance-preview {
  min-height: 100px;
  border-radius: 5px;
  border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  background-color: color-mix(in srgb, var(--surface-1) 60%, transparent);
  background-position: center center;
  background-repeat: no-repeat;
  background-size: cover;
  display: grid;
  place-items: center;
  color: var(--text-2);
  overflow: hidden;
  font-size: 13px;
}

.global-appearance-preview.is-empty {
  background-image: linear-gradient(
    135deg,
    color-mix(in srgb, var(--surface-1) 80%, transparent),
    color-mix(in srgb, var(--accent) 15%, transparent)
  );
}

.global-appearance-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.global-appearance-fit-row {
  display: grid;
  gap: 8px;
}

.global-appearance-fit-label {
  font-size: 12.5px;
  color: var(--text-2);
}

.page-bg-opacity-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.page-bg-opacity-slider {
  width: 100%;
  accent-color: var(--accent);
}

.page-bg-opacity-value {
  min-width: 44px;
  text-align: right;
  color: var(--text-1);
  font-size: 13px;
}
</style>
