<template>
  <span :class="['chat-animated-count', isAnimating ? 'is-animating' : '']">
    {{ displayValue }}
  </span>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick } from "vue";

const props = defineProps<{
  value: number;
  duration?: number;
}>();

const displayValue = ref(0);
const isAnimating = ref(false);
let frameId: number | null = null;

const prefersReducedMotion = () => {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const stopAnimation = () => {
  if (frameId === null) return;
  cancelAnimationFrame(frameId);
  frameId = null;
  isAnimating.value = false;
};

const animateTo = (targetValue: number) => {
  const target = Number.isFinite(targetValue) ? Math.max(0, Math.round(targetValue)) : 0;
  const start = displayValue.value;
  if (start === target) {
    displayValue.value = target;
    return;
  }

  stopAnimation();
  if (prefersReducedMotion()) {
    displayValue.value = target;
    return;
  }

  isAnimating.value = false;
  void nextTick(() => {
    isAnimating.value = true;
  });

  const delta = Math.abs(target - start);
  const baseDuration = Math.max(120, Math.round(props.duration ?? 320));
  const duration = clamp(Math.max(baseDuration, Math.round(220 + delta * 18)), 160, 900);
  let startTime = 0;

  const step = (timestamp: number) => {
    if (startTime === 0) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const easedProgress = 1 - (1 - progress) ** 3;
    displayValue.value = Math.round(start + (target - start) * easedProgress);
    if (progress < 1) {
      frameId = requestAnimationFrame(step);
      return;
    }
    displayValue.value = target;
    frameId = null;
    isAnimating.value = false;
  };

  frameId = requestAnimationFrame(step);
};

watch(
  () => props.value,
  (value) => {
    animateTo(value);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopAnimation();
});
</script>

<style scoped>
.chat-animated-count {
  display: inline-block;
  min-width: 1ch;
  font-variant-numeric: tabular-nums;
  transition:
    transform 160ms ease,
    filter 160ms ease;
  will-change: transform;
}

.chat-animated-count.is-animating {
  transform: scale(1.08);
  filter: brightness(1.12);
}
</style>
