<template>
  <div
    class="ui-waterball-progress"
    :class="[levelClass, { 'is-static': !animated }]"
    :style="rootStyle"
    role="img"
    :aria-label="ariaLabelText"
  >
    <span class="ui-waterball-progress__ring" aria-hidden="true">
      <span class="ui-waterball-progress__value">{{ displayPercent }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

type ProgressLevel = "normal" | "warn" | "high" | "critical";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const toFinite = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const props = withDefaults(
  defineProps<{
    percent: number;
    size?: number;
    level?: string;
    animated?: boolean;
    ariaLabel?: string;
  }>(),
  {
    size: undefined,
    level: "",
    animated: true,
  }
);

const { t } = useI18n();
const clampedPercent = computed(() => clamp(toFinite(props.percent, 0), 0, 100));
const animated = computed(() => Boolean(props.animated));
const level = computed<ProgressLevel>(() => {
  const raw = String(props.level ?? "")
    .trim()
    .toLowerCase();
  if (raw === "warn" || raw === "high" || raw === "critical") return raw;
  return "normal";
});

const sizeValue = computed(() => {
  if (props.size == null) return 32;
  return Math.round(Math.max(16, toFinite(props.size, 32)));
});

const rootStyle = computed(
  () =>
    ({
      "--progress-size": `${sizeValue.value}px`,
      "--progress-value": `${clampedPercent.value}%`,
      "--progress-font-size": `${clamp(Math.round(sizeValue.value * 0.25), 7, 12)}px`,
    }) as Record<string, string>
);

const displayPercent = computed(() => `${Math.round(clampedPercent.value)}`);
const levelClass = computed(() => `is-${level.value}`);
const ariaLabelText = computed(() => {
  if (props.ariaLabel) return String(props.ariaLabel);
  return t("progress.aria", { percent: Math.round(clampedPercent.value) });
});
</script>

<style scoped>
.ui-waterball-progress {
  width: var(--progress-size, 32px);
  height: var(--progress-size, 32px);
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  --progress-color: var(--accent);
  --progress-bg: var(--bg-accent-soft);
  --progress-border: var(--border-accent-hover);
  --progress-shadow: color-mix(in srgb, var(--accent) 16%, transparent);
}

.ui-waterball-progress.is-warn {
  --progress-color: var(--warning);
  --progress-bg: var(--bg-warning-soft);
  --progress-border: var(--border-warning);
  --progress-shadow: color-mix(in srgb, var(--warning) 18%, transparent);
}

.ui-waterball-progress.is-high {
  --progress-color: var(--warning);
  --progress-bg: var(--bg-warning-soft);
  --progress-border: var(--border-warning-hover);
  --progress-shadow: color-mix(in srgb, var(--warning) 22%, transparent);
}

.ui-waterball-progress.is-critical {
  --progress-color: var(--danger);
  --progress-bg: var(--bg-danger-soft);
  --progress-border: var(--border-danger-hover);
  --progress-shadow: color-mix(in srgb, var(--danger) 22%, transparent);
}

.ui-waterball-progress__ring {
  width: 100%;
  height: 100%;
  display: inline-grid;
  place-items: center;
  border-radius: inherit;
  border: 1px solid var(--progress-border);
  background:
    radial-gradient(circle at 50% 50%, var(--ui-timeline-card-bg, var(--surface-1)) 0 54%, transparent 55%),
    conic-gradient(var(--progress-color) var(--progress-value), var(--progress-bg) 0);
  box-shadow:
    inset 0 0 0 1px rgb(from var(--progress-color) r g b / 0.08),
    0 0 10px var(--progress-shadow);
  transition:
    background 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.ui-waterball-progress__value {
  min-width: 0;
  color: var(--progress-color);
  font-size: var(--progress-font-size, 8px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.ui-waterball-progress:not(.is-static) .ui-waterball-progress__ring {
  animation: ui-progress-soft-pulse 1.4s ease-in-out infinite;
}

@keyframes ui-progress-soft-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.96);
  }
}
</style>
