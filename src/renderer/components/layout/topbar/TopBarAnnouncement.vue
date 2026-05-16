<template>
  <div
    ref="tickerViewportRef"
    class="topbar-announcement"
    :class="tickerClass"
    v-tooltip="tickerFullText"
    role="status"
    aria-live="polite"
  >
    <span
      ref="tickerTrackRef"
      class="topbar-announcement-track"
      :class="{ 'is-overflow': tickerOverflow }"
      :style="tickerTrackStyle"
      @transitionend="onTrackTransitionEnd"
    >
      {{ tickerText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useDujitangTicker } from "./useDujitangTicker";

const {
  tickerClass,
  tickerFullText,
  tickerOverflow,
  tickerText,
  tickerTrackRef,
  tickerTrackStyle,
  tickerViewportRef,
  onTrackTransitionEnd,
} = useDujitangTicker();
</script>
