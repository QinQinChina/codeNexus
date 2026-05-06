<template>
  <div class="composer">
    <div class="composer-input-area">
      <div
        :ref="composerPanelRef"
        class="composer-shell relative grid min-w-0 cursor-text gap-2.5 rounded-[20px] p-3 transition-all duration-300 max-[1500px]:gap-2 max-[1500px]:rounded-[16px] max-[1500px]:p-2.5 border border-[var(--composer-shell-border)] bg-[var(--composer-shell-bg)] focus-within:border-[var(--composer-shell-focus-border)]"
        :class="{
          'is-agent': composeMode === 'default',
          'is-plan': composeMode === 'plan',
          'is-workspace-file-drag-over': isWorkspaceFileDragOver,
          'is-focused': isInputFocused,
        }"
        @pointerdown="onComposerShellPointerDown"
        @dragenter="onComposerDragEnter"
        @dragover="onComposerDragOver"
        @dragleave="onComposerDragLeave"
        @drop="onComposerDrop"
      >
        <UserInputDock v-if="hasPendingComposerUserInput" />
        <div
          v-if="isWorkspaceFileDragOver"
          class="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-[10px] border border-dashed border-[color:var(--border-accent)] bg-[color:var(--bg-accent-soft)]/80 px-4 text-center text-[12px] font-medium text-[color:var(--fg-accent)] backdrop-blur-[6px]"
          aria-hidden="true"
        >
          松开鼠标，将工作区文件添加到当前提问
        </div>
        <div
          :ref="bindComposerInputRef"
          id="input"
          contenteditable="true"
          role="textbox"
          aria-multiline="true"
          spellcheck="false"
          data-placeholder="输入任务..."
          @keydown="onComposerKeydown"
          @paste="onComposerPaste"
          @input="onComposerInput"
          @focus="isInputFocused = true"
          @blur="isInputFocused = false"
          @mousedown="onComposerInputMouseDown"
        ></div>

        <input
          :ref="composerImageInputRef"
          class="composer-image-input-native"
          type="file"
          accept="image/*"
          multiple
          @change="onComposerImageInputChange"
        />

        <div v-if="composeAttachments.length > 0" class="flex flex-wrap gap-2 max-[1500px]:gap-1.5">
          <div
            v-for="attachment in composeAttachments"
            :key="attachment.id"
            class="relative h-11 w-11 flex-none max-[1500px]:h-10 max-[1500px]:w-10"
            :title="attachment.name"
          >
            <button
              class="block h-full w-full min-w-0 cursor-zoom-in overflow-hidden rounded-[6px] border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-soft)] max-[1500px]:rounded-[5px]"
              type="button"
              :aria-label="`预览图片：${attachment.name}`"
              @click="onPreviewAttachment(attachment.id)"
            >
              <img
                class="block h-11 w-11 rounded-[6px] border border-[var(--border)] bg-[var(--surface-1)] object-cover shadow-[var(--ui-shadow-sm)] max-[1500px]:h-10 max-[1500px]:w-10 max-[1500px]:rounded-[5px]"
                :src="attachment.previewUrl"
                :alt="attachment.name"
                loading="lazy"
              />
            </button>
            <button
              class="absolute -right-[5px] -top-[5px] inline-flex h-4 w-4 min-w-4 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-1)] p-0 text-[12px] leading-none text-[color:var(--text)] shadow-[var(--ui-shadow-md)] hover:border-[color:var(--border-danger)] hover:bg-[color:var(--bg-danger-soft)] hover:text-[color:var(--fg-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-soft)] active:translate-y-0 max-[1500px]:-right-1 max-[1500px]:-top-1 max-[1500px]:h-[15px] max-[1500px]:w-[15px] max-[1500px]:min-w-[15px] max-[1500px]:text-[11px]"
              type="button"
              aria-label="移除图片"
              @click.stop.prevent="onRemoveAttachment(attachment.id)"
            >
              ×
            </button>
          </div>
        </div>

        <div
          class="composer-toolbar grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t pt-2 max-[1500px]:grid-cols-1 max-[1500px]:gap-2 max-[1500px]:pt-1.5"
        >
          <div class="flex min-w-0 flex-wrap items-center gap-2 max-[1500px]:w-full max-[1500px]:gap-1.5">
            <div
              v-if="historyRewriteActive"
              class="mono inline-flex items-center gap-2 rounded-full border border-[color:var(--border-accent)] bg-[color:var(--bg-accent-soft)] px-2 py-1 text-[color:var(--text)]"
            >
              <span>{{ historyRewriteSource === "queue" ? "编辑排队消息" : "重写历史消息" }}</span>
              <button class="btn-mini" type="button" @click="emit('cancel-rewrite')">取消</button>
            </div>

            <div
              class="composer-mode-group relative inline-flex items-center gap-0.5 rounded-full bg-[var(--composer-mode-group-bg)] p-1 shadow-inner border border-[var(--composer-mode-group-border)]"
              role="group"
              aria-label="协作模式"
            >
              <div
                class="composer-mode-thumb absolute h-[calc(100%-8px)] rounded-full bg-[var(--surface-1)] shadow-sm border border-[var(--composer-mode-group-border)] transition-all duration-300 ease-out"
                :style="{
                  left: composeMode === 'default' ? '4px' : 'calc(50% + 1px)',
                  width: 'calc(50% - 5px)',
                }"
              ></div>
              <button
                class="btn-mini composer-mode-button relative z-10 flex-1 inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 transition-colors duration-200 px-3"
                type="button"
                :class="
                  composeMode === 'default'
                    ? 'text-[var(--accent)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                "
                @click="emit('set-compose-mode', 'default')"
              >
                <Bot class="h-3.5 w-3.5" aria-hidden="true" /><span>执行</span>
              </button>
              <button
                class="btn-mini composer-mode-button relative z-10 flex-1 inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 transition-colors duration-200 px-3"
                type="button"
                :class="
                  composeMode === 'plan'
                    ? 'text-[var(--accent)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                "
                @click="emit('set-compose-mode', 'plan')"
              >
                <ListTodo class="h-3.5 w-3.5" aria-hidden="true" /><span>计划</span>
              </button>
            </div>

            <SelectDropdown
              id="sel-model"
              v-model="modelValueModel"
              class="composer-select composer-select--model mono inline-flex h-7 w-[clamp(108px,14vw,152px)] min-w-0 cursor-pointer items-center justify-between gap-2 rounded-full px-2.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-transparent text-[color:var(--input-text)] shadow-none transition-all duration-200 max-[1500px]:w-[clamp(100px,16vw,136px)]"
              :class="modelToneClass"
              :minPopoverWidth="0"
              :options="modelOptions"
              aria-label="模型"
            />
            <SelectDropdown
              id="sel-effort"
              v-model="reasoningEffortModel"
              class="composer-select composer-select--effort mono inline-flex h-7 min-w-0 w-[min(100%,70px)] max-w-[70px] cursor-pointer items-center justify-between gap-2 rounded-full px-2.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-transparent text-[color:var(--input-text)] shadow-none transition-all duration-200 max-[1500px]:w-[min(100%,66px)] max-[1500px]:max-w-[66px]"
              :class="reasoningToneClass"
              :minPopoverWidth="0"
              :options="reasoningEffortOptions"
              aria-label="思考程度"
            />
            <SelectDropdown
              id="sel-sandbox"
              v-model="sandboxModeModel"
              class="composer-select composer-select--sandbox mono inline-flex h-7 min-w-0 w-[min(100%,82px)] max-w-[82px] cursor-pointer items-center justify-between gap-1.5 rounded-full px-2.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-transparent text-[color:var(--input-text)] shadow-none transition-all duration-200 max-[1500px]:w-[min(100%,76px)] max-[1500px]:max-w-[76px]"
              :class="sandboxToneClass"
              :title="sandboxRiskText"
              :minPopoverWidth="120"
              :options="sandboxModeOptions"
              aria-label="权限"
            />
            <span
              v-if="serviceTierLabel"
              class="mono inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium tracking-[0.01em] max-[1500px]:h-6 max-[1500px]:px-2 max-[1500px]:text-[10px]"
              :class="
                serviceTierLabel === '快速'
                  ? 'border-[color:var(--border-accent)] bg-[color:var(--bg-accent-soft)] text-[color:var(--fg-accent)]'
                  : 'border-[var(--border)] bg-[var(--surface-2)] text-[color:var(--text-muted)]'
              "
              :title="serviceTierTooltip || serviceTierLabel"
              >{{ serviceTierLabel }}</span
            >
          </div>

          <div
            class="ml-0 inline-flex min-w-0 items-center justify-end gap-2 justify-self-end max-[1500px]:w-full max-[1500px]:justify-self-stretch max-[1500px]:gap-1.5"
          >
            <button
              id="btn-add-image"
              class="btn-mini composer-icon-button inline-flex h-[30px] w-[30px] min-w-[30px] items-center justify-center p-0"
              type="button"
              title="添加图片"
              aria-label="添加图片"
              @click="emit('pick-images')"
            >
              <ImagePlus class="h-[14px] w-[14px]" />
            </button>

            <div
              class="inline-flex min-w-0 items-center gap-2 max-[1500px]:justify-end max-[1500px]:gap-1.5"
              :title="contextUsageTooltip"
            >
              <WaterBallProgress
                class="h-[30px] w-[30px] min-w-[30px] flex-none overflow-hidden rounded-full saturate-[0.96] max-[1500px]:h-6 max-[1500px]:w-6 max-[1500px]:min-w-6"
                :percent="contextUsagePercent"
                :level="contextUsageLevel"
                :aria-label="contextUsageTooltip"
              />
              <div class="flex min-w-0 flex-col items-end justify-center gap-0.5 leading-none">
                <div
                  class="mono text-[11px] font-medium tracking-[0.01em] text-[color:var(--text-muted)] max-[1500px]:text-[10px]"
                >
                  {{ contextUsageTokensText }}
                </div>
              </div>
              <div
                v-if="contextWindowLimitWarningText"
                class="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-warning)] bg-[color:var(--bg-warning-soft)] px-2 py-1 text-[10px] font-semibold text-[color:var(--fg-warning)] max-[1500px]:px-1.5"
                :title="contextWindowLimitWarningText"
              >
                <ShieldAlert class="h-3 w-3" />
                <span class="max-[1500px]:hidden">接近上限</span>
              </div>
            </div>

            <button
              id="btn-send-stop"
              class="composer-send-button group relative inline-flex h-8 w-8 min-w-8 items-center justify-center rounded-full border border-[color:var(--border-accent)] bg-gradient-to-b from-[color:var(--bg-accent-soft)] to-[color:var(--button-bg)] p-0 text-[color:var(--fg-accent)] max-[1500px]:h-[30px] max-[1500px]:w-[30px] max-[1500px]:min-w-[30px] hover:border-[color:var(--border-accent-hover)] hover:to-[color:var(--button-bg-hover)] hover:text-[color:var(--fg-accent)] active:scale-95 transition-all duration-200"
              :class="{ 'is-running': isTurnRunning, 'opacity-50 cursor-not-allowed': sendDisabled && !isTurnRunning }"
              type="button"
              :disabled="sendDisabled && !isTurnRunning"
              :title="sendTitle"
              :aria-label="sendTitle"
              @click="emit('send')"
            >
              <div
                v-if="!sendDisabled && !isTurnRunning"
                class="absolute inset-0 rounded-full bg-[var(--accent)] opacity-20 animate-ping group-hover:hidden"
              ></div>
              <SendHorizontal
                class="h-4 w-4 stroke-[2.25] max-[1500px]:h-[14px] max-[1500px]:w-[14px] transition-transform group-hover:translate-x-0.5"
              />
              <span class="composer-send-label text-[12px] font-semibold">发送</span>
            </button>
            <button
              v-if="isTurnRunning"
              class="composer-send-button is-running inline-flex h-8 w-8 min-w-8 items-center justify-center rounded-full border border-[color:var(--border-danger)] bg-gradient-to-b from-[color:var(--bg-danger-soft)] to-[color:var(--button-bg)] p-0 text-[color:var(--fg-danger)] max-[1500px]:h-[30px] max-[1500px]:w-[30px] max-[1500px]:min-w-[30px] hover:border-[color:var(--border-danger-hover)] hover:to-[color:var(--button-bg-hover)] hover:text-[color:var(--fg-danger)] active:scale-95 transition-all duration-200"
              type="button"
              :disabled="interruptDisabled"
              :title="interruptTitle"
              :aria-label="interruptTitle"
              @click="emit('interrupt-turn')"
            >
              <Square class="h-4 w-4 stroke-[2.25] max-[1500px]:h-[14px] max-[1500px]:w-[14px]" />
            </button>
          </div>
        </div>

        <div
          v-if="statusText"
          class="composer-status-line -mt-1 flex min-w-0 items-center justify-start max-[1500px]:-mt-0.5"
        >
          <WaveText class="mono dim text-[11px] leading-[1.25] max-[1500px]:text-[10px]" :text="statusText" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from "vue";
