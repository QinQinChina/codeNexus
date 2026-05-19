<template>
  <div class="codex-profile-switch">
    <SelectDropdown
      id="codex-profile-select"
      class="codex-profile-switch__select"
      :modelValue="selectedValue"
      :options="profileOptions"
      :disabled="selectDisabled"
      :ariaLabel="t('codexProfileSwitch.aria')"
      :minPopoverWidth="220"
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

const profileOptions = computed(() => [
  { value: "", label: t("codexProfileSwitch.choose"), disabled: true },
  ...profilesStore.profiles.map((profile) => ({
    value: profile.id,
    label: profile.name,
  })),
]);

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
  min-width: 160px;
  max-width: min(300px, 36vw);
  height: 26px;
  padding: 0 8px;
  border-radius: 5px;
  color: var(--text);
}

@media (max-width: 860px) {
  .codex-profile-switch {
    max-width: 240px;
  }

  .codex-profile-switch__select {
    max-width: 170px;
  }
}
</style>
