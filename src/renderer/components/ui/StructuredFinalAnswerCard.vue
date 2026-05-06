<template>
  <section
    class="structured-final-answer-card grid min-w-0 gap-3 rounded-xl border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] p-3"
    aria-label="结构化最终答复"
  >
    <header class="flex min-w-0 items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="text-[12px] font-semibold tracking-[0.2px] text-[color:var(--text)]">结构化答复</div>
        <div class="dim text-[11px] leading-[1.35]">总结 / 变更 / 命令 / 下一步</div>
      </div>
      <div class="flex flex-none items-center gap-2">
        <button class="btn-mini" type="button" :disabled="copyBusy" @click="onCopyMarkdown">
          {{ copyMarkdownLabel }}
        </button>
        <button class="btn-mini" type="button" :disabled="copyBusy" @click="onCopyCommands">
          {{ copyCommandsLabel }}
        </button>
        <button class="btn-mini" type="button" :disabled="copyBusy" @click="onCopyJson">
          {{ copyJsonLabel }}
        </button>
      </div>
    </header>

    <div class="grid min-w-0 gap-3">
      <div class="grid min-w-0 gap-1.5">
        <div class="mono dim text-[11px]">总结</div>
        <AgentMarkdownContent class="agent-markdown-body min-w-0" :html="summaryHtml" />
      </div>

      <div class="grid min-w-0 gap-1.5">
        <div class="mono dim text-[11px]">变更</div>
        <AgentMarkdownContent class="agent-markdown-body min-w-0" :html="changesHtml" />
      </div>

      <div class="grid min-w-0 gap-1.5">
        <div class="mono dim text-[11px]">命令</div>
        <div v-if="commands.length === 0" class="dim text-[12px]">（无）</div>
        <div v-else class="grid min-w-0 gap-2">
          <div
            v-for="(cmd, idx) in commands"
            :key="`cmd:${idx}`"
            class="row min-w-0 items-start gap-2 rounded-lg border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] px-2 py-1.5"
          >
            <code
              class="mono min-w-0 flex-1 text-[11px] leading-[1.45] text-[var(--ui-code-text)] whitespace-pre-wrap [overflow-wrap:anywhere] break-words"
              >{{ cmd }}</code
            >
            <button class="btn-mini flex-none" type="button" :disabled="copyBusy" @click="onCopySingleCommand(cmd)">
              复制
            </button>
          </div>
        </div>
      </div>

      <div class="grid min-w-0 gap-1.5">
        <div class="mono dim text-[11px]">下一步</div>
        <AgentMarkdownContent class="agent-markdown-body min-w-0" :html="nextStepsHtml" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { showToast } from "../../ui/toast";
import { renderMarkdownToSafeHtml } from "../../features/timeline/markdownRenderer";
import { useMarkdownRendererRefresh } from "../../features/timeline/useMarkdownRendererRefresh";
import AgentMarkdownContent from "./AgentMarkdownContent.vue";
import {
  structuredFinalAnswerToMarkdownV1,
  tryParseStructuredFinalAnswerV1,
  type StructuredFinalAnswerV1,
} from "../../domain/structuredFinalAnswer";

type CopyState = "idle" | "success" | "error";

const COPY_FEEDBACK_RESET_MS = 1200;

const props = defineProps<{
  rawText: string;
}>();

const parsed = computed(() => tryParseStructuredFinalAnswerV1(props.rawText));
const { markdownRendererTick, refreshWhenReady } = useMarkdownRendererRefresh();

const answer = computed((): StructuredFinalAnswerV1 => {
  // 该组件应仅在上层确认 parse 成功后渲染；这里做兜底避免崩溃。
  return (
    parsed.value ?? {
      type: "codenexus.final_answer.v1",
      summary: "",
      changes: [],
      commands: [],
      next_steps: [],
    }
  );
});

function toMarkdownList(items: string[]): string {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  if (normalized.length === 0) return "- （无）";
  return normalized.map((item) => `- ${item}`).join("\n");
}

const commands = computed(() => {
  return (Array.isArray(answer.value.commands) ? answer.value.commands : [])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
});

function renderMarkdownHtml(text: string) {
  void markdownRendererTick.value;
  const html = renderMarkdownToSafeHtml(text);
  refreshWhenReady();
  return html;
}

const summaryHtml = computed(() => renderMarkdownHtml(String(answer.value.summary ?? "").trim() || "（无）"));
const changesHtml = computed(() => renderMarkdownHtml(toMarkdownList(answer.value.changes)));
const nextStepsHtml = computed(() => renderMarkdownHtml(toMarkdownList(answer.value.next_steps)));

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
const copyMarkdownState = ref<CopyState>("idle");
const copyCommandsState = ref<CopyState>("idle");
const copyJsonState = ref<CopyState>("idle");

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
    copyMarkdownState.value = "idle";
    copyCommandsState.value = "idle";
    copyJsonState.value = "idle";
  }, COPY_FEEDBACK_RESET_MS);
}

function copyButtonLabel(state: CopyState, idle: string): string {
  if (state === "success") return "已复制";
  if (state === "error") return "复制失败";
  return idle;
}

const copyMarkdownLabel = computed(() => copyButtonLabel(copyMarkdownState.value, "复制 Markdown"));
const copyCommandsLabel = computed(() => copyButtonLabel(copyCommandsState.value, "复制命令"));
const copyJsonLabel = computed(() => copyButtonLabel(copyJsonState.value, "复制 JSON"));

async function withCopyFeedback(stateRef: { value: CopyState }, text: string, okToast?: string) {
  if (copyBusy.value) return;
  copyBusy.value = true;
  try {
    await copyTextToClipboard(text);
    stateRef.value = "success";
    if (okToast) showToast({ kind: "success", title: "已复制", message: okToast });
  } catch (error) {
    stateRef.value = "error";
    showToast({ kind: "error", title: "复制失败", message: String((error as any)?.message ?? error ?? "") });
  } finally {
    copyBusy.value = false;
    scheduleCopyReset();
  }
}

const onCopyMarkdown = async () => {
  await withCopyFeedback(copyMarkdownState, structuredFinalAnswerToMarkdownV1(answer.value));
};

const onCopyCommands = async () => {
  const text = commands.value.length > 0 ? commands.value.join("\n") : "";
  await withCopyFeedback(copyCommandsState, text, "命令已复制到剪贴板");
};

const onCopyJson = async () => {
  await withCopyFeedback(copyJsonState, JSON.stringify(answer.value, null, 2));
};

const onCopySingleCommand = async (cmd: string) => {
  if (copyBusy.value) return;
  copyBusy.value = true;
  try {
    await copyTextToClipboard(cmd);
    showToast({ kind: "success", title: "已复制", message: "命令已复制到剪贴板" });
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
