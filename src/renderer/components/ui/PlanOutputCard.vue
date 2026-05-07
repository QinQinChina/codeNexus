<template>
  <section
    class="plan-output-card grid min-w-0 gap-3 rounded-xl border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] p-3"
    aria-label="计划"
  >
    <header class="flex min-w-0 items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="text-[12px] font-semibold tracking-[0.2px] text-[color:var(--text)]">计划</div>
        <div class="dim text-[11px] leading-[1.35]">解释 / 步骤 / 原文</div>
      </div>
      <div class="flex flex-none items-center gap-2">
        <button class="btn-mini" type="button" :disabled="copyBusy" @click="onCopyRaw">
          {{ copyRawLabel }}
        </button>
      </div>
    </header>

    <div class="grid min-w-0 gap-3">
      <div class="grid min-w-0 gap-1.5">
        <div class="mono dim text-[11px]">解释</div>
        <AgentMarkdownContent class="agent-markdown-body min-w-0" :html="explanationHtml" />
      </div>

      <div class="grid min-w-0 gap-1.5">
        <div class="mono dim text-[11px]">步骤</div>
        <div v-if="steps.length === 0" class="dim text-[12px]">（无）</div>
        <ol v-else class="plan-step-list grid gap-1.5 pl-[18px]">
          <li
            v-for="step in stepsWithTokens"
            :key="`${step.status}:${step.step}`"
            class="plan-step-item grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-[var(--text)]"
            :class="planStepClass(step.status)"
          >
            <span
              class="status inline-flex min-w-[92px] items-center gap-1.5 text-[11px] tracking-[0.1px]"
              :class="planStepStatusTextClass(step.status)"
            >
              <CircleDashed
                v-if="step.status === 'pending'"
                class="plan-step-status-icon h-3 w-3 flex-none [stroke-width:2.2]"
              />
              <span
                v-else-if="step.status === 'inProgress'"
                class="running-indicator is-accent flex-none"
                aria-hidden="true"
              ></span>
              <CheckCircle2 v-else class="plan-step-status-icon h-3 w-3 flex-none [stroke-width:2.2]" />
              <span class="mono">{{ planStepLabelText(step.status) }}</span>
            </span>
            <span class="min-w-0">
              <template v-for="(token, idx) in step.tokens" :key="`token:${idx}`">
                <code
                  v-if="token.kind === 'path'"
                  class="agent-inline-path"
                  role="button"
                  tabindex="0"
                  :data-agent-path-full="fullForPath(token.value)"
                  :title="fullForPath(token.value)"
                  @click.stop="onCopyPathToken(token.value)"
                  @keydown.enter.prevent.stop="onCopyPathToken(token.value)"
                  @keydown.space.prevent.stop="onCopyPathToken(token.value)"
                  >{{ displayForPath(token.value) }}</code
                >
                <span v-else>{{ token.value }}</span>
              </template>
            </span>
          </li>
        </ol>
      </div>

      <DetailDisclosure v-model:open="rawOpen" motion="fade" :keepMounted="true" summaryClass="min-w-0">
        <template #summary="{ open }">
          <div
            class="inline-flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] px-2.5 py-2 transition-[border-color,background] duration-150 hover:border-[var(--ui-code-border-hover)]"
          >
            <span class="mono dim text-[11px]">原文</span>
            <ChevronDown
              class="h-3.5 w-3.5 flex-none text-[var(--text-muted)] transition-[transform,color] duration-200 [stroke-width:2.2]"
              :class="open ? 'rotate-180 text-[var(--text)]' : ''"
            />
          </div>
        </template>
        <div class="mt-2 rounded-lg border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-2.5">
          <AgentMarkdownContent class="agent-markdown-body min-w-0" :html="rawHtml" />
        </div>
      </DetailDisclosure>
    </div>
  </section>
</template>

<script setup lang="ts">
import { CheckCircle2, ChevronDown, CircleDashed } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref } from "vue";
import { renderMarkdownToSafeHtml } from "../../features/timeline/markdownRenderer";
import { useMarkdownRendererRefresh } from "../../features/timeline/useMarkdownRendererRefresh";
import type { PlanStepState, TurnPlanState } from "../../domain/types";
import {
  parsePathToken,
  summarizeParsedPath,
  tokenizePathLikeText,
  type ParsedPathToken,
  type PathHighlightToken,
} from "../../domain/pathHighlight";
import { showToast } from "../../ui/toast";
import AgentMarkdownContent from "./AgentMarkdownContent.vue";
import DetailDisclosure from "./DetailDisclosure.vue";

type CopyState = "idle" | "success" | "error";

const COPY_FEEDBACK_RESET_MS = 1200;

const props = defineProps<{
  rawText: string;
  turnPlan: TurnPlanState | null;
}>();

