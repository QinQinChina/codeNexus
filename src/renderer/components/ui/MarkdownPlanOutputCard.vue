<template>
  <section
    class="markdown-plan-card chat-bubble-body min-w-0 overflow-hidden rounded-xl border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] shadow-[var(--chat-row-shadow)]"
    :class="{ 'is-executing': forceCollapsed }"
    aria-label="计划"
  >
    <Collapsible :open="contentOpen" motion="height" @update:open="onContentOpenUpdate">
      <template #trigger="{ triggerProps, open }">
        <header
          class="markdown-plan-card-head grid min-w-0 cursor-pointer select-none grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-[color:var(--ui-well-border)] px-3 py-2.5 transition-[background,border-color] duration-150"
          v-bind="triggerProps"
        >
          <div class="grid min-w-0 gap-1">
            <div class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2
                class="markdown-plan-card-title m-0 min-w-0 text-[15px] leading-[1.25] font-semibold text-[var(--text)]"
              >
                {{ parsed.title }}
              </h2>
              <p
                v-if="parsed.description"
                class="markdown-plan-card-description m-0 min-w-[180px] flex-1 text-[12px] leading-[1.4] text-[var(--text-muted)] [overflow-wrap:anywhere]"
              >
                {{ parsed.description }}
              </p>
            </div>
            <div v-if="forceCollapsed" class="mono text-[11px] text-[var(--fg-warning)]">执行计划中</div>
          </div>
          <ChevronDown
            class="mt-0.5 h-4 w-4 flex-none text-[var(--text-muted)] transition-[transform,color] duration-200 [stroke-width:2.2]"
            :class="open ? 'rotate-180 text-[var(--text)]' : ''"
            aria-hidden="true"
          />
        </header>
      </template>

      <div class="markdown-plan-card-body grid min-w-0 gap-3 px-3 py-3">
        <AgentMarkdownContent class="agent-markdown-body min-w-0" :html="bodyHtml" />
      </div>
    </Collapsible>

    <div v-if="$slots.actions" class="markdown-plan-card-actions border-t border-[var(--border)] px-3 py-2.5">
      <slot name="actions" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ChevronDown } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { renderMarkdownToSafeHtml } from "../../features/timeline/markdownRenderer";
import { useMarkdownRendererRefresh } from "../../features/timeline/useMarkdownRendererRefresh";
import AgentMarkdownContent from "./AgentMarkdownContent.vue";
import Collapsible from "./Collapsible.vue";

type ParsedMarkdownPlan = {
  title: string;
  description: string;
  body: string;
};

type HeadingHit = {
  level: number;
  lineIndex: number;
  title: string;
};

const props = defineProps<{
  rawText: string;
  forceCollapsed?: boolean;
}>();

const manualOpen = ref(true);
const { markdownRendererTick, refreshWhenReady } = useMarkdownRendererRefresh();

const contentOpen = computed(() => !props.forceCollapsed && manualOpen.value);

function stripInlineMarkdown(value: string): string {
  return String(value ?? "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isFenceLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("```") || trimmed.startsWith("~~~");
}

function headingFromLine(line: string): { level: number; title: string } | null {
  const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line.trim());
  if (!match) return null;
  const title = stripInlineMarkdown(match[2]);
  if (!title) return null;
  return { level: match[1].length, title };
}

function isDescriptionBoundary(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (headingFromLine(trimmed)) return true;
  if (isFenceLine(trimmed)) return true;
  if (/^([-*+]|\d+[.)])\s+/.test(trimmed)) return true;
  if (/^>/.test(trimmed)) return true;
  if (/^\|.+\|$/.test(trimmed)) return true;
  return false;
}

function findBestHeading(lines: string[]): HeadingHit | null {
  let best: HeadingHit | null = null;
  let fenced = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (isFenceLine(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const heading = headingFromLine(line);
    if (!heading) continue;
    if (!best || heading.level < best.level) {
      best = { level: heading.level, lineIndex: i, title: heading.title };
    }
  }
  return best;
}

function parseMarkdownPlan(rawText: string): ParsedMarkdownPlan {
  const source = String(rawText ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!source) return { title: "计划", description: "", body: "（无）" };

  const lines = source.split("\n");
  const heading = findBestHeading(lines);
  if (!heading) return { title: "计划", description: "", body: source };

  let descriptionStart = -1;
  let descriptionEnd = -1;
  for (let i = heading.lineIndex + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      if (descriptionStart >= 0) break;
      continue;
    }
    if (isDescriptionBoundary(line)) break;
    if (descriptionStart < 0) descriptionStart = i;
    descriptionEnd = i;
  }

  const description =
    descriptionStart >= 0 && descriptionEnd >= descriptionStart
      ? stripInlineMarkdown(lines.slice(descriptionStart, descriptionEnd + 1).join(" "))
      : "";

  const bodyLines = lines.filter((_, index) => {
    if (index === heading.lineIndex) return false;
    if (descriptionStart >= 0 && index >= descriptionStart && index <= descriptionEnd) return false;
    return true;
  });
  const body = bodyLines.join("\n").trim() || description || heading.title;

  return {
    title: heading.title || "计划",
    description,
    body,
  };
}

function renderMarkdownHtml(text: string): string {
  void markdownRendererTick.value;
  const html = renderMarkdownToSafeHtml(text);
  refreshWhenReady();
  return html;
}

const parsed = computed(() => parseMarkdownPlan(props.rawText));
const bodyHtml = computed(() => renderMarkdownHtml(parsed.value.body));

function onContentOpenUpdate(next: boolean) {
  manualOpen.value = Boolean(next);
}

watch(
  () => props.forceCollapsed,
  (next, prev) => {
    if (prev && !next) manualOpen.value = true;
  }
);

watch(
  () => props.rawText,
  () => {
    manualOpen.value = true;
  }
);
</script>

<style scoped>
.markdown-plan-card-head:hover {
  background: color-mix(in srgb, var(--ui-well-bg-strong) 68%, transparent);
}

.markdown-plan-card.is-executing .markdown-plan-card-head {
  border-color: color-mix(in srgb, var(--border-warning) 58%, var(--ui-well-border) 42%);
  background: color-mix(in srgb, var(--bg-warning-soft) 36%, var(--ui-well-bg) 64%);
}
</style>
