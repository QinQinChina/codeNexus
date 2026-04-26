<template>
  <button
    id="btn-topbar-theme"
    class="topbar-theme-switch"
    type="button"
    :aria-label="themeAriaLabel"
    :title="themeAriaLabel"
    @click="onToggleTheme"
  >
    <span class="topbar-theme-switch-glow" aria-hidden="true"></span>
    <span class="topbar-theme-switch-orb" aria-hidden="true">
      <component :is="themeIcon" class="topbar-theme-switch-icon" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Moon, Sun } from "lucide-vue-next";
import type { AppThemeName } from "../../../stores/theme.store";
import { useThemeStore } from "../../../stores/theme.store";

const themeStore = useThemeStore();
const themeOrder: AppThemeName[] = ["light", "dark"];

function themeLabelFor(value: AppThemeName): string {
  if (value === "light") return "浅色";
  return "深色";
}

function nextThemeLabelFor(value: AppThemeName): string {
  const currentIndex = themeOrder.indexOf(value);
  const nextTheme = currentIndex >= 0 ? themeOrder[(currentIndex + 1) % themeOrder.length] : themeOrder[0];
  return themeLabelFor(nextTheme);
}

const themeLabel = computed(() => themeLabelFor(themeStore.theme));
const nextThemeLabel = computed(() => nextThemeLabelFor(themeStore.theme));
const themeAriaLabel = computed(() => `切换主题，当前${themeLabel.value}，下一个${nextThemeLabel.value}`);
const themeIcon = computed(() => {
  if (themeStore.theme === "light") return Sun;
  return Moon;
});

function onToggleTheme(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement | null;
  const rect = target?.getBoundingClientRect();
  themeStore.cycleTheme(
    themeOrder,
    rect
      ? {
          transitionOrigin: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          },
        }
      : undefined
  );
}
</script>
