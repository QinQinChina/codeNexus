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
import type { ChatImageToolItem, ImageToolImageEntry } from "../layout/chat.types";
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
  if (props.item.status === "running") return "等待 Codex 官方 image_generation 结果";
  if (props.item.status === "failed") return "Codex 官方 image_generation 返回失败";
  if (count > 0) return `Codex 官方 image_generation · ${count} 张结果`;
  return "Codex 官方 image_generation 未返回可预览图片";
});

const gridClass = computed(() => ({
  "official-image-card__grid--single": props.visibleImages.length === 1,
  "official-image-card__grid--many": props.visibleImages.length > 1,
}));

const showRunningSkeleton = computed(() => props.item.status === "running" && props.visibleImages.length === 0);
const skeletonCount = computed(() => (props.item.itemType === "imageView" ? 1 : 3));

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

<style scoped>
.official-image-card {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--ui-code-border) 78%, transparent);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--surface-1) 92%, transparent), transparent 68%),
    color-mix(in srgb, var(--ui-code-bg) 88%, var(--bg));
  box-shadow: 0 10px 26px color-mix(in srgb, #000 10%, transparent);
  padding: 12px;
}

.official-image-card::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: color-mix(in srgb, var(--accent) 74%, var(--text) 8%);
  content: "";
}

.official-image-card.is-failed::before {
  background: color-mix(in srgb, var(--text-danger, #d94b4b) 78%, var(--text) 10%);
}

.official-image-card.is-view::before {
  background: color-mix(in srgb, var(--text-info, #3b82f6) 76%, var(--accent) 24%);
}

.official-image-card__header {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.official-image-card__mark {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
}

.is-running .official-image-card__mark {
  color: color-mix(in srgb, var(--accent) 72%, var(--text));
}

.is-failed .official-image-card__mark {
  border-color: color-mix(in srgb, var(--text-danger, #d94b4b) 34%, transparent);
  background: color-mix(in srgb, var(--text-danger, #d94b4b) 10%, transparent);
  color: var(--text-danger, #d94b4b);
}

.official-image-card__icon {
  width: 17px;
  height: 17px;
}

.is-running .official-image-card__icon {
  animation: official-image-card-spin 1.05s linear infinite;
}

.official-image-card__heading {
  min-width: 0;
}

.official-image-card__title-row,
.official-image-card__meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.official-image-card__title {
  min-width: 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
}

.official-image-card__badge {
  display: inline-flex;
  height: 20px;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  color: color-mix(in srgb, var(--accent) 82%, var(--text));
  font-size: 11px;
  font-weight: 650;
  line-height: 1;
  padding: 0 8px;
  white-space: nowrap;
}

.is-failed .official-image-card__badge {
  border-color: color-mix(in srgb, var(--text-danger, #d94b4b) 26%, transparent);
  background: color-mix(in srgb, var(--text-danger, #d94b4b) 10%, transparent);
  color: var(--text-danger, #d94b4b);
}

.official-image-card__meta {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 11px;
}

.official-image-card__time {
  color: color-mix(in srgb, var(--text-muted) 82%, transparent);
}

.official-image-card__grid,
.official-image-card__skeleton-grid {
  display: grid;
  margin-top: 12px;
  gap: 10px;
}

.official-image-card__grid {
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  max-width: min(100%, 620px);
}

.official-image-card__grid--single {
  grid-template-columns: minmax(180px, min(360px, 100%));
}

.official-image-card__thumb {
  width: 100%;
  height: auto;
  min-height: 128px;
  aspect-ratio: 4 / 3;
  border-radius: 8px;
}

.official-image-card__grid--single .official-image-card__thumb {
  min-height: 180px;
  aspect-ratio: 16 / 10;
}

.official-image-card__skeleton-grid {
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  max-width: min(100%, 520px);
}

.official-image-card__skeleton {
  position: relative;
  min-height: 116px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--ui-code-border) 66%, transparent);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 9%, transparent), transparent 58%),
    color-mix(in srgb, var(--surface-2) 72%, transparent);
}

.official-image-card__skeleton-glow {
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 18%, transparent), transparent);
  animation: official-image-card-sweep 1.7s ease-in-out infinite;
}

.official-image-card__empty {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 7px;
  margin-top: 12px;
  border: 1px dashed color-mix(in srgb, var(--ui-code-border) 78%, transparent);
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 12px;
  padding: 9px 10px;
}

.official-image-card__empty-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.official-image-card__error {
  margin-top: 10px;
  border: 1px solid color-mix(in srgb, var(--text-danger, #d94b4b) 22%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-danger, #d94b4b) 8%, transparent);
  color: var(--text);
  font-size: 11px;
  line-height: 1.55;
  padding: 8px 9px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.official-image-card__details {
  margin-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--ui-code-border) 66%, transparent);
  padding-top: 8px;
}

.official-image-card__details summary {
  display: flex;
  cursor: pointer;
  list-style: none;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-muted);
  font-size: 11px;
  user-select: none;
}

.official-image-card__details summary::-webkit-details-marker {
  display: none;
}

.official-image-card__details-hint {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--text-muted) 70%, transparent);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.official-image-card__prompt,
.official-image-card__source {
  margin-top: 9px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg) 58%, transparent);
  color: var(--ui-code-text);
  font-size: 11px;
  line-height: 1.55;
  padding: 9px;
}

.official-image-card__detail-label {
  margin-bottom: 5px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.official-image-card__prompt p,
.official-image-card__source {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@keyframes official-image-card-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes official-image-card-sweep {
  0% {
    transform: translateX(-100%);
  }
  52%,
  100% {
    transform: translateX(100%);
  }
}

@media (max-width: 560px) {
  .official-image-card {
    padding: 10px;
  }

  .official-image-card__grid,
  .official-image-card__skeleton-grid {
    grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
  }

  .official-image-card__grid--single {
    grid-template-columns: 1fr;
  }
}
</style>
