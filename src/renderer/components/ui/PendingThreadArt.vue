<template>
  <svg class="pending-thread-art" viewBox="0 0 200 200" width="100%" height="100%" role="img" aria-label="线程创建中">
    <defs>
      <linearGradient :id="snakeGradId" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="var(--ui-art-b)" />
        <stop offset="100%" stop-color="var(--ui-art-a)" />
      </linearGradient>

      <linearGradient :id="ringGradId" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="var(--ui-art-a)" />
        <stop offset="100%" stop-color="var(--ui-art-b)" />
      </linearGradient>
    </defs>

    <circle cx="100" cy="100" r="95" class="glow-circle" />

    <circle cx="100" cy="100" r="85" class="outer-ring" :stroke="`url(#${ringGradId})`" />
    <circle cx="100" cy="100" r="72" class="inner-ring" :stroke="`url(#${ringGradId})`" />

    <text x="65" y="70" class="binary b1">01</text>
    <text x="125" y="80" class="binary b2">10</text>
    <text x="80" y="140" class="binary b3">11</text>
    <text x="120" y="130" class="binary b4">00</text>
    <text x="100" y="55" class="binary b5">10</text>
    <text x="100" y="160" class="binary b1">01</text>

    <path
      class="snake-path"
      :stroke="`url(#${snakeGradId})`"
      pathLength="100"
      d="M 130 50
         C 130 10, 70 10, 70 50
         C 70 90, 130 110, 130 150
         C 130 190, 70 190, 70 150"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";

const uid = Math.random().toString(16).slice(2);
const snakeGradId = computed(() => `snakeGrad-${uid}`);
const ringGradId = computed(() => `ringGrad-${uid}`);
</script>

<style scoped>
.pending-thread-art {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.glow-circle {
  fill: none;
  stroke: color-mix(in srgb, white 14%, transparent);
  stroke-width: 2;
  filter: drop-shadow(0 0 18px color-mix(in srgb, var(--ui-art-a) 22%, transparent));
}

.outer-ring,
.inner-ring {
  fill: none;
  stroke-width: 2;
  opacity: 0.9;
  transform-origin: 100px 100px;
  will-change: transform;
}

.outer-ring {
  stroke-width: 2.25;
  opacity: 0.78;
  animation: ring-rotate 1600ms linear infinite;
}

.inner-ring {
  stroke-width: 1.75;
  opacity: 0.66;
  animation: ring-rotate-reverse 1250ms linear infinite;
}

.binary {
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  fill: color-mix(in srgb, var(--ui-art-a) 46%, transparent);
  opacity: 0.32;
  text-anchor: middle;
  user-select: none;
  animation: binary-pulse 1400ms ease-in-out infinite;
}

.binary.b2 {
  animation-delay: 120ms;
  opacity: 0.28;
  fill: color-mix(in srgb, var(--ui-art-b) 45%, transparent);
}
.binary.b3 {
  animation-delay: 260ms;
  opacity: 0.26;
}
.binary.b4 {
  animation-delay: 380ms;
  opacity: 0.24;
  fill: color-mix(in srgb, var(--ui-art-b) 40%, transparent);
}
.binary.b5 {
  animation-delay: 520ms;
  opacity: 0.22;
}

.snake-path {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 14px color-mix(in srgb, var(--ui-art-b) 12%, transparent));
  stroke-dasharray: 20 14;
  stroke-dashoffset: 0;
  animation: snake-flow 1200ms linear infinite;
}

@keyframes ring-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes ring-rotate-reverse {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(-360deg);
  }
}

@keyframes snake-flow {
  to {
    stroke-dashoffset: -34;
  }
}

@keyframes binary-pulse {
  0%,
  100% {
    opacity: 0.18;
  }
  50% {
    opacity: 0.62;
  }
}
</style>
