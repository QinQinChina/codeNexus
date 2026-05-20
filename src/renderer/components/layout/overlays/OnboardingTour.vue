<template>
  <div v-if="appShellStore.onboardingTourOpen" class="onboarding-tour" aria-live="polite">
    <div class="onboarding-tour__scrim" aria-hidden="true"></div>
    <div v-if="targetBox" class="onboarding-tour__spotlight" :style="spotlightStyle" aria-hidden="true"></div>

    <section
      ref="cardRef"
      class="onboarding-tour__card"
      :class="{ 'is-floating': Boolean(targetBox) }"
      :style="cardStyle"
      role="dialog"
      aria-modal="false"
      :aria-label="currentStep.title"
    >
      <div class="onboarding-tour__meta">
        <span class="onboarding-tour__step mono">
          {{ t("onboardingTour.progress", { current: currentStepIndex + 1, total: steps.length }) }}
        </span>
        <button class="onboarding-tour__icon-btn" type="button" :aria-label="t('onboardingTour.skip')" @click="skip">
          <X aria-hidden="true" />
        </button>
      </div>

      <h2 class="onboarding-tour__title">{{ currentStep.title }}</h2>
      <p class="onboarding-tour__body">{{ currentStep.body }}</p>
      <p v-if="!targetBox" class="onboarding-tour__fallback mono">
        {{ t("onboardingTour.targetMissing") }}
      </p>

      <div class="onboarding-tour__actions">
        <button
          class="btn-mini onboarding-tour__button"
          type="button"
          :disabled="currentStepIndex === 0"
          @click="previous"
        >
          <ArrowLeft class="onboarding-tour__button-icon" aria-hidden="true" />
          <span>{{ t("onboardingTour.previous") }}</span>
        </button>
        <button
          ref="primaryBtnRef"
          class="btn-mini onboarding-tour__button is-primary"
          type="button"
          @click="nextOrFinish"
        >
          <Check v-if="isLastStep" class="onboarding-tour__button-icon" aria-hidden="true" />
          <ArrowRight v-else class="onboarding-tour__button-icon" aria-hidden="true" />
          <span>{{ isLastStep ? t("onboardingTour.finish") : t("onboardingTour.next") }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type CSSProperties } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-vue-next";
import { useAppShellStore } from "../../../stores/appShell.store";

type TourStep = {
  id: string;
  selector: string;
  title: string;
  body: string;
  prepare: () => void;
};

type RectBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const CARD_WIDTH_PX = 320;
const VIEWPORT_MARGIN_PX = 14;
const TARGET_GAP_PX = 12;
const SPOTLIGHT_PAD_PX = 6;

const appShellStore = useAppShellStore();
const { t } = useI18n();
const cardRef = ref<HTMLElement | null>(null);
const primaryBtnRef = ref<HTMLButtonElement | null>(null);
const targetBox = ref<RectBox | null>(null);
const cardPosition = ref({ top: 0, left: 0 });
let updateRafId: number | null = null;

const steps = computed<TourStep[]>(() => [
  {
    id: "workspace",
    selector: "#btn-workspace-select",
    title: t("onboardingTour.steps.workspace.title"),
    body: t("onboardingTour.steps.workspace.body"),
    prepare: () => {
      appShellStore.closeSettings();
      appShellStore.setMainView("chat", { save: false });
    },
  },
  {
    id: "thread",
    selector: "#btn-add-thread",
    title: t("onboardingTour.steps.thread.title"),
    body: t("onboardingTour.steps.thread.body"),
    prepare: () => {
      appShellStore.closeSettings();
      appShellStore.setMainView("chat", { save: false });
      appShellStore.setLeftSidebarVisible(true, { save: false });
    },
  },
  {
    id: "composer",
    selector: "#input",
    title: t("onboardingTour.steps.composer.title"),
    body: t("onboardingTour.steps.composer.body"),
    prepare: () => {
      appShellStore.closeSettings();
      appShellStore.setMainView("chat", { save: false });
    },
  },
  {
    id: "mode",
    selector: ".composer-mode-group",
    title: t("onboardingTour.steps.mode.title"),
    body: t("onboardingTour.steps.mode.body"),
    prepare: () => {
      appShellStore.closeSettings();
      appShellStore.setMainView("chat", { save: false });
    },
  },
  {
    id: "settings",
    selector: "#btn-open-settings",
    title: t("onboardingTour.steps.settings.title"),
    body: t("onboardingTour.steps.settings.body"),
    prepare: () => {
      appShellStore.closeSettings();
      appShellStore.setMainView("chat", { save: false });
    },
  },
]);