import { Bot, ImagePlus, ListTodo, SendHorizontal, ShieldAlert, Square } from "lucide-vue-next";
import type { CollaborationModeKind, ComposeImageAttachment, ComposeWorkspaceFileMention } from "../../domain/types";
import {
  COMPOSE_FILE_TOKEN_CHAR,
  countComposeFileTokensBeforeOffset,
  createComposeFileMention,
  findComposeFileTokenOffsetByMentionIndex,
} from "../../domain/composeFileMentions";
import { basenameFromPath } from "../../domain/workspaceFiles";
import { hasWorkspaceFileDragData, readWorkspaceFileDragData } from "../../domain/workspaceFileDrag";
import { useRuntimeStore, type SandboxMode } from "../../stores/runtime.store";
import { useUserInputStore } from "../../stores/userInput.store";
import SelectDropdown from "../ui/SelectDropdown.vue";
import WaterBallProgress from "../ui/WaterBallProgress.vue";
import WaveText from "../ui/WaveText.vue";

const UserInputDock = defineAsyncComponent(() => import("../userInput/UserInputDock.vue"));

type SelectOption = {
  value: string;
  label: string;
};

type ElementRefBinder<T extends Element> = (el: T | null) => void;

type ComposeDraftState = {
  composeInput: string;
  composeFileMentions: ComposeWorkspaceFileMention[];
};

type CaretRangeDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

const props = defineProps<{
  composeInput: string;
  composeAttachments: ComposeImageAttachment[];
  composeFileMentions: ComposeWorkspaceFileMention[];
  historyRewriteActive: boolean;
  historyRewriteSource: "history" | "queue";
  statusText?: string;
  composeMode: CollaborationModeKind;
  model: string;
  reasoningEffort: string;
  sandboxMode: SandboxMode;
  modelOptions: string[];
  reasoningEffortOptions: readonly SelectOption[];
  sandboxModeOptions: readonly SelectOption[];
  sandboxRiskText: string;
  serviceTierLabel?: string;
  serviceTierTooltip?: string;
  contextUsageTooltip: string;
  contextUsagePercent: number;
  contextUsageLevel: string;
  contextUsageTokensText: string;
  contextWindowLimitWarningText: string;
  isTurnRunning: boolean;
  sendDisabled: boolean;
  sendTitle: string;
  interruptDisabled: boolean;
  interruptTitle: string;
  composerPanelRef: ElementRefBinder<HTMLDivElement>;
  composerInputRef: ElementRefBinder<HTMLDivElement>;
  composerImageInputRef: ElementRefBinder<HTMLInputElement>;
}>();

const emit = defineEmits<{
  (event: "update:composeInput", value: string): void;
  (event: "update:composeFileMentions", value: ComposeWorkspaceFileMention[]): void;
  (event: "update:model", value: string): void;
  (event: "update:reasoningEffort", value: string): void;
  (event: "update:sandboxMode", value: SandboxMode): void;
  (event: "set-compose-mode", mode: CollaborationModeKind): void;
  (event: "composer-keydown", eventValue: KeyboardEvent): void;
  (event: "composer-paste", eventValue: ClipboardEvent): void;
  (event: "composer-image-change", eventValue: Event): void;
  (event: "preview-attachment", attachmentId: string): void;
  (event: "remove-attachment", attachmentId: string): void;
  (event: "cancel-rewrite"): void;
  (event: "pick-images"): void;
  (event: "send"): void;
  (event: "interrupt-turn"): void;
}>();

