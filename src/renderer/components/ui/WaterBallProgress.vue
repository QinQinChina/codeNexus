<template>
  <div
    ref="chartRef"
    class="ui-waterball-progress"
    :class="{ 'is-static': !animated }"
    :style="rootStyle"
    role="img"
    :aria-label="ariaLabelText"
  ></div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as echarts from "echarts";
import "echarts-liquidfill";

type LiquidLevel = "normal" | "warn" | "high" | "critical";

type LiquidPalette = {
  waves: [string, string, string];
  background: string;
  border: string;
  shadow: string;
};

type RGBA = { r: number; g: number; b: number; a: number };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const toFinite = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const clamp01 = (v: number) => clamp(v, 0, 1);

const parseColor = (raw: string): RGBA | null => {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  // #rgb / #rrggbb / #rrggbbaa
  if (s.startsWith("#")) {
    const hex = s.slice(1).trim();
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b, a: 1 };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      if ([r, g, b, a].some((x) => Number.isNaN(x))) return null;
      return { r, g, b, a: clamp01(a) };
    }
  }

  // CSS rgb color functions
  const m = s.match(/^rgba?\((.+)\)$/i);
  if (m) {
    const parts = m[1].split(",").map((p) => p.trim());
    if (parts.length < 3) return null;
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    const a = parts.length >= 4 ? Number(parts[3]) : 1;
    if (![r, g, b, a].every((x) => Number.isFinite(x))) return null;
    return {
      r: clamp(Math.round(r), 0, 255),
      g: clamp(Math.round(g), 0, 255),
      b: clamp(Math.round(b), 0, 255),
      a: clamp01(a),
    };
  }

  return null;
};

const rgbaString = (c: RGBA, alphaOverride?: number) => {
  const a = alphaOverride == null ? c.a : clamp01(alphaOverride);
  return `rgb(${c.r} ${c.g} ${c.b} / ${a})`;
};

const readCssVarRaw = (name: string): string => {
  try {
    if (typeof document === "undefined") return "";
    const root = document.documentElement;
    if (!root) return "";
    return getComputedStyle(root).getPropertyValue(name).trim();
  } catch {
    return "";
  }
};

const readCssColor = (name: string, fallback: string): RGBA => {
  const raw = readCssVarRaw(name);
  return parseColor(raw) ?? parseColor(fallback) ?? { r: 0, g: 0, b: 0, a: 1 };
};