const currentStepIndex = computed(() => {
  const count = steps.value.length;
  return Math.max(0, Math.min(count - 1, appShellStore.onboardingTourStepIndex));
});
const currentStep = computed(() => steps.value[currentStepIndex.value] ?? steps.value[0]);
const isLastStep = computed(() => currentStepIndex.value >= steps.value.length - 1);

const spotlightStyle = computed<CSSProperties>(() => {
  const box = targetBox.value;
  if (!box) return {};
  return {
    top: `${Math.max(VIEWPORT_MARGIN_PX, box.top - SPOTLIGHT_PAD_PX)}px`,
    left: `${Math.max(VIEWPORT_MARGIN_PX, box.left - SPOTLIGHT_PAD_PX)}px`,
    width: `${Math.max(0, box.width + SPOTLIGHT_PAD_PX * 2)}px`,
    height: `${Math.max(0, box.height + SPOTLIGHT_PAD_PX * 2)}px`,
  };
});

const cardStyle = computed<CSSProperties>(() => ({
  top: `${cardPosition.value.top}px`,
  left: `${cardPosition.value.left}px`,
  width: `${CARD_WIDTH_PX}px`,
}));

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readTargetBox(): RectBox | null {
  const selector = currentStep.value?.selector;
  if (!selector) return null;
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    top: Math.round(rect.top),
    left: Math.round(rect.left),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function resolveCardPosition(box: RectBox | null): { top: number; left: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const cardHeight = Math.max(180, Math.round(cardRef.value?.getBoundingClientRect().height ?? 220));
  const maxLeft = Math.max(VIEWPORT_MARGIN_PX, viewportWidth - CARD_WIDTH_PX - VIEWPORT_MARGIN_PX);
  const maxTop = Math.max(VIEWPORT_MARGIN_PX, viewportHeight - cardHeight - VIEWPORT_MARGIN_PX);

  if (!box) {
    return {
      top: clamp(Math.round((viewportHeight - cardHeight) / 2), VIEWPORT_MARGIN_PX, maxTop),
      left: clamp(Math.round((viewportWidth - CARD_WIDTH_PX) / 2), VIEWPORT_MARGIN_PX, maxLeft),
    };
  }

  const centeredLeft = clamp(Math.round(box.left + box.width / 2 - CARD_WIDTH_PX / 2), VIEWPORT_MARGIN_PX, maxLeft);
  const belowTop = box.top + box.height + TARGET_GAP_PX;
  if (belowTop + cardHeight <= viewportHeight - VIEWPORT_MARGIN_PX) {
    return { top: belowTop, left: centeredLeft };
  }

  const aboveTop = box.top - cardHeight - TARGET_GAP_PX;
  if (aboveTop >= VIEWPORT_MARGIN_PX) {
    return { top: aboveTop, left: centeredLeft };
  }

  const rightLeft = box.left + box.width + TARGET_GAP_PX;
  if (rightLeft + CARD_WIDTH_PX <= viewportWidth - VIEWPORT_MARGIN_PX) {
    return {
      top: clamp(Math.round(box.top + box.height / 2 - cardHeight / 2), VIEWPORT_MARGIN_PX, maxTop),
      left: rightLeft,
    };
  }

  const leftLeft = box.left - CARD_WIDTH_PX - TARGET_GAP_PX;
  if (leftLeft >= VIEWPORT_MARGIN_PX) {
    return {
      top: clamp(Math.round(box.top + box.height / 2 - cardHeight / 2), VIEWPORT_MARGIN_PX, maxTop),
      left: leftLeft,
    };
  }

  return {
    top: clamp(Math.round(viewportHeight - cardHeight - VIEWPORT_MARGIN_PX), VIEWPORT_MARGIN_PX, maxTop),
    left: centeredLeft,
  };
}

function updatePlacement() {
  updateRafId = null;
  const box = readTargetBox();
  targetBox.value = box;
  cardPosition.value = resolveCardPosition(box);
}

function schedulePlacementUpdate() {
  if (updateRafId != null) cancelAnimationFrame(updateRafId);
  updateRafId = requestAnimationFrame(updatePlacement);
}

async function prepareCurrentStep() {
  currentStep.value.prepare();
  await nextTick();
  schedulePlacementUpdate();
  window.setTimeout(schedulePlacementUpdate, 180);
}

function previous() {
  if (currentStepIndex.value <= 0) return;
  appShellStore.setOnboardingTourStepIndex(currentStepIndex.value - 1);
}

function nextOrFinish() {
  if (isLastStep.value) {
    appShellStore.closeOnboardingTour({ markSeen: true });
    return;
  }
  appShellStore.setOnboardingTourStepIndex(currentStepIndex.value + 1);
}

function skip() {
  appShellStore.closeOnboardingTour({ markSeen: true });
}

function onWindowKeydown(event: KeyboardEvent) {
  if (!appShellStore.onboardingTourOpen) return;
  if (event.key === "Escape") {
    event.preventDefault();
    skip();
    return;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    previous();
    return;
  }
  if (event.key === "ArrowRight" || event.key === "Enter") {
    event.preventDefault();
    nextOrFinish();
  }
}

watch(
  () => [appShellStore.onboardingTourOpen, currentStepIndex.value, currentStep.value?.id] as const,
  ([open]) => {
    if (!open) return;
    void prepareCurrentStep();
    nextTick(() => primaryBtnRef.value?.focus({ preventScroll: true }));
  },
  { immediate: true }
);

watch(
  () => steps.value.length,
  (count) => {
    if (!appShellStore.onboardingTourOpen) return;
    if (appShellStore.onboardingTourStepIndex < count) return;
    appShellStore.setOnboardingTourStepIndex(Math.max(0, count - 1));
  }
);

window.addEventListener("resize", schedulePlacementUpdate);
window.addEventListener("scroll", schedulePlacementUpdate, true);
window.addEventListener("keydown", onWindowKeydown, true);

onBeforeUnmount(() => {
  window.removeEventListener("resize", schedulePlacementUpdate);
  window.removeEventListener("scroll", schedulePlacementUpdate, true);
  window.removeEventListener("keydown", onWindowKeydown, true);
  if (updateRafId != null) cancelAnimationFrame(updateRafId);
});
</script>

<style scoped>
.onboarding-tour {
  position: fixed;
  inset: 0;
  z-index: 75;
  pointer-events: none;
}

.onboarding-tour__scrim {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, rgb(from var(--bg) r g b / 0.6) 86%, transparent);
  backdrop-filter: blur(2px);
}

