<template>
  <div v-if="hasPendingUserInput" class="grid gap-2.5" :class="rootClass" role="region" aria-label="计划问答">
    <div class="row" style="align-items: baseline; justify-content: space-between; gap: 10px">
      <div class="row" style="align-items: center; gap: 8px">
        <span class="attn-dot" aria-hidden="true"></span>
        <div class="text-[12px] font-semibold tracking-[0.2px] text-[color:var(--text)]">计划问答</div>
      </div>
      <span class="mono dim text-[11px]">{{ userInputQueueText }}</span>
    </div>

    <div :id="userInputBoxId" :class="{ dim: !activeUserInputPrompt }">
      <template v-if="!activeUserInputPrompt"> 当前无待回答问题 </template>
      <template v-else>
        <div class="user-input-card">
          <div class="user-input-head">
            <div class="user-input-header">{{ userInputHeaderText }}</div>
            <div class="user-input-progress mono dim">{{ userInputProgressText }}</div>
          </div>
          <div class="user-input-question">{{ userInputQuestionText }}</div>
          <div
            v-if="activeUserInputPrompt.kind === 'elicitationUrl'"
            class="grid gap-2 rounded-xl border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] p-2"
          >
            <div class="dim text-[11px]">请在浏览器中完成外部确认，然后回到这里继续。</div>
            <div class="mono text-[11px] break-all">{{ activeUserInputPrompt.url }}</div>
          </div>
          <pre
            v-else-if="activeUserInputPrompt.kind === 'elicitationForm' && elicitationSchemaText"
            class="mono max-h-[180px] overflow-auto app-scrollbar rounded-xl border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-2 text-[11px] whitespace-pre-wrap [overflow-wrap:anywhere] break-words"
            >{{ elicitationSchemaText }}</pre
          >
          <div v-if="activeUserInputQuestion && activeUserInputQuestion.options.length > 0" class="user-input-options">
            <button
              v-for="(option, optionIndex) in activeUserInputQuestion.options"
              :key="`${activeUserInputQuestion.id}:${option.label}:${optionIndex}`"
              :ref="(el) => setUserInputOptionRef(optionIndex, el)"
              type="button"
              class="user-input-option"
              :class="{ selected: userInputSelectedOption(activeUserInputQuestion) === option.label }"
              @click="onUserInputOptionSelect(activeUserInputQuestion, option.label)"
              @keydown="onUserInputOptionKeydown(activeUserInputQuestion, optionIndex, $event)"
            >
              <span>{{ option.label }}</span>
              <span v-if="option.description" class="user-input-option-description">{{ option.description }}</span>
            </button>
          </div>
          <textarea
            v-if="isMultilineUserInput && activeUserInputQuestion"
            :ref="setUserInputTextRef"
            class="user-input-text"
            rows="6"
            :placeholder="userInputTextPlaceholder"
            :value="userInputFreeText(activeUserInputQuestion)"
            @input="onUserInputTextChanged(activeUserInputQuestion, $event)"
          />
          <input
            v-else-if="
              activeUserInputQuestion &&
              (activeUserInputQuestion.isOther ||
                activeUserInputQuestion.options.length === 0 ||
                activeUserInputQuestion.isSecret)
            "
            :ref="setUserInputTextRef"
            class="user-input-text"
            :type="activeUserInputQuestion.isSecret ? 'password' : 'text'"
            :placeholder="userInputTextPlaceholder"
            :value="userInputFreeText(activeUserInputQuestion)"
            @input="onUserInputTextChanged(activeUserInputQuestion, $event)"
            @keydown="onUserInputTextKeydown($event)"
          />
          <div class="user-input-actions">
            <button type="button" class="danger" @click="onCancelActivePrompt">取消</button>
            <button
              v-if="activeUserInputPrompt.kind === 'elicitationUrl'"
              type="button"
              @click="runtime.openExternalUrl(activeUserInputPrompt.url)"
            >
              打开链接
            </button>
            <button v-else type="button" :disabled="!canGoPrevUserInputStep" @click="onUserInputPrevStep">
              上一步
            </button>
            <button type="button" :disabled="!canGoNextUserInputStep" @click="onUserInputNextStep">
              {{ userInputSubmitText }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { getRuntimeOrchestrator } from "../../domain/runtimeOrchestrator";
import type { UserInputQuestion } from "../../domain/types";
import { useRuntimeStore } from "../../stores/runtime.store";
import { useUserInputStore } from "../../stores/userInput.store";
import { safeJsonStringify } from "../../utils/safeJson";

const props = defineProps<{
  threadId?: string;
  variant?: "composer" | "panel";
}>();

const runtime = getRuntimeOrchestrator();
const runtimeStore = useRuntimeStore();
const userInputStore = useUserInputStore();
const userInputOptionRefs = new Map<number, HTMLButtonElement>();
const userInputTextRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);
const rememberedSelectedOptionByQuestion = new Map<string, string>();