const internalComposerInputRef = ref<HTMLDivElement | null>(null);
const runtimeStore = useRuntimeStore();
const userInputStore = useUserInputStore();
const isInputFocused = ref(false);
const workspaceFileDragDepth = ref(0);
const isWorkspaceFileDragOver = ref(false);
const selectedMentionId = ref("");
const pendingSelectionOffset = ref<number | null>(null);
const pendingFocusAfterSync = ref(false);

type ComposerScrollSnapshot = {
  top: number;
  bottomOffset: number;
  overflow: boolean;
};

function bindComposerInputRef(el: HTMLDivElement | null) {
  internalComposerInputRef.value = el;
  props.composerInputRef(el);
}

const modelValueModel = computed({
  get: () => props.model,
  set: (value: string) => emit("update:model", value),
});

const reasoningEffortModel = computed({
  get: () => props.reasoningEffort,
  set: (value: string) => emit("update:reasoningEffort", value),
});

const sandboxModeModel = computed({
  get: () => props.sandboxMode,
  set: (value: string) => emit("update:sandboxMode", value as SandboxMode),
});

function normalizeToneKey(value: unknown): string {
  return (
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "default"
  );
}

const modelToneClass = computed(() => "is-" + normalizeToneKey(props.model));
const reasoningToneClass = computed(() => "is-" + normalizeToneKey(props.reasoningEffort));
const sandboxToneClass = computed(() => "is-" + normalizeToneKey(props.sandboxMode));

const hasPendingComposerUserInput = computed(() => {
  const threadId = String(runtimeStore.currentThreadId ?? "").trim();
  return Boolean(threadId && userInputStore.queueSizeForThread(threadId) > 0);
});

const mentionSignature = computed(() => {
  return props.composeFileMentions.map((mention) => `${mention.id}\u0001${mention.path}`).join("\u0002");
});

function getComposeDraftFromProps(): ComposeDraftState {
  return {
    composeInput: String(props.composeInput ?? ""),
    composeFileMentions: props.composeFileMentions.map((mention) => ({ ...mention })),
  };
}

function isMentionTokenElement(node: Node | null): node is HTMLElement {
  return node instanceof HTMLElement && node.dataset.composeMentionId != null;
}