.onboarding-tour__spotlight {
  position: fixed;
  border: 1px solid color-mix(in srgb, var(--accent) 76%, white 10%);
  border-radius: 8px;
  box-shadow:
    0 0 0 9999px color-mix(in srgb, rgb(from var(--bg) r g b / 0.56) 90%, transparent),
    0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent),
    0 12px 28px color-mix(in srgb, var(--theme-seed-shadow-source) 26%, transparent);
}

.onboarding-tour__card {
  position: fixed;
  display: grid;
  gap: 10px;
  max-width: calc(100vw - 28px);
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--panel-border, var(--border)) 76%, var(--accent) 24%);
  border-radius: 8px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 96%, transparent), var(--surface-1));
  box-shadow:
    0 20px 44px color-mix(in srgb, var(--theme-seed-shadow-source) 28%, transparent),
    0 0 0 1px color-mix(in srgb, white 5%, transparent) inset;
  pointer-events: auto;
}

.onboarding-tour__meta {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.onboarding-tour__step {
  min-width: 0;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.2;
}

.onboarding-tour__icon-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  border-radius: 6px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--surface-2) 74%, transparent);
}

.onboarding-tour__icon-btn:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--border-accent, var(--accent)) 44%, transparent);
}

.onboarding-tour__icon-btn svg {
  width: 15px;
  height: 15px;
}

.onboarding-tour__title {
  margin: 0;
  color: var(--text);
  font-size: 15px;
  line-height: 1.3;
  font-weight: 700;
  letter-spacing: 0;
}

.onboarding-tour__body {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.55;
}

.onboarding-tour__fallback {
  margin: 0;
  padding: 7px 8px;
  border: 1px solid color-mix(in srgb, var(--warning) 36%, transparent);
  border-radius: 6px;
  color: color-mix(in srgb, var(--warning) 78%, var(--text) 22%);
  background: color-mix(in srgb, var(--warning) 11%, transparent);
  font-size: 11px;
  line-height: 1.35;
}

.onboarding-tour__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 2px;
}

.onboarding-tour__button {
  min-width: 86px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.onboarding-tour__button.is-primary {
  border-color: color-mix(in srgb, var(--accent) 46%, transparent);
  color: var(--text);
  background: color-mix(in srgb, var(--accent) 16%, var(--surface-2) 84%);
}

.onboarding-tour__button-icon {
  width: 14px;
  height: 14px;
}

@media (prefers-reduced-motion: reduce) {
  .onboarding-tour__scrim {
    backdrop-filter: none;
  }
}
</style>
