<template>
  <div
    class="center-empty-state flex flex-col w-full max-w-[860px] mx-auto pt-[8vh] pb-10 px-6 max-[1500px]:max-w-[720px] max-[1500px]:pt-[6vh] animate-enter-pop"
  >
    <!-- 欢迎头部区域 -->
    <div
      v-if="mode === 'default' && !loading"
      class="flex flex-col items-center text-center mb-12 animate-enter-slide-up"
    >
      <div
        class="w-16 h-16 mb-5 rounded-2xl bg-[image:var(--ui-empty-hero-bg)] shadow-lg shadow-[color:var(--ui-empty-primary-shadow)] flex items-center justify-center text-[color:var(--ui-empty-hero-text)]"
      >
        <Sparkles class="w-8 h-8" aria-hidden="true" />
      </div>
      <h1 class="text-[28px] max-[1500px]:text-[24px] font-bold text-[var(--text)] tracking-tight mb-2">
        有什么我可以帮你的？
      </h1>
      <p class="text-sm max-[1500px]:text-[13px] text-[var(--text-muted)] mb-8">
        选择一个历史记录继续，或开启全新的探讨
      </p>

      <button
        id="btn-center-empty-create-thread"
        type="button"
        class="flex items-center gap-2 h-12 max-[1500px]:h-11 px-8 max-[1500px]:px-6 rounded-full bg-[var(--ui-empty-primary-bg)] text-[color:var(--ui-empty-primary-text)] text-[15px] max-[1500px]:text-[14px] font-medium shadow-md shadow-[color:var(--ui-empty-primary-shadow)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[color:var(--ui-empty-primary-shadow-hover)] hover:brightness-110 active:scale-[0.97] active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent)]/30"
        @click="$emit('create-thread')"
      >
        <MessageSquarePlus class="w-5 h-5 max-[1500px]:w-4 max-[1500px]:h-4" />
        <span>创建新对话</span>
      </button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="mono dim flex w-full items-center justify-center gap-3 my-12">
      <span class="running-indicator is-muted" aria-hidden="true"></span>
      <span class="text-sm">正在读取时空记忆...</span>
    </div>

    <template v-else>
      <!-- 线程创建中 -->
      <div v-if="mode === 'pendingThread'" class="center-empty-pending flex flex-col items-center gap-4 my-10">
        <PendingThreadArt class="center-empty-pending-art w-[240px] max-[1500px]:w-[200px]" />
        <div
          class="flex items-center justify-center gap-2 bg-[var(--surface-2)] px-4 py-2 rounded-full border border-[var(--border)]"
        >
          <LoadingDots class="mono dim text-[13px]" baseText="正在构建线程上下文" :intervalMs="350" :maxDots="3" />
        </div>
      </div>

      <!-- 空线程已创建 -->
      <div
        v-else-if="mode === 'emptyThread'"
        class="center-empty-pending flex flex-col items-center gap-5 my-10 animate-enter-fade"
      >
        <PendingThreadArt class="center-empty-pending-art w-[240px] max-[1500px]:w-[200px]" />
        <div class="flex flex-col items-center gap-4">
          <div
            class="mono dim text-[13px] bg-[var(--surface-2)] px-4 py-1.5 rounded-full border border-[var(--border)]"
          >
            ⚡ 线程就绪
          </div>
          <button
            type="button"
            class="flex items-center gap-2 h-10 px-6 rounded-full bg-[var(--surface-1)] text-[var(--text)] border border-[var(--border)] font-medium shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md hover:border-[var(--border-accent)] hover:text-[var(--accent)] active:scale-[0.97]"
            @click="$emit('start-chat')"
          >
            开始对话
          </button>
        </div>
      </div>

      <!-- 历史对话网格 -->
      <div
        v-else-if="historyItems.length > 0"
        class="center-empty-history w-full animate-enter-slide-up"
        style="animation-delay: 100ms"
      >
        <div class="flex items-center justify-between mb-4 px-1">
          <h2 class="text-sm max-[1500px]:text-[13px] font-bold text-[var(--text-muted)] flex items-center gap-2">
            <History class="w-4 h-4" /> 历史回溯
          </h2>
          <span class="text-[12px] max-[1500px]:text-[11px] text-[var(--text-muted)] opacity-60"
            >最近 {{ historyItems.length }} 条</span
          >
        </div>

        <!-- 改为漂亮的 2 列 Grid 布局 -->
        <div class="grid grid-cols-2 gap-3 max-[1500px]:gap-2.5">
          <button
            v-for="(item, index) in historyItems"
            :key="item.id"
            type="button"
            :style="{ animationDelay: `${index * 40 + 150}ms` }"
            class="group flex flex-col items-start justify-center h-[72px] max-[1500px]:h-[64px] px-4 max-[1500px]:px-3 rounded-xl border border-[var(--border)] bg-[var(--surface-1)]/50 hover:bg-[var(--surface-1)] text-left transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-[color:var(--border-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/30 active:scale-[0.98] opacity-0 animate-enter-slide-up"
            @click="$emit('switch-thread', item.id)"
          >
            <span
              class="title font-medium text-[14px] max-[1500px]:text-[13px] text-[var(--text)] group-hover:text-[var(--accent)] transition-colors w-full truncate mb-1"
            >
              {{ item.title }}
            </span>
            <span
              class="text-[11px] max-[1500px]:text-[10px] text-[var(--text-muted)] font-mono opacity-70 flex items-center gap-1"
            >
              <MessageSquareText class="w-3 h-3" /> 对话线程
            </span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ThreadHistoryItem } from "../../domain/types";
import PendingThreadArt from "../ui/PendingThreadArt.vue";
import LoadingDots from "../ui/LoadingDots.vue";
import { Sparkles, MessageSquarePlus, History, MessageSquareText } from "lucide-vue-next";

defineProps<{
  loading: boolean;
  historyItems: ThreadHistoryItem[];
  mode: "default" | "pendingThread" | "emptyThread";
}>();

defineEmits<{
  (event: "create-thread"): void;
  (event: "start-chat"): void;
  (event: "switch-thread", threadId: string): void;
}>();
</script>
