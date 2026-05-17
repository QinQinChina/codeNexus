<template>
  <div class="codex-profile-switch">
    <Bot class="codex-profile-switch__icon" aria-hidden="true" />
    <SelectDropdown
      v-if="profilesStore.profiles.length > 0"
      id="codex-profile-select"
      class="codex-profile-switch__select"
      :modelValue="selectedValue"
      :options="profileOptions"
      :disabled="selectDisabled"
      ariaLabel="Codex 模型配置"
      :minPopoverWidth="220"
      @update:modelValue="onSelectProfile"
    />
    <button v-else class="codex-profile-switch__empty" type="button" @click="openProfileSettings">模型配置</button>
    <button
      class="btn-icon codex-profile-switch__settings"
      type="button"
      @click="openProfileSettings"
    >
      <Settings2 aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Bot, Settings2 } from "lucide-vue-next";
import SelectDropdown from "../../ui/SelectDropdown.vue";
import { getRuntimeOrchestrator } from "../../../domain/runtimeOrchestrator";
import { useAppShellStore } from "../../../stores/appShell.store";
import { useCodexProfilesStore } from "../../../stores/codexProfiles.store";
import { useRuntimeStore } from "../../../stores/runtime.store";

const runtime = getRuntimeOrchestrator();
const appShellStore = useAppShellStore();
const runtimeStore = useRuntimeStore();
const profilesStore = useCodexProfilesStore();
const switchingId = ref("");

const profileOptions = computed(() => [
  { value: "", label: "选择模型配置", disabled: true },
  ...profilesStore.profiles.map((profile) => ({
    value: profile.id,
    label: `${profile.name} · ${profile.model}`,
  })),
]);

const selectedValue = computed(() => String(profilesStore.activeProfileId ?? ""));
const selectDisabled = computed(
  () => !runtimeStore.serverId || profilesStore.profiles.length === 0 || Boolean(switchingId.value)
);

function openProfileSettings() {
  appShellStore.openSettings("profiles");
}

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
  width: min(420px, 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 2px 3px 2px 8px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--panel-border, var(--border)) 70%, transparent);
  background: color-mix(in srgb, var(--panel-bg, var(--surface-1)) 86%, transparent);
  -webkit-app-region: no-drag;
}

.codex-profile-switch__icon {
  width: 15px;
  height: 15px;
  stroke-width: 2.1;
  color: var(--text-muted);
  flex: 0 0 auto;
}

.codex-profile-switch__select {
  min-width: 160px;
  max-width: min(300px, 36vw);
  height: 26px;
  padding: 0 8px;
  border-radius: 5px;
  border-color: transparent;
  background: transparent;
  color: var(--text);
}

.codex-profile-switch__empty {
  min-width: 94px;
  height: 26px;
  border-radius: 5px;
  color: var(--text);
}

.codex-profile-switch__settings {
  width: 26px;
  min-width: 26px;
  height: 24px;
  border-radius: 5px;
}

.codex-profile-switch__settings :deep(svg) {
  width: 14px;
  height: 14px;
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
