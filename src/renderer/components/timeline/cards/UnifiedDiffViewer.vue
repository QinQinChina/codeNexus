<template>
  <div>
    <div v-if="parsed.truncated && showTruncatedHint" class="mono dim mb-1.5 text-[11px]">Diff 过大，已截断展示。</div>
    <div
      class="unified-diff-scroll app-scrollbar overflow-auto rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] text-[var(--ui-code-text)]"
      :class="[maxHeightClass, compact ? '' : '']"
      role="table"
      :aria-label="ariaLabel"
    >
      <template v-for="(line, idx) in parsed.lines" :key="`${diffKey}:${idx}`">
        <div v-if="line.kind === 'hunk'" aria-hidden="true">
          <div :class="compact ? 'h-[6px]' : 'h-[8px]'"></div>
        </div>
        <div
          v-else
          class="grid items-start py-[1px]"
          :class="[gridLayoutClass, diffLineClass(displayLineKind(line))]"
        >
          <span
            class="mono select-none pt-[1px] text-right text-[var(--ui-code-text-muted)] opacity-60"
            >{{ visibleNewNo(line) }}</span
          >
          <span v-if="line.kind === 'meta'" :class="metaLineClass">{{ line.text }}</span>
          <span
            v-else
            :class="[rowContentBaseClass, compact ? 'gap-1' : 'gap-1.5', lineContentClass(displayLineKind(line))]"
          >
            <span
              class="flex-none select-none pt-[1px] text-center text-[var(--ui-code-text-muted)] opacity-85"
              :class="[compact ? 'w-[8px]' : 'w-[9px]', linePrefixClass(displayLineKind(line))]"
              >{{ linePrefix(displayLineKind(line)) }}</span
            >
            <span v-if="tokensForLine(idx).length > 0" :class="tokenLineClass">
              <span
                v-for="(token, tokenIdx) in tokensForLine(idx)"
                :key="`${diffKey}:${idx}:tok:${tokenIdx}`"
                :style="token.style"
                >{{ token.content }}</span
              >
            </span>
            <span v-else :class="plainLineClass">{{ lineContent(line, displayLineKind(line)) }}</span>
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getParsedDiffCached, type DiffLine } from "../../../features/timeline/renderModel/diff";
import {
  highlightDiffTokens,
  type DiffHighlightToken,
  type DiffHighlightTone,
} from "../../../features/timeline/renderModel/diffSyntaxHighlight";
import { diffLineClass } from "../../../features/timeline/renderModel/formatters";

const props = withDefaults(
  defineProps<{
    diffText: string;
    ariaLabel?: string;
    maxHeightClass?: string;
    showTruncatedHint?: boolean;
    diffKey?: string;
    compact?: boolean;
    filePathHint?: string;
    fileKind?: string;
    wrapLines?: boolean;
  }>(),
  {
    ariaLabel: "diff-view",
    maxHeightClass: "max-h-[340px]",
    showTruncatedHint: true,
    diffKey: "diff",
    compact: false,
    filePathHint: "",
    fileKind: "",
    wrapLines: true,
  }
);

const parsed = computed(() => getParsedDiffCached(props.diffText));
const highlightedTokensByLine = ref<Record<number, DiffHighlightToken[]>>({});
const tone = ref<DiffHighlightTone>("dark");
let toneObserver: MutationObserver | null = null;
let highlightTaskSeq = 0;

const gridLayoutClass = computed(() => {
  const cols = props.wrapLines
    ? props.compact
      ? "grid-cols-[24px_minmax(0,1fr)]"
      : "grid-cols-[30px_minmax(0,1fr)]"
    : props.compact
      ? "grid-cols-[24px_max-content]"
      : "grid-cols-[30px_max-content]";
  const layout = props.compact ? "gap-1 text-[10.5px] leading-[1.34]" : "gap-1.5 text-[11px] leading-[1.4]";
  const width = props.wrapLines ? "" : "min-w-full w-max";
  return `${cols} ${layout} ${width}`.trim();
});

const rowContentBaseClass = computed(() =>
  props.wrapLines ? "mono flex min-w-0 items-start" : "mono flex items-start min-w-full w-max"
);

const metaLineClass = computed(() =>
  props.wrapLines ? "mono whitespace-pre break-words [overflow-wrap:anywhere]" : "mono whitespace-pre w-max min-w-full"
);

const tokenLineClass = computed(() =>
  props.wrapLines
    ? "min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
    : "flex-none whitespace-pre w-max"
);

const plainLineClass = computed(() =>
  props.wrapLines ? "min-w-0 whitespace-pre break-words [overflow-wrap:anywhere]" : "flex-none whitespace-pre w-max"
);

const readTone = (): DiffHighlightTone => {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-tone") === "light" ? "light" : "dark";
};

onMounted(() => {
  tone.value = readTone();
  if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
  toneObserver = new MutationObserver(() => {
    tone.value = readTone();
  });
  toneObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-tone"],
  });
});

onBeforeUnmount(() => {
  toneObserver?.disconnect();
  toneObserver = null;
});

watch(
  () => [props.diffText, props.filePathHint, tone.value] as const,
  async ([diffText, filePathHint, toneValue]) => {
    const seq = ++highlightTaskSeq;
    if (!String(diffText ?? "").trim()) {
      highlightedTokensByLine.value = {};
      return;
    }
    try {
      const next = await highlightDiffTokens({
        diffText,
        filePathHint,
        tone: toneValue,
      });
      if (seq !== highlightTaskSeq) return;
      highlightedTokensByLine.value = next;
    } catch {
      if (seq !== highlightTaskSeq) return;
      highlightedTokensByLine.value = {};
    }
  },
  { immediate: true }
);

const tokensForLine = (index: number) => highlightedTokensByLine.value[index] ?? [];

const isRawAddedFile = computed(() => props.fileKind === "add" && !parsed.value.isUnified);

const displayLineKind = (line: DiffLine): DiffLine["kind"] => {
  if (isRawAddedFile.value && line.kind === "ctx") return "add";
  return line.kind;
};

const visibleNewNo = (line: DiffLine) => {
  const kind = displayLineKind(line);
  if (kind === "meta" || kind === "hunk") return "";
  if (kind === "add" && line.newNo == null) return line.oldNo ?? "";
  return line.newNo ?? "";
};

const linePrefix = (kind: DiffLine["kind"]) => {
  if (kind === "add") return "+";
  if (kind === "del") return "-";
  return "";
};

const linePrefixClass = (kind: DiffLine["kind"]) => {
  if (kind === "add") {
    return "font-semibold !text-[var(--fg-success)] opacity-95";
  }
  if (kind === "del") {
    return "font-semibold !text-[var(--fg-danger)] opacity-95";
  }
  return "";
};

const lineContentClass = (kind: DiffLine["kind"]) => {
  if (kind === "add") {
    return "!text-[var(--fg-success)] opacity-95";
  }
  if (kind === "del") {
    return "!text-[var(--fg-danger)] opacity-95";
  }
  return "";
};

const lineContent = (line: DiffLine, kind = displayLineKind(line)) => {
  const text = String(line.text ?? "");
  if (line.kind === "add" || line.kind === "del") {
    return /^[+-]/.test(text) ? text.slice(1) : text;
  }
  if (kind === "ctx") {
    return text.startsWith(" ") ? text.slice(1) : text;
  }
  return text;
};
</script>
