<template>
  <span class="chat-animated-count" :style="{ '--count-duration': `${normalizedDuration}ms` }">
    <span
      v-for="cell in digitCells"
      :key="cell.place"
      class="chat-count-digit-cell"
      aria-hidden="true"
    >
      <Transition name="chat-count-digit" mode="out-in">
        <span :key="cell.char" class="chat-count-digit-value">{{ cell.char }}</span>
      </Transition>
    </span>
    <span class="sr-only">{{ normalizedValue }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  value: number;
  duration?: number;
}>();

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizedValue = computed(() => (Number.isFinite(props.value) ? Math.max(0, Math.round(props.value)) : 0));
const normalizedDuration = computed(() => clamp(Math.round(props.duration ?? 180), 80, 420));
const digitCells = computed(() =>
  String(normalizedValue.value)
    .split("")
    .map((char, index, digits) => ({
      char,
      place: digits.length - index - 1,
    }))
);
</script>

<style scoped>
.chat-animated-count {
  display: inline-flex;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  vertical-align: baseline;
}

.chat-count-digit-cell {
  display: inline-grid;
  width: 1ch;
  height: 1em;
  overflow: hidden;
  line-height: 1;
  place-items: center;
}

.chat-count-digit-value {
  grid-area: 1 / 1;
  line-height: 1;
  text-align: center;
  will-change: transform, opacity;
}

.chat-count-digit-enter-active,
.chat-count-digit-leave-active {
  transition:
    transform var(--count-duration) cubic-bezier(0.22, 1, 0.36, 1),
    opacity var(--count-duration) ease;
}

.chat-count-digit-enter-from {
  opacity: 0;
  transform: translateY(72%);
}

.chat-count-digit-leave-to {
  opacity: 0;
  transform: translateY(-72%);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .chat-count-digit-enter-active,
  .chat-count-digit-leave-active {
    transition: none;
  }
}
</style>
