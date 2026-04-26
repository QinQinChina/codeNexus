<template>
  <component
    :is="as"
    :key="runKey"
    class="break-words whitespace-pre-wrap text-[color:var(--wave-color)]"
    :style="rootStyle"
    :aria-label="text"
  >
    <span
      v-for="(ch, i) in chars"
      :key="`c:${i}`"
      class="inline-block opacity-[var(--wave-min-op)]"
      aria-hidden="true"
      :style="charStyle(i)"
      >{{ ch }}</span
    >
  </component>
</template>

<script setup lang="ts">
// 波浪文字动画：用于“思考中/生成中”等场景的动态提示文本。
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    text: string;
    enabled?: boolean;
    color?: string;
    charDelaySec?: number;
    charAnimDurationSec?: number;
    pauseSec?: number;
    minOpacity?: number;
    maxOpacity?: number;
    as?: "span" | "div";
  }>(),
  {
    enabled: true,
    color: "var(--accent)",
    charDelaySec: 0.12,
    charAnimDurationSec: 1,
    pauseSec: 0,
    minOpacity: 0.25,
    maxOpacity: 1,
    as: "span",
  }
);

const chars = computed(() => Array.from(String(props.text ?? "")));
const runKey = ref(0);
const timerId = ref<number | null>(null);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// 统一导出 CSS 变量，样式层只关心 token。
const rootStyle = computed(() => {
  const minOpacity = clamp01(Number(props.minOpacity));
  const maxOpacity = clamp01(Number(props.maxOpacity));
  const durSec = Math.max(0.1, Number(props.charAnimDurationSec) || 1);
  return {
    "--wave-color": String(props.color ?? "var(--accent)"),
    "--wave-min-op": String(Number.isFinite(minOpacity) ? minOpacity : 0.25),
    "--wave-max-op": String(Number.isFinite(maxOpacity) ? maxOpacity : 1),
    "--wave-dur": `${durSec}s`,
  } as Record<string, string>;
});

// 每个字符按索引施加延迟，实现“波浪”效果。
const charStyle = (index: number) => {
  if (!props.enabled) return { animation: "none" } as Record<string, string>;
  const delaySec = Math.max(0, Number(props.charDelaySec) || 0);
  return {
    animationName: "wave-text-opacity",
    animationDuration: "var(--wave-dur)",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "1",
    animationDelay: `${index * delaySec}s`,
    animationFillMode: "both",
  } as Record<string, string>;
};

function clearTimer() {
  if (timerId.value == null) return;
  window.clearTimeout(timerId.value);
  timerId.value = null;
}

// 计算一轮动画总时长并安排下一轮循环。
function scheduleNextRound() {
  clearTimer();

  const text = String(props.text ?? "").trim();
  if (!props.enabled || !text) return;

  const len = chars.value.length;
  const delayMs = Math.max(0, Number(props.charDelaySec) || 0) * 1000;
  const animMs = Math.max(100, (Number(props.charAnimDurationSec) || 1) * 1000);
  const pauseMs = Math.max(0, Number(props.pauseSec) || 0) * 1000;

  const totalMs = Math.max(0, (len - 1) * delayMs) + animMs;
  timerId.value = window.setTimeout(() => {
    runKey.value += 1;
    scheduleNextRound();
  }, totalMs + pauseMs);
}

function start() {
  clearTimer();
  runKey.value += 1;
  scheduleNextRound();
}

onMounted(() => start());
onBeforeUnmount(() => clearTimer());

watch(
  () => [props.text, props.enabled, props.charDelaySec, props.charAnimDurationSec, props.pauseSec],
  () => start()
);
</script>
