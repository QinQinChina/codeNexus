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
import { APP_THEME_ORDER, themeLabelFor, useThemeStore } from "../../../stores/theme.store";

const themeStore = useThemeStore();

function nextThemeLabelFor() {
  const currentIndex = APP_THEME_ORDER.indexOf(themeStore.theme);
  const nextTheme =
    currentIndex >= 0 ? APP_THEME_ORDER[(currentIndex + 1) % APP_THEME_ORDER.length] : APP_THEME_ORDER[0];
  return themeLabelFor(nextTheme);
}

const themeLabel = computed(() => themeLabelFor(themeStore.theme));
const nextThemeLabel = computed(() => nextThemeLabelFor());
const themeAriaLabel = computed(() => `切换主题，当前${themeLabel.value}，下一个${nextThemeLabel.value}`);
const themeIcon = computed(() => {
  if (themeStore.theme === "light") return Sun;
  return Moon;
});

function onToggleTheme(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement | null;
  const rect = target?.getBoundingClientRect();
  themeStore.cycleTheme(
    APP_THEME_ORDER,
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