type UserInputKeyboardTarget = {
  key: string;
  kind: "option" | "textInput";
  optionIndex?: number;
};

function optionTargetKey(optionIndex: number): string {
  return `option:${optionIndex}`;
}

const resolvedThreadId = computed(() => {
  if (props.threadId !== undefined) return String(props.threadId ?? "").trim();
  return String(runtimeStore.currentThreadId ?? "").trim();
});

const rootClass = computed(() => {
  return props.variant === "panel" ? "" : "border-b border-[color:var(--composer-divider)] pb-2";
});

const userInputBoxId = computed(() => {
  const tid = resolvedThreadId.value || "no-thread";
  return `user-input-box:${tid}`;
});

function questionStateKey(question: UserInputQuestion): string {
  const requestId = String(activeUserInputPrompt.value?.requestId ?? "").trim();
  const threadId = String(resolvedThreadId.value ?? "").trim();
  return `${threadId}:${requestId}:${question.id}`;
}

function setUserInputOptionRef(optionIndex: number, el: Element | null) {
  if (el instanceof HTMLButtonElement) {
    userInputOptionRefs.set(optionIndex, el);
    return;
  }
  userInputOptionRefs.delete(optionIndex);
}

function setUserInputTextRef(el: Element | null) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    userInputTextRef.value = el;
    return;
  }
  userInputTextRef.value = null;
}

const threadUserInputQueueSize = computed(() => {
  const tid = resolvedThreadId.value;
  if (!tid) return 0;
  return userInputStore.queueSizeForThread(tid);
});

const hasPendingUserInput = computed(() => threadUserInputQueueSize.value > 0);

const activeUserInputPrompt = computed(() => {
  const tid = resolvedThreadId.value;
  if (!tid) return null;
  return userInputStore.activePromptForThread(tid);
});

const activeUserInputQuestion = computed(() => {
  const prompt = activeUserInputPrompt.value;
  if (!prompt || prompt.questions.length === 0) return null;
  const tid = resolvedThreadId.value;
  const step = tid ? userInputStore.activeStepForThread(tid) : 0;
  const max = Math.max(0, prompt.questions.length - 1);
  const idx = Math.max(0, Math.min(step, max));
  return prompt.questions[idx] ?? null;
});

const userInputProgressText = computed(() => {
  const prompt = activeUserInputPrompt.value;
  if (!prompt) return "0/0";
  if (prompt.kind === "elicitationUrl") return "链接确认";
  if (prompt.kind === "elicitationForm") return "JSON 输入";
  if (prompt.questions.length === 0) return "0/0";
  const tid = resolvedThreadId.value;
  const step = tid ? userInputStore.activeStepForThread(tid) : 0;
  const total = prompt.questions.length;
  const idx = Math.max(0, Math.min(step, total - 1));
  return `${idx + 1}/${total}`;
});

const userInputHeaderText = computed(() => {
  const prompt = activeUserInputPrompt.value;
  if (!prompt) return "";
  if (prompt.kind === "elicitationForm" || prompt.kind === "elicitationUrl") {
    return `MCP · ${prompt.serverName}`;
  }
  return activeUserInputQuestion.value?.header ?? "";
});

const userInputQuestionText = computed(() => {
  const prompt = activeUserInputPrompt.value;
  if (!prompt) return "";
  if (prompt.kind === "elicitationForm" || prompt.kind === "elicitationUrl") {
    return prompt.message;
  }
  return activeUserInputQuestion.value?.question ?? "";
});

const elicitationSchemaText = computed(() => {
  const prompt = activeUserInputPrompt.value;
  if (!prompt || prompt.kind !== "elicitationForm") return "";
  return safeJsonStringify(prompt.requestedSchema ?? null, { space: 2 });
});

const isMultilineUserInput = computed(() => activeUserInputPrompt.value?.kind === "elicitationForm");

const questionHasTextInput = computed(() => {
  const question = activeUserInputQuestion.value;
  if (!question) return false;
  if (activeUserInputPrompt.value?.kind === "elicitationForm") return true;
  return question.isOther || question.options.length === 0 || question.isSecret;
});

const userInputTextPlaceholder = computed(() => {
  const prompt = activeUserInputPrompt.value;
  const question = activeUserInputQuestion.value;
  if (prompt?.kind === "elicitationForm") return '请输入 JSON，例如 {"key":"value"}';
  if (!question) return "";
  return question.isOther ? "请输入其他内容" : "请输入答案";
});

const canGoPrevUserInputStep = computed(() => {
  const prompt = activeUserInputPrompt.value;
  if (!prompt) return false;
  if (prompt.kind !== "questions") return false;
  const tid = resolvedThreadId.value;
  if (!tid) return false;
  return userInputStore.activeStepForThread(tid) > 0;
});