const explanationText = computed(() => String(props.turnPlan?.explanation ?? "").trim());
const { markdownRendererTick, refreshWhenReady } = useMarkdownRendererRefresh();
const steps = computed<PlanStepState[]>(() => (Array.isArray(props.turnPlan?.plan) ? props.turnPlan?.plan : []) ?? []);
type TokenizedPlanStep = PlanStepState & { tokens: PathHighlightToken[] };
const stepsWithTokens = computed<TokenizedPlanStep[]>(() => {
  return steps.value.map((step) => ({ ...step, tokens: tokenizePathLikeText(step.step) }));
});

const parsedByFull = computed(() => {
  const map = new Map<string, ParsedPathToken>();
  for (const step of stepsWithTokens.value) {
    for (const token of step.tokens) {
      if (token.kind !== "path") continue;
      const full = token.value;
      if (map.has(full)) continue;
      const parsed = parsePathToken(full);
      if (parsed) map.set(full, parsed);
    }
  }
  return map;
});

const basenameCount = computed(() => {
  const counts = new Map<string, number>();
  for (const parsed of parsedByFull.value.values()) {
    const key = parsed.basename.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
});

function segmentCountFor(full: string): number {
  const parsed = parsedByFull.value.get(full);
  if (!parsed) return 1;
  const key = parsed.basename.toLowerCase();
  const collisions = basenameCount.value.get(key) ?? 0;
  if (collisions <= 1) return 1;
  if (parsed.segments.length >= 3) return 2;
  return 1;
}

function displayForPath(full: string): string {
  const parsed = parsedByFull.value.get(full);
  if (!parsed) return full;
  return summarizeParsedPath(parsed, segmentCountFor(full));
}

function fullForPath(full: string): string {
  return parsedByFull.value.get(full)?.full ?? full;
}

function renderMarkdownHtml(text: string) {
  void markdownRendererTick.value;
  const html = renderMarkdownToSafeHtml(text);
  refreshWhenReady();
  return html;
}

const explanationHtml = computed(() => renderMarkdownHtml(explanationText.value || "（无）"));
const rawHtml = computed(() => renderMarkdownHtml(String(props.rawText ?? "").trim() || "（无）"));

const rawOpen = ref(false);

function planStepLabelText(status: PlanStepState["status"]) {
  if (status === "completed") return "已完成";
  if (status === "inProgress") return "进行中";
  return "待处理";
}

function planStepClass(status: PlanStepState["status"]) {
  if (status === "completed") return "text-[color:var(--text)]";
  if (status === "inProgress") return "text-[color:var(--text)]";
  return "text-[color:var(--text-muted)]";
}

function planStepStatusTextClass(status: PlanStepState["status"]) {
  if (status === "completed") return "text-[color:var(--fg-success)]";
  if (status === "inProgress") return "text-[color:var(--fg-accent)]";
  return "text-[color:var(--text-muted)]";
}

async function copyTextToClipboard(text: string) {
  const source = String(text ?? "");
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(source);
    return;
  }
  if (typeof document === "undefined") {
    throw new Error("Clipboard API 不可用");
  }
  const textarea = document.createElement("textarea");
  textarea.value = source;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  const host = document.body ?? document.documentElement;
  host.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand("copy");
    if (!ok) throw new Error("复制失败");
  } finally {
    textarea.remove();
  }
}

const copyBusy = ref(false);
const copyRawState = ref<CopyState>("idle");

let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

function clearCopyResetTimer() {
  if (copyResetTimer == null) return;
  clearTimeout(copyResetTimer);
  copyResetTimer = null;
}

function scheduleCopyReset() {
  clearCopyResetTimer();
  copyResetTimer = setTimeout(() => {
    copyResetTimer = null;
    copyRawState.value = "idle";
  }, COPY_FEEDBACK_RESET_MS);
}

function copyButtonLabel(state: CopyState, idle: string): string {
  if (state === "success") return "已复制";
  if (state === "error") return "复制失败";
  return idle;
}

const copyRawLabel = computed(() => copyButtonLabel(copyRawState.value, "复制原文"));

const onCopyRaw = async () => {
  if (copyBusy.value) return;
  copyBusy.value = true;
  try {
    await copyTextToClipboard(String(props.rawText ?? ""));
    copyRawState.value = "success";
    showToast({ kind: "success", title: "已复制", message: "计划原文已复制到剪贴板" });
  } catch (error) {
    copyRawState.value = "error";
    showToast({ kind: "error", title: "复制失败", message: String((error as any)?.message ?? error ?? "") });
  } finally {
    copyBusy.value = false;
    scheduleCopyReset();
  }
};

const onCopyPathToken = async (full: string) => {
  const source = fullForPath(full);
  if (!source) return;
  if (copyBusy.value) return;
  copyBusy.value = true;
  try {
    await copyTextToClipboard(source);
    showToast({ kind: "success", title: "已复制", message: `路径已复制：${displayForPath(full)}` });
  } catch (error) {
    showToast({ kind: "error", title: "复制失败", message: String((error as any)?.message ?? error ?? "") });
  } finally {
    copyBusy.value = false;
  }
};

onBeforeUnmount(() => {
  clearCopyResetTimer();
});
</script>
