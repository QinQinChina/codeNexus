<template>
  <div>
    <div v-if="parsed.truncated && showTruncatedHint" class="mono dim mb-1.5 text-[11px]">
      {{ t("diffViewer.truncated") }}
    </div>
    <div
      ref="scrollEl"
      class="unified-diff-scroll app-scrollbar overflow-auto rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] text-[var(--ui-code-text)]"
      :class="[maxHeightClass, compact ? '' : '', { 'is-stream-locked': animateUpdates }]"
      role="table"
      :aria-label="ariaLabel"
      @wheel="onLockedScrollInput"
      @touchmove="onLockedScrollInput"
    >
      <template v-for="row in renderedLines" :key="row.domKey">
        <div v-if="row.line.kind === 'hunk'" aria-hidden="true">
          <div :class="compact ? 'h-[6px]' : 'h-[8px]'"></div>
        </div>
        <div
          v-else
          class="grid items-start py-[1px]"
          :class="[gridLayoutClass, diffLineClass(displayLineKind(row.line))]"
          :data-line-key="row.lineKey"
        >
          <span class="mono select-none pt-[1px] text-right text-[var(--ui-code-text-muted)] opacity-60">{{
            visibleNewNo(row.line)
          }}</span>
          <span v-if="row.line.kind === 'meta'" :class="metaLineClass">{{ row.line.text }}</span>
          <span
            v-else
            :class="[rowContentBaseClass, compact ? 'gap-1' : 'gap-1.5', lineContentClass(displayLineKind(row.line))]"
          >
            <span
              class="flex-none select-none pt-[1px] text-center text-[var(--ui-code-text-muted)] opacity-85"
              :class="[compact ? 'w-[8px]' : 'w-[9px]', linePrefixClass(displayLineKind(row.line))]"
              >{{ linePrefix(displayLineKind(row.line)) }}</span
            >
            <span v-if="shouldRenderTokensForRow(row)" :class="tokenLineClass">
              <span
                v-for="(token, tokenIdx) in visibleTokensForRow(row)"
                :key="`${row.domKey}:tok:${tokenIdx}`"
                :style="token.style"
                >{{ token.content }}</span
              >
            </span>
            <span v-else :class="plainLineClass">{{ visibleLineContent(row) }}</span>
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
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
    animateUpdates?: boolean;
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
    animateUpdates: false,
  }
);

const { t } = useI18n();
const parsed = computed(() => getParsedDiffCached(props.diffText));
const highlightedTokensByLine = ref<Record<number, DiffHighlightToken[]>>({});
const tone = ref<DiffHighlightTone>("dark");
const revealCharsByLineKey = ref(new Map<string, number>());
const scrollEl = ref<HTMLElement | null>(null);
let toneObserver: MutationObserver | null = null;
let highlightTaskSeq = 0;
let revealFrameId: number | null = null;
let scrollFrameId: number | null = null;
let scrollAnimationFrameId: number | null = null;
let previousDiffKey = "";
let previousLineKeys = new Set<string>();
let lastPatchAtMs = 0;
let lastStreamScrollAtMs = 0;
let streamScrollFloorTop = 0;
const STREAM_SCROLL_MIN_INTERVAL_MS = 32;

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
  stopRevealAnimation();
  stopScheduledScroll();
  stopScrollAnimation();
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

const isRawFileChange = computed(() => !parsed.value.isUnified);

const rawLineKindFromPrefix = (line: DiffLine): DiffLine["kind"] | null => {
  if (line.kind !== "ctx") return null;
  const text = String(line.text ?? "");
  if (text.startsWith("+") && !text.startsWith("+++")) return "add";
  if (text.startsWith("-") && !text.startsWith("---")) return "del";
  return null;
};

const displayLineKind = (line: DiffLine): DiffLine["kind"] => {
  const prefixed = rawLineKindFromPrefix(line);
  if (prefixed) return prefixed;
  if (isRawFileChange.value && line.kind === "ctx") {
    if (props.fileKind === "add") return "add";
    if (props.fileKind === "delete") return "del";
  }
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
  if (kind === "add" || kind === "del") {
    if (line.kind === "add" || line.kind === "del" || rawLineKindFromPrefix(line)) {
      return /^[+-]/.test(text) ? text.slice(1) : text;
    }
    return text;
  }
  if (kind === "ctx") {
    return text.startsWith(" ") ? text.slice(1) : text;
  }
  return text;
};