const readCssColorString = (name: string, fallback: string): string => {
  const raw = readCssVarRaw(name);
  return raw || fallback;
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

const chartRef = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;
const themeTick = ref(0);

const clampedPercent = computed(() => clamp(toFinite(props.percent, 0), 0, 100));
const animated = computed(() => Boolean(props.animated));
const level = computed<LiquidLevel>(() => {
  const raw = String(props.level ?? "")
    .trim()
    .toLowerCase();
  if (raw === "warn" || raw === "high" || raw === "critical") return raw;
  return "normal";
});

const sizePx = computed(() => {
  if (props.size == null) return null;
  const value = Math.round(Math.max(16, toFinite(props.size, 30)));
  return `${value}px`;
});

const rootStyle = computed(() => {
  const style: Record<string, string> = {};
  if (sizePx.value) {
    style.width = sizePx.value;
    style.height = sizePx.value;
  }
  return style;
});

const ariaLabelText = computed(() => {
  if (props.ariaLabel) return String(props.ariaLabel);
  return `进度 ${Math.round(clampedPercent.value)}%`;
});

const palette = computed<LiquidPalette>(() => {
  // themeTick 变化时强制重新读取 CSS token，保证主题切换后颜色同步变化。
  themeTick.value;

  const accent = readCssColor("--accent", "rgb(38, 154, 242)");
  const warning = readCssColor("--warning", "rgb(245, 158, 11)");
  const danger = readCssColor("--danger", "rgb(255, 123, 114)");

  const bgAccentSoft = readCssColorString("--bg-accent-soft", rgbaString(accent, 0.14));
  const borderAccentHover = readCssColorString("--border-accent-hover", rgbaString(accent, 0.45));

  const bgWarningSoft = readCssColorString("--bg-warning-soft", rgbaString(warning, 0.14));
  const borderWarning = readCssColorString("--border-warning", rgbaString(warning, 0.42));
  const borderWarningHover = readCssColorString("--border-warning-hover", rgbaString(warning, 0.55));

  const bgDangerSoft = readCssColorString("--bg-danger-soft", rgbaString(danger, 0.16));
  const borderDangerHover = readCssColorString("--border-danger-hover", rgbaString(danger, 0.58));

  if (level.value === "warn") {
    return {
      waves: [rgbaString(warning, 0.9), rgbaString(warning, 0.55), rgbaString(warning, 0.82)],
      background: bgWarningSoft,
      border: borderWarning,
      shadow: rgbaString(warning, 0.18),
    };
  }
  if (level.value === "high") {
    return {
      waves: [rgbaString(warning, 0.95), rgbaString(warning, 0.65), rgbaString(warning, 0.88)],
      background: bgWarningSoft,
      border: borderWarningHover,
      shadow: rgbaString(warning, 0.22),
    };
  }
  if (level.value === "critical") {
    return {
      waves: [rgbaString(danger, 0.92), rgbaString(danger, 0.6), rgbaString(danger, 0.86)],
      background: bgDangerSoft,
      border: borderDangerHover,
      shadow: rgbaString(danger, 0.22),
    };
  }
  return {
    waves: [rgbaString(accent, 0.92), rgbaString(accent, 0.55), rgbaString(accent, 0.82)],
    background: bgAccentSoft,
    border: borderAccentHover,
    shadow: rgbaString(accent, 0.16),
  };
});

const buildOption = (): echarts.EChartsOption => {
  const normalized = clampedPercent.value / 100;
  const p = palette.value;
  // 波浪高度：值越小，起伏越平缓。
  const waveAmplitude = animated.value ? 2 : 0;
  // 波浪速度：单位毫秒，值越小移动越快。
  const wavePeriodMs = animated.value ? 1000 : 0;
  // 三层液位高度：层间差值越大，视觉重叠越少。
  const d0 = normalized;
  const d1 = clamp(normalized - 0.12, 0, 1);
  const d2 = clamp(normalized - 0.24, 0, 1);
  return {
    animation: animated.value,
    series: [
      {
        type: "liquidFill",
        silent: true,
        radius: "92%",
        center: ["50%", "50%"],
        data: [d0, d1, d2],
        color: p.waves,
        backgroundStyle: {
          color: p.background,
        },
        outline: {
          show: true,
          borderDistance: 1,
          itemStyle: {
            borderWidth: 1.25,
            borderColor: p.border,
            shadowBlur: 4,
            shadowColor: p.shadow,
          },
        },
        amplitude: waveAmplitude,
        // 波长：值越大单个波峰越宽，视觉更平滑。
        waveLength: "80%",
        period: wavePeriodMs,
        waveAnimation: animated.value,
        animationDurationUpdate: 260,
        label: {
          show: false,
        },
        emphasis: {
          disabled: true,
        },
      } as any,
    ],
  };
};

const renderChart = () => {
  if (!chart) return;
  chart.setOption(buildOption(), { notMerge: true, lazyUpdate: true });
};

onMounted(() => {
  const el = chartRef.value;
  if (!el) return;
  // 组件挂载时初始化图表实例。
  chart = echarts.init(el, undefined, { renderer: "canvas" });
  renderChart();

  // 跟随主题切换（data-theme）更新颜色。
  try {
    const root = document.documentElement;
    themeObserver = new MutationObserver(() => {
      themeTick.value = (themeTick.value + 1) % 1_000_000;
    });
    themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  } catch {}

  // 跟随容器尺寸变化，保证圆球不拉伸。
  resizeObserver = new ResizeObserver(() => {
    if (!chart) return;
    chart.resize();
  });
  resizeObserver.observe(el);
});

watch(
  () => [clampedPercent.value, animated.value, level.value, themeTick.value] as const,
  () => {
    // 进度、动画状态或告警级别变化时重绘。
    renderChart();
  }
);

watch(
  () => sizePx.value,
  () => {
    if (!chart) return;
    // 尺寸变化时先 resize，再 setOption，避免渲染抖动。
    chart.resize();
    renderChart();
  }
);

onBeforeUnmount(() => {
  if (themeObserver) {
    try {
      themeObserver.disconnect();
    } catch {}
    themeObserver = null;
  }
  if (resizeObserver) {
    try {
      resizeObserver.disconnect();
    } catch {}
    resizeObserver = null;
  }
  if (chart) {
    try {
      // 卸载时释放 ECharts 资源，防止内存泄漏。
      chart.dispose();
    } catch {}
    chart = null;
  }
});
</script>

<style scoped>
.ui-waterball-progress {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  overflow: hidden;
  flex: 0 0 auto;
}
</style>