const canGoNextUserInputStep = computed(() => {
  const prompt = activeUserInputPrompt.value;
  if (!prompt) return false;
  if (prompt.kind === "elicitationUrl") return true;
  const question = activeUserInputQuestion.value;
  if (!question) return false;
  const tid = resolvedThreadId.value;
  if (!tid) return false;
  return userInputStore.isQuestionAnswered(tid, question.id);
});

const isLastUserInputQuestion = computed(() => {
  const prompt = activeUserInputPrompt.value;
  if (!prompt) return false;
  if (prompt.kind !== "questions") return true;
  const tid = resolvedThreadId.value;
  if (!tid) return false;
  return userInputStore.activeStepForThread(tid) >= prompt.questions.length - 1;
});

const userInputSubmitText = computed(() => {
  const prompt = activeUserInputPrompt.value;
  if (!prompt) return "提交";
  if (prompt.kind === "elicitationUrl") return "已完成";
  if (prompt.kind === "elicitationForm") return "提交 JSON";
  return isLastUserInputQuestion.value ? "提交" : "下一步";
});

const userInputQueueText = computed(() => {
  const n = threadUserInputQueueSize.value;
  return n > 0 ? `待输入 ${n}` : "0";
});

const activeUserInputKeyboardTargets = computed<UserInputKeyboardTarget[]>(() => {
  const prompt = activeUserInputPrompt.value;
  const question = activeUserInputQuestion.value;
  if (!prompt || prompt.kind !== "questions" || !question) return [];
  const targets: UserInputKeyboardTarget[] = question.options.map((_, optionIndex) => ({
    key: optionTargetKey(optionIndex),
    kind: "option",
    optionIndex,
  }));
  if (questionHasTextInput.value) targets.push({ key: "textInput", kind: "textInput" });
  return targets;
});

const userInputSelectedOptionIndex = (question: UserInputQuestion) => {
  const selectedLabel = userInputSelectedOption(question);
  if (!selectedLabel) return -1;
  return question.options.findIndex((option) => option.label === selectedLabel);
};

const userInputSelectedOption = (question: UserInputQuestion) => {
  const prompt = activeUserInputPrompt.value;
  if (!prompt) return "";
  const tid = resolvedThreadId.value;
  if (!tid) return "";
  const answers = userInputStore.getDraft(tid, prompt.requestId, question.id);
  return question.options.find((option) => answers.includes(option.label))?.label ?? "";
};

const userInputFreeText = (question: UserInputQuestion) => {
  const prompt = activeUserInputPrompt.value;
  if (!prompt) return "";
  const tid = resolvedThreadId.value;
  if (!tid) return "";
  const answers = userInputStore.getDraft(tid, prompt.requestId, question.id);
  return (
    answers.find((answer) => !question.options.some((option) => option.label === answer)) ??
    (question.options.length === 0 ? (answers[0] ?? "") : "")
  );
};

const rememberedSelectedOption = (question: UserInputQuestion) =>
  rememberedSelectedOptionByQuestion.get(questionStateKey(question)) ?? "";

const rememberSelectedOption = (question: UserInputQuestion, label: string) => {
  const normalized = String(label ?? "").trim();
  if (!normalized) return;
  rememberedSelectedOptionByQuestion.set(questionStateKey(question), normalized);
};

const syncRememberedSelectedOption = (question: UserInputQuestion | null | undefined) => {
  if (!question) return;
  const selectedLabel = userInputSelectedOption(question);
  if (!selectedLabel) return;
  rememberSelectedOption(question, selectedLabel);
};

const focusUserInputTarget = (targetKey: string) => {
  if (!targetKey) return false;
  if (targetKey === "textInput") {
    if (!userInputTextRef.value) return false;
    userInputTextRef.value.focus({ preventScroll: true });
    return true;
  }
  if (!targetKey.startsWith("option:")) return false;
  const optionIndex = Number.parseInt(targetKey.slice("option:".length), 10);
  const optionEl = Number.isFinite(optionIndex) ? (userInputOptionRefs.get(optionIndex) ?? null) : null;
  if (!optionEl) return false;
  optionEl.focus({ preventScroll: true });
  return true;
};

const scheduleFocusUserInputTarget = (targetKey: string) => {
  if (!targetKey) return;
  void nextTick(() => {
    focusUserInputTarget(targetKey);
  });
};

const deriveInitialUserInputTargetKey = (question: UserInputQuestion | null | undefined) => {
  if (!question) return "";
  const freeText = userInputFreeText(question);
  if (questionHasTextInput.value && freeText) return "textInput";
  const selectedOptionIndex = userInputSelectedOptionIndex(question);
  if (selectedOptionIndex >= 0) return optionTargetKey(selectedOptionIndex);
  if (question.options.length > 0) return optionTargetKey(0);
  if (questionHasTextInput.value) return "textInput";
  return "";
};