const lineSignature = (line: DiffLine, index: number) => {
  const kind = displayLineKind(line);
  const oldNo = line.oldNo == null ? "" : String(line.oldNo);
  const newNo = line.newNo == null ? "" : String(line.newNo);
  if (kind === "add" || kind === "del") {
    if (oldNo || newNo) return `stream:${kind}:${oldNo}:${newNo}`;
    return `stream:${kind}:index:${index}`;
  }
  return `${kind}:${oldNo}:${newNo}:${String(line.text ?? "")}`;
};

const isStreamAnimatableLine = (line: DiffLine) => {
  const kind = displayLineKind(line);
  return kind === "add" || kind === "del";
};

const lineRevealLength = (line: DiffLine) => lineContent(line, displayLineKind(line)).length;

const buildLineKeys = (lines: DiffLine[]) => {
  const seen = new Map<string, number>();
  return lines.map((line, index) => {
    const signature = lineSignature(line, index);
    const count = seen.get(signature) ?? 0;
    seen.set(signature, count + 1);
    return `${signature}:${count}`;
  });
};

const renderedLines = computed(() => {
  const keys = buildLineKeys(parsed.value.lines);
  return parsed.value.lines.map((line, index) => ({
    line,
    index,
    lineKey: keys[index] ?? "",
    domKey: `${props.diffKey}:${index}`,
  }));
});

type RenderedDiffLine = (typeof renderedLines.value)[number];

const stopRevealAnimation = () => {
  if (revealFrameId == null || typeof cancelAnimationFrame !== "function") return;
  cancelAnimationFrame(revealFrameId);
  revealFrameId = null;
};

