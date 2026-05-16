<template>
  <TimelineCardShell
    class="w-full simple-mcp-tool-event"
    :cardClass="groupClass"
    :tagText="tagText"
    :statusText="''"
    :statusKind="''"
    :open="open"
    :keepMounted="true"
    @update:open="emit('update:open', $event)"
  >
    <template #icon>
      <Terminal class="h-[13px] w-[13px] flex-none text-[color:var(--accent)] [stroke-width:2.2]" aria-hidden="true" />
    </template>
    <div class="grid gap-1.5 px-2.5 pb-2.5">
      <div class="mono dim">{{ summaryText }}</div>
      <div class="mono dim text-[11px]">{{ statsText }}</div>
      <ol class="m-0 grid gap-1.5 pl-4">
        <li
          v-for="item in items"
          :key="item.id"
          class="grid gap-1 rounded-[4px] border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] px-2 py-1.5"
          :class="itemClass(item)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="mcp-tool-item-status inline-flex min-w-0 items-center gap-1.5 text-[11px]">
              <ExecutionWaveText
                v-if="item.status === 'running'"
                class="mono"
                color="var(--accent)"
                :text="item.tool"
                :cycle-max-chars="128"
              />
              <span v-else class="mono">{{ item.tool }}</span>
            </span>
            <span class="mono dim flex-none whitespace-nowrap text-[10px]">{{ itemMetricsText(item) }}</span>
          </div>
          <div
            class="mono dim whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[10px]"
            v-tooltip="itemTitle(item)"
          >
            {{ itemTitle(item) }}
          </div>
          <div class="mono dim whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[10px]">
            {{ itemMetaText(item) }}
          </div>
          <div
            class="mono whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[11px] leading-[1.4] text-[var(--text)]"
          >
            {{ item.argumentsSummary }}
          </div>
          <div
            v-if="item.resultSummary"
            class="mono dim whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[11px] leading-[1.4]"
          >
            {{ item.resultSummary }}
          </div>
          <div
            v-if="item.pageSummary"
            class="mono dim whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[11px] leading-[1.4]"
          >
            {{ item.pageSummary }}
          </div>
          <div
            v-if="item.snapshotSummary"
            class="mono dim whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[11px] leading-[1.4]"
          >
            {{ item.snapshotSummary }}
          </div>
          <div
            v-if="item.errorText"
            class="mono whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[11px] leading-[1.4] text-[var(--text)]"
          >
            {{ item.errorText }}
          </div>
          <div v-if="item.relatedResourceLabel && onOpenRelatedResource" class="flex flex-wrap items-center gap-2">
            <button type="button" class="btn-mini" @click.stop="onOpenRelatedResource(item)">
              {{ item.relatedResourceLabel }}
            </button>
          </div>
          <DetailDisclosure
            v-if="item.argumentsRaw"
            :open="isDetailOpen(item.argumentsKey)"
            motion="fade"
            summaryClass="mono text-[11px] dim"
            @update:open="(next) => onDetailToggle(item.argumentsKey, next)"
          >
            <template #summary>查看完整参数</template>
            <pre
              class="mono mt-1.5 max-h-[240px] overflow-y-auto app-scrollbar rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-2 text-[var(--ui-code-text)] whitespace-pre-wrap [overflow-wrap:anywhere] break-words"
              >{{ item.argumentsRaw }}</pre
            >
          </DetailDisclosure>
          <DetailDisclosure
            v-if="item.resultRaw"
            :open="isDetailOpen(item.resultKey)"
            motion="fade"
            summaryClass="mono text-[11px] dim"
            @update:open="(next) => onDetailToggle(item.resultKey, next)"
          >
            <template #summary>查看完整结果</template>
            <pre
              class="mono mt-1.5 max-h-[240px] overflow-y-auto app-scrollbar rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-2 text-[var(--ui-code-text)] whitespace-pre-wrap [overflow-wrap:anywhere] break-words"
              >{{ item.resultRaw }}</pre
            >
          </DetailDisclosure>
          <DetailDisclosure
            v-if="item.structuredContentRaw"
            :open="isDetailOpen(item.structuredContentKey)"
            motion="fade"
            summaryClass="mono text-[11px] dim"
            @update:open="(next) => onDetailToggle(item.structuredContentKey, next)"
          >
            <template #summary>查看 structuredContent</template>
            <pre
              class="mono mt-1.5 max-h-[240px] overflow-y-auto app-scrollbar rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-2 text-[var(--ui-code-text)] whitespace-pre-wrap [overflow-wrap:anywhere] break-words"
              >{{ item.structuredContentRaw }}</pre
            >
          </DetailDisclosure>
          <DetailDisclosure
            v-if="item.metaRaw"
            :open="isDetailOpen(item.metaKey)"
            motion="fade"
            summaryClass="mono text-[11px] dim"
            @update:open="(next) => onDetailToggle(item.metaKey, next)"
          >
            <template #summary>查看 _meta</template>
            <pre
              class="mono mt-1.5 max-h-[240px] overflow-y-auto app-scrollbar rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-2 text-[var(--ui-code-text)] whitespace-pre-wrap [overflow-wrap:anywhere] break-words"
              >{{ item.metaRaw }}</pre
            >
          </DetailDisclosure>
          <DetailDisclosure
            v-if="item.outputSchemaRaw"
            :open="isDetailOpen(item.outputSchemaKey)"
            motion="fade"
            summaryClass="mono text-[11px] dim"
            @update:open="(next) => onDetailToggle(item.outputSchemaKey, next)"
          >
            <template #summary>查看 outputSchema</template>
            <pre
              class="mono mt-1.5 max-h-[240px] overflow-y-auto app-scrollbar rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-2 text-[var(--ui-code-text)] whitespace-pre-wrap [overflow-wrap:anywhere] break-words"
              >{{ item.outputSchemaRaw }}</pre
            >
          </DetailDisclosure>
        </li>
      </ol>
    </div>
  </TimelineCardShell>