function isSameMention(left: ComposeWorkspaceFileMention, right: ComposeWorkspaceFileMention): boolean {
  return left.id === right.id && left.path === right.path;
}

function isSameComposeDraft(left: ComposeDraftState, right: ComposeDraftState): boolean {
  if (left.composeInput !== right.composeInput) return false;
  if (left.composeFileMentions.length !== right.composeFileMentions.length) return false;
  for (let index = 0; index < left.composeFileMentions.length; index += 1) {
    if (!isSameMention(left.composeFileMentions[index], right.composeFileMentions[index])) return false;
  }
  return true;
}

function buildMentionTokenElement(mention: ComposeWorkspaceFileMention): HTMLSpanElement {
  const root = document.createElement("span");
  root.className = "composer-inline-file-token";
  root.contentEditable = "false";
  root.dataset.composeMentionId = mention.id;
  root.dataset.composeMentionPath = mention.path;
  root.title = mention.path;

  const icon = document.createElement("span");
  icon.className = "composer-inline-file-token__icon";
  icon.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "composer-inline-file-token__label";
  label.textContent = basenameFromPath(mention.path) || mention.path;

  root.append(icon, label);
  return root;
}

function renderComposeDraftToDom(root: HTMLDivElement, draft: ComposeDraftState) {
  root.replaceChildren();

  let mentionIndex = 0;
  let textBuffer = "";

  const flushTextBuffer = () => {
    if (!textBuffer) return;
    root.append(document.createTextNode(textBuffer));
    textBuffer = "";
  };

  for (const char of draft.composeInput) {
    if (char !== COMPOSE_FILE_TOKEN_CHAR) {
      textBuffer += char;
      continue;
    }
    flushTextBuffer();
    const mention = draft.composeFileMentions[mentionIndex] ?? null;
    mentionIndex += 1;
    if (!mention) continue;
    root.append(buildMentionTokenElement(mention));
  }

  flushTextBuffer();

  for (; mentionIndex < draft.composeFileMentions.length; mentionIndex += 1) {
    const mention = draft.composeFileMentions[mentionIndex];
    if (!mention) continue;
    root.append(buildMentionTokenElement(mention));
  }
}

function readComposeDraftFromDom(root: HTMLDivElement): ComposeDraftState {
  const composeInputParts: string[] = [];
  const composeFileMentions: ComposeWorkspaceFileMention[] = [];

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      composeInputParts.push(child.textContent ?? "");
      continue;
    }
    if (child.nodeName === "BR") {
      composeInputParts.push("\n");
      continue;
    }
    if (!isMentionTokenElement(child)) {
      composeInputParts.push(child.textContent ?? "");
      continue;
    }
    const mention = createComposeFileMention(child.dataset.composeMentionPath ?? "", {
      id: child.dataset.composeMentionId ?? "",
      idPrefix: "compose-file",
    });
    if (!mention) continue;
    composeInputParts.push(COMPOSE_FILE_TOKEN_CHAR);
    composeFileMentions.push(mention);
  }

  const composeInput = composeInputParts.join("").replace(/\r\n?/g, "\n");
  if (
    composeFileMentions.length === 0 &&
    composeInput === "\n" &&
    root.childNodes.length === 1 &&
    root.firstChild?.nodeName === "BR"
  ) {
    return {
      composeInput: "",
      composeFileMentions,
    };
  }

  return {
    composeInput,
    composeFileMentions,
  };
}

function getLogicalLengthOfNode(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
  if (node.nodeName === "BR") return 1;
  if (isMentionTokenElement(node)) return 1;
  let total = 0;
  for (const child of Array.from(node.childNodes)) {
    total += getLogicalLengthOfNode(child);
  }
  return total;
}

function getLogicalOffsetFromDomPoint(root: HTMLDivElement, container: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  try {
    range.setEnd(container, offset);
  } catch {
    return String(props.composeInput ?? "").length;
  }
  const fragment = range.cloneContents();
  return Array.from(fragment.childNodes).reduce((total, child) => total + getLogicalLengthOfNode(child), 0);
}

function getCurrentSelectionOffset(root: HTMLDivElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return String(props.composeInput ?? "").length;
  const range = selection.getRangeAt(0);
  return getLogicalOffsetFromDomPoint(root, range.startContainer, range.startOffset);
}