const stopScheduledScroll = () => {
  if (scrollFrameId == null || typeof cancelAnimationFrame !== "function") return;
  cancelAnimationFrame(scrollFrameId);
  scrollFrameId = null;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const stopScrollAnimation = () => {
  if (scrollAnimationFrameId == null || typeof cancelAnimationFrame !== "function") return;
  cancelAnimationFrame(scrollAnimationFrameId);
  scrollAnimationFrameId = null;
};

const animateScrollTop = (el: HTMLElement, targetTopValue: number, force: boolean) => {
  const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
  const nextTargetTop = props.animateUpdates
    ? Math.max(targetTopValue, streamScrollFloorTop, el.scrollTop)
    : targetTopValue;
  const targetTop = clamp(nextTargetTop, 0, maxTop);
  if (props.animateUpdates) streamScrollFloorTop = targetTop;
  const startTop = el.scrollTop;
  const distance = targetTop - startTop;
  if (Math.abs(distance) <= 2 || typeof requestAnimationFrame !== "function") {
    stopScrollAnimation();
    el.scrollTop = targetTop;
    return;
  }

  stopScrollAnimation();
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const duration = force ? 110 : clamp(Math.abs(distance) * 0.32, 90, 170);
  const step = (nowValue: number) => {
    const now = Number.isFinite(nowValue) ? nowValue : Date.now();
    const progress = clamp((now - startedAt) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.scrollTop = startTop + distance * eased;
    if (progress < 1) {
      scrollAnimationFrameId = requestAnimationFrame(step);
      return;
    }
    scrollAnimationFrameId = null;
  };
  scrollAnimationFrameId = requestAnimationFrame(step);
};

const onLockedScrollInput = (event: Event) => {
  if (!props.animateUpdates) return;
  event.preventDefault();
};

const scheduleScrollToLine = (lineKey?: string, force = false) => {
  if (!props.animateUpdates) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!force && now - lastStreamScrollAtMs < STREAM_SCROLL_MIN_INTERVAL_MS) return;
  lastStreamScrollAtMs = now;
  stopScheduledScroll();
  const run = () => {
    scrollFrameId = null;
    const el = scrollEl.value;
    if (!el) return;
    const target = lineKey
      ? ([...el.querySelectorAll<HTMLElement>("[data-line-key]")].find((node) => node.dataset.lineKey === lineKey) ??
        null)
      : null;
    if (!target) {
      animateScrollTop(el, el.scrollHeight, force);
      return;
    }
    const nextTop = target.offsetTop + target.offsetHeight - el.clientHeight + 18;
    animateScrollTop(el, Math.max(0, nextTop), force);
  };
  if (typeof requestAnimationFrame === "function") {
    scrollFrameId = requestAnimationFrame(run);
  } else {
    run();
  }
};

const revealDurationFromPatchInterval = (intervalMs: number, totalChars: number) => {
  const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 900;
  const cadenceDuration = clamp(interval * 0.82, 260, 1800);
  const contentDuration = clamp(totalChars * 12, 260, 2400);
  return clamp(Math.min(cadenceDuration, contentDuration), 240, 2200);
};

type RevealTarget = { key: string; length: number };

const animateRevealToTargets = (targets: RevealTarget[], durationMs: number) => {
  stopRevealAnimation();
  if (targets.length === 0) return;

  const queue = targets.filter((target) => (revealCharsByLineKey.value.get(target.key) ?? 0) < target.length);
  if (queue.length === 0) return;
  const totalRemainingChars = queue.reduce((sum, target) => {
    const current = revealCharsByLineKey.value.get(target.key) ?? 0;
    return sum + Math.max(0, target.length - current);
  }, 0);
  if (totalRemainingChars <= 0) return;

  if (typeof requestAnimationFrame !== "function") {
    revealCharsByLineKey.value = new Map(targets.map((target) => [target.key, target.length]));
    return;
  }

  const charsPerMs = totalRemainingChars / Math.max(1, durationMs);
  let queueIndex = 0;
  let lastFrameAt = 0;
  let carryChars = 0;

  const step = (nowValue: number) => {
    const now = Number.isFinite(nowValue) ? nowValue : Date.now();
    if (lastFrameAt <= 0) lastFrameAt = now;
    const elapsed = Math.max(0, now - lastFrameAt);
    lastFrameAt = now;
    carryChars += Math.max(1, elapsed * charsPerMs);

    const next = new Map(revealCharsByLineKey.value);
    let activeTarget: RevealTarget | null = null;

    while (carryChars >= 1 && queueIndex < queue.length) {
      const currentTarget = queue[queueIndex];
      const current = clamp(next.get(currentTarget.key) ?? 0, 0, currentTarget.length);
      const remaining = currentTarget.length - current;
      if (remaining <= 0) {
        queueIndex += 1;
        continue;
      }
      const advance = Math.min(remaining, Math.floor(carryChars));
      if (advance <= 0) break;
      next.set(currentTarget.key, current + advance);
      carryChars -= advance;
      activeTarget = currentTarget;
      if (current + advance >= currentTarget.length) queueIndex += 1;
      else break;
    }

    revealCharsByLineKey.value = next;
    const scrollTarget = activeTarget ?? queue[Math.min(queueIndex, queue.length - 1)];
    if (scrollTarget) scheduleScrollToLine(scrollTarget.key);

    if (queueIndex >= queue.length) {
      revealFrameId = null;
      if (scrollTarget) scheduleScrollToLine(scrollTarget.key, true);
      return;
    }

    revealFrameId = requestAnimationFrame(step);
  };

  revealFrameId = requestAnimationFrame(step);
};

const visibleCharCountForRow = (row: RenderedDiffLine) => {
  const full = lineRevealLength(row.line);
  if (!props.animateUpdates || !isStreamAnimatableLine(row.line)) return full;
  return clamp(revealCharsByLineKey.value.get(row.lineKey) ?? full, 0, full);
};

const sliceTokens = (tokens: DiffHighlightToken[], maxChars: number) => {
  if (maxChars <= 0) return [];
  const sliced: DiffHighlightToken[] = [];
  let remaining = maxChars;
  for (const token of tokens) {
    if (remaining <= 0) break;
    const content = String(token.content ?? "");
    if (!content) continue;
    const nextContent = content.length <= remaining ? content : content.slice(0, remaining);
    sliced.push({ ...token, content: nextContent });
    remaining -= nextContent.length;
  }
  return sliced;
};

const visibleTokensForRow = (row: RenderedDiffLine) => {
  const tokens = normalizedTokensForRow(row);
  if (tokens.length === 0) return [];
  return sliceTokens(tokens, visibleCharCountForRow(row));
};

const shouldRenderTokensForRow = (row: RenderedDiffLine) => {
  if (normalizedTokensForRow(row).length === 0) return false;
  return true;
};

const visibleLineContent = (row: RenderedDiffLine) =>
  lineContent(row.line, displayLineKind(row.line)).slice(0, visibleCharCountForRow(row));

const normalizedTokensForRow = (row: RenderedDiffLine) => {
  const tokens = tokensForLine(row.index);
  const kind = displayLineKind(row.line);
  if ((kind !== "add" && kind !== "del") || tokens.length === 0) return tokens;
  if (!rawLineKindFromPrefix(row.line)) return tokens;
  const first = tokens[0];
  const content = String(first?.content ?? "");
  if (!/^[+-]/.test(content)) return tokens;
  const nextContent = content.slice(1);
  if (!nextContent) return tokens.slice(1);
  return [{ ...first, content: nextContent }, ...tokens.slice(1)];
};

watch(
  () => [props.diffKey, props.diffText, props.animateUpdates] as const,
  ([diffKey, _diffText, animateUpdates]) => {
    const currentKeys = buildLineKeys(parsed.value.lines);
    const currentKeySet = new Set(currentKeys);
    const keyChanged = previousDiffKey !== diffKey;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const patchInterval = lastPatchAtMs > 0 ? now - lastPatchAtMs : 900;
    lastPatchAtMs = now;
    const animatableEntries = currentKeys.flatMap((key, index) => {
      const line = parsed.value.lines[index];
      return line && isStreamAnimatableLine(line) ? [{ key, length: lineRevealLength(line) }] : [];
    });

    if (!animateUpdates || keyChanged) {
      stopRevealAnimation();
      if (!animateUpdates) {
        stopScheduledScroll();
        stopScrollAnimation();
      }
      streamScrollFloorTop = 0;
      revealCharsByLineKey.value = new Map(
        currentKeys.map((key, index) => {
          const line = parsed.value.lines[index];
          const length = line ? lineRevealLength(line) : 0;
          return [key, animateUpdates && line && isStreamAnimatableLine(line) ? 0 : length];
        })
      );
      previousDiffKey = diffKey;
      previousLineKeys = currentKeySet;
      if (animateUpdates) {
        const totalChars = animatableEntries.reduce((sum, entry) => sum + entry.length, 0);
        animateRevealToTargets(animatableEntries, revealDurationFromPatchInterval(patchInterval, totalChars));
      }
      return;
    }

    const nextVisible = new Map<string, number>();
    for (const [key, visible] of revealCharsByLineKey.value) {
      if (currentKeySet.has(key)) nextVisible.set(key, visible);
    }
    for (let index = 0; index < currentKeys.length; index += 1) {
      const key = currentKeys[index];
      const line = parsed.value.lines[index];
      if (!line) continue;
      if (!isStreamAnimatableLine(line)) {
        nextVisible.set(key, lineRevealLength(line));
        continue;
      }
      if (!nextVisible.has(key)) nextVisible.set(key, previousLineKeys.has(key) ? lineRevealLength(line) : 0);
    }
    revealCharsByLineKey.value = nextVisible;

    const totalChars = animatableEntries.reduce((sum, entry) => {
      const current = nextVisible.get(entry.key) ?? 0;
      return sum + Math.max(0, entry.length - current);
    }, 0);
    animateRevealToTargets(animatableEntries, revealDurationFromPatchInterval(patchInterval, totalChars));
    previousDiffKey = diffKey;
    previousLineKeys = currentKeySet;
  },
  { immediate: true }
);
</script>

<style scoped>
.unified-diff-scroll.is-stream-locked {
  overflow: hidden !important;
}
</style>