</template>

<script setup lang="ts">
// MCP 工具卡片内容：展示工具调用的输入/输出摘要与可展开的详情信息。
import { Terminal } from "lucide-vue-next";
import TimelineCardShell from "../TimelineCardShell.vue";
import DetailDisclosure from "../../ui/DetailDisclosure.vue";
import ExecutionWaveText from "../../ui/ExecutionWaveText.vue";

export type McpToolCallStatus = "running" | "completed" | "failed" | "unknown";

export type McpToolItem = {
  id: string;
  status: McpToolCallStatus;
  server: string;
  tool: string;
  argumentsSummary: string;
  argumentsRaw: string;
  argumentsKey: string;
  resultSummary: string;
  resultRaw: string;
  resultKey: string;
  structuredContentRaw: string;
  structuredContentKey: string;
  metaRaw: string;
  metaKey: string;
  outputSchemaRaw: string;
  outputSchemaKey: string;
  pageSummary: string;
  snapshotSummary: string;
  errorText: string;
  relatedResourceUri: string;
  relatedResourceSourceTab: "resources" | "templates";
  relatedResourceTemplateKey: string;
  relatedResourceLabel: string;
};

// 业务数据和行为均由父层注入，卡片组件只处理 UI 渲染与事件透传。
defineProps<{
  open: boolean;
  tagText: string;
  groupClass: string;
  summaryText: string;
  statsText: string;
  items: McpToolItem[];
  itemClass: (item: McpToolItem) => any;
  itemStatusText: (item: McpToolItem) => string;
  itemMetricsText: (item: McpToolItem) => string;
  itemTitle: (item: McpToolItem) => string;
  itemMetaText: (item: McpToolItem) => string;
  isDetailOpen: (detailKey: string) => boolean;
  onDetailToggle: (detailKey: string, next: boolean) => void;
  onOpenRelatedResource?: (item: McpToolItem) => void;
}>();

const emit = defineEmits<{
  (event: "update:open", value: boolean): void;
}>();
</script>
