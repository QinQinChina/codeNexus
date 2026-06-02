<template>
  <component :is="as" :aria-label="labelText">
    <slot name="prefix"></slot>
    <span>{{ baseText }}</span
    ><span aria-hidden="true">{{ dotsText }}</span>
  </component>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    baseText: string;
    intervalMs?: number;
    maxDots?: number;
    as?: "span" | "div";
    ariaLabel?: string;
  }>(),
  {
    intervalMs: 350,
    maxDots: 3,
    as: "span",
    ariaLabel: "",
  }
);

const dots = ref(0);
const timerId = ref<number | null>(null);

function clearTimer() {
  if (timerId.value == null) return;
  window.clearInterval(timerId.value);
  timerId.value = null;
}

function start() {
  clearTimer();
  dots.value = 0;

  const intervalMs = Math.max(80, Math.round(Number(props.intervalMs) || 350));
  const maxDots = Math.max(0, Math.round(Number(props.maxDots) || 3));
  timerId.value = window.setInterval(() => {
    dots.value = (dots.value + 1) % (maxDots + 1);
  }, intervalMs);
}

onMounted(() => start());
onBeforeUnmount(() => clearTimer());

watch(
  () => [props.intervalMs, props.maxDots, props.baseText],
  () => start()
);

const dotsText = computed(() => ".".repeat(Math.max(0, dots.value)));
const labelText = computed(() => String(props.ariaLabel ?? "").trim() || `${props.baseText}${dotsText.value}`);
</script>
