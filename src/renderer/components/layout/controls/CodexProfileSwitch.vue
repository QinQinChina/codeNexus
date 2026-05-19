<template>
  <div class="codex-profile-switch">
    <SelectDropdown
      id="codex-profile-select"
      class="codex-profile-switch__select"
      :modelValue="selectedValue"
      :options="profileOptions"
      :disabled="selectDisabled"
      :ariaLabel="t('codexProfileSwitch.aria')"
      :placeholder="t('codexProfileSwitch.unselected')"
      :minPopoverWidth="180"
      @update:modelValue="onSelectProfile"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import SelectDropdown from "../../ui/SelectDropdown.vue";
import { getRuntimeOrchestrator } from "../../../domain/runtimeOrchestrator";
import { useCodexProfilesStore } from "../../../stores/codexProfiles.store";
import { useRuntimeStore } from "../../../stores/runtime.store";

const runtime = getRuntimeOrchestrator();
const runtimeStore = useRuntimeStore();
const profilesStore = useCodexProfilesStore();
const { t } = useI18n();
const switchingId = ref("");

const profileOptions = computed(() =>
  profilesStore.profiles.map((profile) => ({
    value: profile.id,
    label: profile.name,
  }))
);

const selectedValue = computed(() => String(profilesStore.activeProfileId ?? ""));
const selectDisabled = computed(
  () => !runtimeStore.serverId || profilesStore.profiles.length === 0 || Boolean(switchingId.value)
);

async function onSelectProfile(profileId: string) {
  const id = String(profileId ?? "").trim();
  if (!id || switchingId.value === id) return;
  switchingId.value = id;
  try {
    await runtime.applyCodexProfile(id);
  } finally {
    switchingId.value = "";
  }
}

onMounted(() => {
  if (profilesStore.loadState === "idle") void profilesStore.refresh();
});
</script>

<style scoped>
.codex-profile-switch {
  min-width: 0;
  width: fit-content;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0;
  -webkit-app-region: no-drag;
}

.codex-profile-switch__select {
  width: clamp(148px, 18vw, 220px);
  min-width: 0;
  height: 24px;
  padding: 0 7px 0 10px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--panel-border, var(--border)) 76%, transparent);
  background: color-mix(in srgb, var(--control-surface, var(--button-bg)) 88%, transparent);
  color: var(--text);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text) 7%, transparent);
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease,
    color 160ms ease;
}

.codex-profile-switch__select:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--border-accent, var(--accent)) 48%, var(--panel-border, var(--border)));
  background: color-mix(in srgb, var(--control-surface, var(--button-bg)) 78%, var(--accent) 8%);
}

.codex-profile-switch__select:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--border-accent, var(--accent)) 68%, var(--panel-border, var(--border)));
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--text) 8%, transparent);
}

.codex-profile-switch__select:disabled {
  opacity: 0.55;
}

.codex-profile-switch__select :deep(.ui-select-value) {
  font-size: 12px;
  line-height: 1;
  letter-spacing: 0;
}

.codex-profile-switch__select :deep(.ui-select-chevron) {
  font-size: 11px;
  margin-left: 2px;
  color: color-mix(in srgb, var(--text-muted) 78%, transparent);
}

:global(#codex-profile-select__listbox) {
  padding: 4px 0;
  gap: 0;
}

:global(#codex-profile-select__listbox .ui-select-option) {
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--floating-border, var(--border)) 58%, transparent);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

:global(#codex-profile-select__listbox .ui-select-option:last-child) {
  border-bottom: 0;
}

:global(#codex-profile-select__listbox .ui-select-option:hover:not(:disabled)),
:global(#codex-profile-select__listbox .ui-select-option.is-active:not(:disabled)) {
  border-color: color-mix(in srgb, var(--floating-border, var(--border)) 58%, transparent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  box-shadow: none;
}

:global(#codex-profile-select__listbox .ui-select-option.is-selected:not(:disabled)) {
  border-color: color-mix(in srgb, var(--floating-border, var(--border)) 58%, transparent);
  background: transparent;
  color: var(--accent);
  font-weight: 600;
  box-shadow: none;
}

:global(#codex-profile-select__listbox .ui-select-option.is-selected:hover:not(:disabled)),
:global(#codex-profile-select__listbox .ui-select-option.is-selected.is-active:not(:disabled)) {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

@media (max-width: 860px) {
  .codex-profile-switch {
    max-width: 240px;
  }

  .codex-profile-switch__select {
    width: clamp(130px, 36vw, 170px);
  }
}
</style>