function resolveDomPointForOffset(root: HTMLDivElement, offsetValue: number): { container: Node; offset: number } {
  const offset = Math.max(0, Math.min(String(props.composeInput ?? "").length, Math.round(offsetValue)));
  let remaining = offset;
  const children = Array.from(root.childNodes);

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const childLength = getLogicalLengthOfNode(child);
    if (remaining > childLength) {
      remaining -= childLength;
      continue;
    }
    if (child.nodeType === Node.TEXT_NODE) {
      return { container: child, offset: Math.min(remaining, child.textContent?.length ?? 0) };
    }
    if (isMentionTokenElement(child) || child.nodeName === "BR") {
      if (remaining <= 0) return { container: root, offset: index };
      return { container: root, offset: index + 1 };
    }
    return { container: child, offset: Math.min(remaining, child.childNodes.length) };
  }

  return { container: root, offset: root.childNodes.length };
}

function focusComposerAtLogicalOffset(offset: number) {
  const root = internalComposerInputRef.value;
  if (!root) return;
  root.focus({ preventScroll: true });
  const selection = window.getSelection();
  if (!selection) return;
  const point = resolveDomPointForOffset(root, offset);
  const range = document.createRange();
  range.setStart(point.container, point.offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function applySelectedMentionState() {
  const root = internalComposerInputRef.value;
  if (!root) return;
  const activeMentionId = String(selectedMentionId.value ?? "").trim();
  for (const token of root.querySelectorAll<HTMLElement>("[data-compose-mention-id]")) {
    token.classList.toggle("is-selected", token.dataset.composeMentionId === activeMentionId);
  }
}

function captureComposerScrollSnapshot(root: HTMLDivElement): ComposerScrollSnapshot {
  const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
  return {
    top: root.scrollTop,
    bottomOffset: Math.max(0, maxScrollTop - root.scrollTop),
    overflow: maxScrollTop > 0,
  };
}

function restoreComposerScrollSnapshot(root: HTMLDivElement, snapshot: ComposerScrollSnapshot) {
  const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
  if (maxScrollTop <= 0) {
    root.scrollTop = 0;
    return;
  }
  if (!snapshot.overflow) {
    root.scrollTop = Math.max(0, Math.min(maxScrollTop, snapshot.top));
    return;
  }
  const nextTop = maxScrollTop - snapshot.bottomOffset;
  root.scrollTop = Math.max(0, Math.min(maxScrollTop, nextTop));
}

function syncDomFromProps() {
  const root = internalComposerInputRef.value;
  if (!root) return;

  const draftFromProps = getComposeDraftFromProps();
  const draftFromDom = readComposeDraftFromDom(root);
  const hasPhantomEmptyBreak =
    draftFromProps.composeInput === "" &&
    draftFromProps.composeFileMentions.length === 0 &&
    root.childNodes.length === 1 &&
    root.firstChild?.nodeName === "BR";
  if (isSameComposeDraft(draftFromProps, draftFromDom) && !hasPhantomEmptyBreak) {
    pendingSelectionOffset.value = null;
    pendingFocusAfterSync.value = false;
    if (
      selectedMentionId.value &&
      !draftFromProps.composeFileMentions.some((mention) => mention.id === selectedMentionId.value)
    ) {
      selectedMentionId.value = "";
    }
    applySelectedMentionState();
    return;
  }

  const shouldFocus = pendingFocusAfterSync.value || document.activeElement === root;
  const nextOffset = shouldFocus
    ? Math.max(
        0,
        Math.min(draftFromProps.composeInput.length, pendingSelectionOffset.value ?? draftFromProps.composeInput.length)
      )
    : null;
  const scrollSnapshot = captureComposerScrollSnapshot(root);

  renderComposeDraftToDom(root, draftFromProps);
  applySelectedMentionState();

  pendingSelectionOffset.value = null;
  pendingFocusAfterSync.value = false;

  restoreComposerScrollSnapshot(root, scrollSnapshot);
  if (nextOffset != null) focusComposerAtLogicalOffset(nextOffset);
}

function emitComposeDraft(
  nextDraft: ComposeDraftState,
  options?: { focusOffset?: number | null; focus?: boolean; selectedMentionId?: string }
) {
  pendingSelectionOffset.value = options?.focusOffset ?? null;
  pendingFocusAfterSync.value = Boolean(options?.focus || options?.focusOffset != null);
  selectedMentionId.value = String(options?.selectedMentionId ?? "").trim();
  emit("update:composeInput", nextDraft.composeInput);
  emit("update:composeFileMentions", nextDraft.composeFileMentions);
}

function syncComposeDraftFromDom() {
  const root = internalComposerInputRef.value;
  if (!root) return;
  const nextDraft = readComposeDraftFromDom(root);
  const prevDraft = getComposeDraftFromProps();
  if (isSameComposeDraft(prevDraft, nextDraft)) {
    applySelectedMentionState();
    return;
  }
  emitComposeDraft(nextDraft, {
    focusOffset: getCurrentSelectionOffset(root),
    focus: document.activeElement === root,
  });
}

function insertTextAtSelection(textValue: string) {
  const root = internalComposerInputRef.value;
  if (!root) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    focusComposerAtLogicalOffset(String(props.composeInput ?? "").length);
  }
  const nextSelection = window.getSelection();
  const range = nextSelection?.rangeCount ? nextSelection.getRangeAt(0) : null;
  if (!range) return;
  range.deleteContents();
  const textNode = document.createTextNode(String(textValue ?? "").replace(/\r\n?/g, "\n"));
  range.insertNode(textNode);
  range.setStart(textNode, textNode.textContent?.length ?? 0);
  range.collapse(true);
  nextSelection?.removeAllRanges();
  nextSelection?.addRange(range);
}

function removeMentionAtIndex(mentionIndexValue: number) {
  if (!Number.isFinite(mentionIndexValue) || mentionIndexValue < 0) return;
  const mentionIndex = Math.round(mentionIndexValue);
  const mentionOffset = findComposeFileTokenOffsetByMentionIndex(props.composeInput, mentionIndex);
  if (mentionOffset < 0) return;
  const nextMentions = props.composeFileMentions.filter((_, index) => index !== mentionIndex);
  const nextInput = `${props.composeInput.slice(0, mentionOffset)}${props.composeInput.slice(mentionOffset + 1)}`;
  emitComposeDraft(
    {
      composeInput: nextInput,
      composeFileMentions: nextMentions,
    },
    {
      focus: true,
      focusOffset: mentionOffset,
    }
  );
}

function getMentionIndexById(mentionIdValue: string): number {
  const mentionId = String(mentionIdValue ?? "").trim();
  if (!mentionId) return -1;
  return props.composeFileMentions.findIndex((mention) => mention.id === mentionId);
}

function insertDroppedFiles(paths: Array<{ path: string }>, offsetValue: number) {
  const offset = Math.max(0, Math.min(String(props.composeInput ?? "").length, Math.round(offsetValue)));
  const insertedMentions = paths
    .map((item) => createComposeFileMention(item.path))
    .filter((item): item is ComposeWorkspaceFileMention => Boolean(item));
  if (insertedMentions.length === 0) return;

  const mentionInsertIndex = countComposeFileTokensBeforeOffset(props.composeInput, offset);
  const nextInput = `${props.composeInput.slice(0, offset)}${COMPOSE_FILE_TOKEN_CHAR.repeat(insertedMentions.length)}${props.composeInput.slice(offset)}`;
  const nextMentions = [
    ...props.composeFileMentions.slice(0, mentionInsertIndex),
    ...insertedMentions,
    ...props.composeFileMentions.slice(mentionInsertIndex),
  ];

  emitComposeDraft(
    {
      composeInput: nextInput,
      composeFileMentions: nextMentions,
    },
    {
      focus: true,
      focusOffset: offset + insertedMentions.length,
    }
  );
}

function getCaretOffsetFromPoint(clientX: number, clientY: number): number {
  const root = internalComposerInputRef.value;
  if (!root) return String(props.composeInput ?? "").length;
  const doc = document as CaretRangeDocument;
  const caretPosition = doc.caretPositionFromPoint?.(clientX, clientY) ?? null;
  if (caretPosition?.offsetNode) {
    return getLogicalOffsetFromDomPoint(root, caretPosition.offsetNode, caretPosition.offset);
  }
  const range = doc.caretRangeFromPoint?.(clientX, clientY) ?? null;
  if (range) {
    return getLogicalOffsetFromDomPoint(root, range.startContainer, range.startOffset);
  }
  return getCurrentSelectionOffset(root);
}

function resetWorkspaceFileDragState() {
  workspaceFileDragDepth.value = 0;
  isWorkspaceFileDragOver.value = false;
}

function onComposerKeydown(event: KeyboardEvent) {
  const root = internalComposerInputRef.value;
  const selection = window.getSelection();
  const isCollapsed = Boolean(selection?.rangeCount && selection.getRangeAt(0).collapsed);

  if (selectedMentionId.value && (event.key === "Backspace" || event.key === "Delete")) {
    event.preventDefault();
    const mentionIndex = getMentionIndexById(selectedMentionId.value);
    selectedMentionId.value = "";
    if (mentionIndex >= 0) removeMentionAtIndex(mentionIndex);
    return;
  }

  if (selectedMentionId.value && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    event.preventDefault();
    const mentionIndex = getMentionIndexById(selectedMentionId.value);
    if (mentionIndex < 0) {
      selectedMentionId.value = "";
      return;
    }
    const mentionOffset = findComposeFileTokenOffsetByMentionIndex(props.composeInput, mentionIndex);
    selectedMentionId.value = "";
    if (mentionOffset >= 0) {
      const nextOffset = event.key === "ArrowLeft" ? mentionOffset : mentionOffset + 1;
      focusComposerAtLogicalOffset(nextOffset);
    }
    return;
  }

  if (root && isCollapsed && (event.key === "Backspace" || event.key === "Delete")) {
    const caretOffset = getCurrentSelectionOffset(root);
    const tokenOffset = event.key === "Backspace" ? caretOffset - 1 : caretOffset;
    if (tokenOffset >= 0 && props.composeInput[tokenOffset] === COMPOSE_FILE_TOKEN_CHAR) {
      event.preventDefault();
      const mentionIndex = countComposeFileTokensBeforeOffset(props.composeInput, tokenOffset);
      removeMentionAtIndex(mentionIndex);
      return;
    }
  }

  if (event.key === "Enter" && event.shiftKey && !event.isComposing) {
    event.preventDefault();
    selectedMentionId.value = "";
    insertTextAtSelection("\n");
    syncComposeDraftFromDom();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
    selectedMentionId.value = "";
  }

  emit("composer-keydown", event);
}

function onComposerPaste(event: ClipboardEvent) {
  emit("composer-paste", event);
  if (event.defaultPrevented) return;

  const text = String(event.clipboardData?.getData("text/plain") ?? "");
  if (!text) return;

  event.preventDefault();
  selectedMentionId.value = "";
  insertTextAtSelection(text);
  syncComposeDraftFromDom();
}

function onComposerInput() {
  selectedMentionId.value = "";
  syncComposeDraftFromDom();
}

function onComposerInputMouseDown(event: MouseEvent) {
  const target =
    event.target instanceof Element ? event.target.closest<HTMLElement>("[data-compose-mention-id]") : null;
  if (!target) {
    if (selectedMentionId.value) {
      selectedMentionId.value = "";
      applySelectedMentionState();
    }
    return;
  }

  event.preventDefault();
  const mentionId = String(target.dataset.composeMentionId ?? "").trim();
  const mentionIndex = getMentionIndexById(mentionId);
  if (mentionIndex < 0) return;
  const mentionOffset = findComposeFileTokenOffsetByMentionIndex(props.composeInput, mentionIndex);
  selectedMentionId.value = mentionId;
  applySelectedMentionState();
  if (mentionOffset >= 0) focusComposerAtLogicalOffset(mentionOffset + 1);
}

function onComposerShellPointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  const input = internalComposerInputRef.value;
  if (!input) return;

  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const interactiveSelector = [
    "button",
    "input",
    "select",
    "option",
    "a",
    '[role="combobox"]',
    '[role="button"]',
    '[role="menuitem"]',
    '[contenteditable="true"]',
  ].join(",");

  if (target.closest(interactiveSelector)) return;

  event.preventDefault();
  selectedMentionId.value = "";
  applySelectedMentionState();
  focusComposerAtLogicalOffset(String(props.composeInput ?? "").length);
}

