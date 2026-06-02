<template>
  <button
    id="btn-topbar-theme"
    class="topbar-theme-switch"
    :class="{
      'is-dark': !themeStore.isLight,
      'is-tech': themeStore.theme === 'tech',
      'is-hacker': themeStore.theme === 'hacker',
      'is-pink': themeStore.theme === 'pink',
    }"
    type="button"
    :aria-label="themeAriaLabel"
    @click="onToggleTheme"
  >
    <span class="topbar-theme-switch-icon-wrap" aria-hidden="true">
      <Transition name="topbar-theme-icon" mode="out-in">
        <component :is="themeIcon" :key="themeStore.theme" class="topbar-theme-switch-icon" />
      </Transition>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Cpu, Heart, Moon, Sun, Terminal } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { APP_THEME_ORDER, useThemeStore, type AppThemeName } from "../../../stores/theme.store";

const themeStore = useThemeStore();
const { t } = useI18n();

function localizedThemeLabel(theme: AppThemeName): string {
  if (theme === "light") return t("topbarExtra.themeLight");
  if (theme === "pink") return t("topbarExtra.themePink");
  if (theme === "tech") return t("topbarExtra.themeTech");
  if (theme === "hacker") return t("topbarExtra.themeHacker");
  return t("topbarExtra.themeDark");
}

function nextThemeLabelFor() {
  const currentIndex = APP_THEME_ORDER.indexOf(themeStore.theme);
  const nextTheme =
    currentIndex >= 0 ? APP_THEME_ORDER[(currentIndex + 1) % APP_THEME_ORDER.length] : APP_THEME_ORDER[0];
  return localizedThemeLabel(nextTheme);
}

const themeLabel = computed(() => localizedThemeLabel(themeStore.theme));
const nextThemeLabel = computed(() => nextThemeLabelFor());
const themeAriaLabel = computed(() =>
  t("topbarExtra.themeAria", { current: themeLabel.value, next: nextThemeLabel.value })
);
const themeIcon = computed(() => {
  if (themeStore.theme === "light") return Sun;
  if (themeStore.theme === "pink") return Heart;
  if (themeStore.theme === "tech") return Cpu;
  if (themeStore.theme === "hacker") return Terminal;
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
