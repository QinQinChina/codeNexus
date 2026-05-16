<template>
  <div class="chat-tool-wrap w-full max-w-full min-w-0">
    <section class="official-image-card" :class="statusClass" aria-label="Codex 图片生成结果">
      <header class="official-image-card__header">
        <div class="official-image-card__mark" aria-hidden="true">
          <component :is="statusIcon" class="official-image-card__icon" />
        </div>

        <div class="official-image-card__heading">
          <div class="official-image-card__title-row">
            <span class="official-image-card__title">{{ titleText }}</span>
            <span class="official-image-card__badge">{{ statusText }}</span>
          </div>
          <div class="official-image-card__meta">
            <span>{{ subtitleText }}</span>
            <span v-if="showTimestamps" class="official-image-card__time mono">{{ formattedTime }}</span>
          </div>
        </div>
      </header>

      <div v-if="showRunningSkeleton" class="official-image-card__skeleton-grid" aria-hidden="true">
        <div v-for="index in skeletonCount" :key="index" class="official-image-card__skeleton">
          <div class="official-image-card__skeleton-glow" />
        </div>
      </div>

      <div v-else-if="visibleImages.length > 0" class="official-image-card__grid" :class="gridClass">
        <LazyImageThumb
          v-for="image in visibleImages"
          :key="image.id"
          :imageId="image.id"
          class="official-image-card__thumb"
          :source="image.source"
          :sourceKind="image.sourceKind"
          :title="image.title"
          :workspaceRoot="workspaceRoot"
          :rootMarginPx="360"
          @load-error="$emit('load-error', $event)"
          @preview="$emit('preview', $event)"
        />
      </div>

      <div v-else class="official-image-card__empty">
        <AlertTriangle class="official-image-card__empty-icon" aria-hidden="true" />
        <span>{{ emptyText }}</span>
      </div>

      <div v-if="item.errorText" class="official-image-card__error mono">
        {{ item.errorText }}
      </div>

      <details v-if="hasDetails" class="official-image-card__details">
        <summary>
          <span>生成细节</span>
          <span class="official-image-card__details-hint">{{ detailsHint }}</span>
        </summary>
        <div v-if="revisedPromptBody" class="official-image-card__prompt">
          <div class="official-image-card__detail-label">修订提示词</div>
          <p>{{ revisedPromptBody }}</p>
        </div>
        <pre v-if="item.detailText" class="official-image-card__source mono">{{ item.detailText }}</pre>
      </details>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { AlertTriangle, CheckCircle2, Eye, Image as ImageIcon, Loader2 } from "lucide-vue-next";
import type { Component } from "vue";
import type { ChatImageToolItem, ImageToolImageEntry } from "../layout/types/chat.types";
import LazyImageThumb from "../ui/LazyImageThumb.vue";

const props = defineProps<{
  item: ChatImageToolItem;
  visibleImages: ImageToolImageEntry[];
  showTimestamps: boolean;
  formattedTime: string;
  workspaceRoot: string;
}>();

defineEmits<{
  (e: "load-error", payload: any): void;
  (e: "preview", payload: any): void;
}>();

const titleText = computed(() => (props.item.itemType === "imageView" ? "查看图片" : "生成图片"));

const statusText = computed(() => {
  if (props.item.status === "running") return props.item.itemType === "imageView" ? "读取中" : "生成中";
  if (props.item.status === "completed") return props.item.itemType === "imageView" ? "已读取" : "已生成";
  if (props.item.status === "failed") return props.item.itemType === "imageView" ? "读取失败" : "生成失败";
  return "状态未知";
});

const statusIcon = computed<Component>(() => {
  if (props.item.itemType === "imageView") return Eye;
  if (props.item.status === "running") return Loader2;
  if (props.item.status === "failed") return AlertTriangle;
  if (props.item.status === "completed") return CheckCircle2;
  return ImageIcon;
});

const statusClass = computed(() => ({
  "is-running": props.item.status === "running",
  "is-completed": props.item.status === "completed",
  "is-failed": props.item.status === "failed",
  "is-view": props.item.itemType === "imageView",
}));

const subtitleText = computed(() => {
  const count = props.visibleImages.length;
  if (props.item.itemType === "imageView") return count > 0 ? "Codex view_image 结果" : "Codex view_image 请求";
  if (props.item.status === "running") return "等待图片生成结果";
  if (props.item.status === "failed") return "图片生成返回失败";
  if (count > 0) return `图片生成 · ${count} 张结果`;
  return "图片生成未返回可预览图片";
});

const gridClass = computed(() => ({
  "official-image-card__grid--single": props.visibleImages.length === 1,
  "official-image-card__grid--many": props.visibleImages.length > 1,
}));

const showRunningSkeleton = computed(() => props.item.status === "running" && props.visibleImages.length === 0);
const skeletonCount = computed(() => {
  if (props.item.itemType === "imageView") return 1;
  const count = Math.round(Number(props.item.pendingImageCount ?? 1));
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.min(4, count));
});

const emptyText = computed(() => {
  if (props.item.status === "failed") return "没有可显示的图片结果。";
  if (props.item.itemType === "imageView") return "等待图片路径解析。";
  return "图片结果尚未到达。";
});

const revisedPromptBody = computed(() => {
  return String(props.item.revisedPrompt ?? "")
    .replace(/^修订提示词：\s*/u, "")
    .trim();
});

const hasDetails = computed(() => Boolean(revisedPromptBody.value || props.item.detailText));
const detailsHint = computed(() => {
  const parts: string[] = [];
  if (revisedPromptBody.value) parts.push("prompt");
  if (props.item.detailText) parts.push("source");
  return parts.join(" / ");
});
</script>