const moveUserInputFocus = (fromTargetKey: string, delta: -1 | 1) => {
  const question = activeUserInputQuestion.value;
  if (!question) return;
  const targets = activeUserInputKeyboardTargets.value;
  if (targets.length === 0) return;
  const currentIndex = targets.findIndex((target) => target.key === fromTargetKey);
  if (currentIndex < 0) return;
  const nextIndex = currentIndex + delta;
  if (nextIndex < 0 || nextIndex >= targets.length) return;
  const nextTarget = targets[nextIndex] ?? null;
  if (!nextTarget) return;
  if (nextTarget.kind === "option" && Number.isFinite(nextTarget.optionIndex)) {
    const nextOption = question.options[nextTarget.optionIndex!];
    if (nextOption?.label) onUserInputOptionSelect(question, nextOption.label);
  }
  scheduleFocusUserInputTarget(nextTarget.key);
};

const onUserInputOptionSelect = (question: UserInputQuestion, label: string) => {
  const prompt = activeUserInputPrompt.value;
  const tid = resolvedThreadId.value;
  if (!prompt || !tid) return;
  rememberSelectedOption(question, label);
  userInputStore.setDraft(tid, prompt.requestId, question.id, [label]);
};

const onUserInputTextChanged = (question: UserInputQuestion, event: Event) => {
  const prompt = activeUserInputPrompt.value;
  const tid = resolvedThreadId.value;
  if (!prompt || !tid) return;
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
  const rawValue = String(target?.value ?? "").trim();
  const selectedOption = rememberedSelectedOption(question);
  if (!rawValue) {
    if (selectedOption) userInputStore.setDraft(tid, prompt.requestId, question.id, [selectedOption]);
    else userInputStore.setDraft(tid, prompt.requestId, question.id, []);
    return;
  }
  userInputStore.setDraft(tid, prompt.requestId, question.id, [rawValue]);
};

const onUserInputOptionKeydown = async (question: UserInputQuestion, optionIndex: number, event: KeyboardEvent) => {
  const prompt = activeUserInputPrompt.value;
  if (!prompt || prompt.kind !== "questions") return;
  const option = question.options[optionIndex] ?? null;
  if (!option?.label) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveUserInputFocus(optionTargetKey(optionIndex), 1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveUserInputFocus(optionTargetKey(optionIndex), -1);
    return;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    onUserInputPrevStep();
    return;
  }
  if (event.key === "ArrowRight" || event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    onUserInputOptionSelect(question, option.label);
    await onUserInputNextStep();
  }
};

const onUserInputTextKeydown = async (event: KeyboardEvent) => {
  const prompt = activeUserInputPrompt.value;
  if (!prompt || prompt.kind !== "questions" || isMultilineUserInput.value) return;
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveUserInputFocus("textInput", -1);
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveUserInputFocus("textInput", 1);
    return;
  }
  if (event.key !== "Enter" || event.isComposing) return;
  if (!canGoNextUserInputStep.value) return;
  event.preventDefault();
  event.stopPropagation();
  await onUserInputNextStep();
};

const onCancelActivePrompt = async () => {
  const tid = resolvedThreadId.value;
  if (!tid) return;
  await runtime.cancelUserInputPromptForThread(tid);
};

const onUserInputPrevStep = () => {
  const tid = resolvedThreadId.value;
  if (!tid) return;
  userInputStore.prevStep(tid);
};

const onUserInputNextStep = async () => {
  const tid = resolvedThreadId.value;
  if (!tid) return;
  const prompt = activeUserInputPrompt.value;
  if (!prompt) return;
  if (prompt.kind !== "elicitationUrl" && !canGoNextUserInputStep.value) return;
  if (prompt.kind === "elicitationUrl") {
    await runtime.submitUserInputPromptForThread(tid);
    return;
  }
  if (!isLastUserInputQuestion.value) {
    userInputStore.nextStep(tid);
    return;
  }
  await runtime.submitUserInputPromptForThread(tid);
};

watch(
  () =>
    [
      resolvedThreadId.value,
      hasPendingUserInput.value,
      activeUserInputPrompt.value?.requestId ?? "",
      activeUserInputQuestion.value?.id ?? "",
    ] as const,
  () => {
    const prompt = activeUserInputPrompt.value;
    const question = activeUserInputQuestion.value;
    if (!prompt || prompt.kind !== "questions" || !question) return;
    syncRememberedSelectedOption(question);
    scheduleFocusUserInputTarget(deriveInitialUserInputTargetKey(question));
  },
  { immediate: true, flush: "post" }
);
</script>