function onComposerImageInputChange(event: Event) {
  emit("composer-image-change", event);
}

function onComposerDragEnter(event: DragEvent) {
  if (!hasWorkspaceFileDragData(event.dataTransfer)) return;
  event.preventDefault();
  workspaceFileDragDepth.value += 1;
  isWorkspaceFileDragOver.value = true;
}

function onComposerDragOver(event: DragEvent) {
  if (!hasWorkspaceFileDragData(event.dataTransfer)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  isWorkspaceFileDragOver.value = true;
}

function onComposerDragLeave(event: DragEvent) {
  if (!hasWorkspaceFileDragData(event.dataTransfer)) return;
  const currentTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  if (currentTarget && event.relatedTarget instanceof Node && currentTarget.contains(event.relatedTarget)) return;
  workspaceFileDragDepth.value = Math.max(0, workspaceFileDragDepth.value - 1);
  if (workspaceFileDragDepth.value === 0) isWorkspaceFileDragOver.value = false;
}

function onComposerDrop(event: DragEvent) {
  if (!hasWorkspaceFileDragData(event.dataTransfer)) return;
  event.preventDefault();
  const files = readWorkspaceFileDragData(event.dataTransfer);
  resetWorkspaceFileDragState();
  if (files.length === 0) return;
  selectedMentionId.value = "";
  insertDroppedFiles(files, getCaretOffsetFromPoint(event.clientX, event.clientY));
}

function onPreviewAttachment(attachmentId: string) {
  emit("preview-attachment", attachmentId);
}

function onRemoveAttachment(attachmentId: string) {
  emit("remove-attachment", attachmentId);
}

watch(
  () => [props.composeInput, mentionSignature.value] as const,
  () => {
    syncDomFromProps();
  },
  { immediate: true, flush: "post" }
);

watch(selectedMentionId, () => {
  nextTick(() => applySelectedMentionState());
});
</script>
