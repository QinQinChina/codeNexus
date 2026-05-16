<template>
  <header class="settings-header" aria-label="设置页头">
    <div class="settings-header-inner">
      <div class="settings-title-block">
        <div class="settings-kicker">CodeNexus</div>
        <h1>设置中心</h1>
      </div>

      <div class="settings-status-strip" aria-label="设置摘要">
        <div class="settings-status-item">
          <span class="settings-status-label">当前 Profile</span>
          <span class="settings-status-value mono">{{ activeProfileText }}</span>
        </div>
        <div class="settings-status-item">
          <span class="settings-status-label">官方生图</span>
          <span class="settings-status-value mono">app-server</span>
        </div>
        <div class="settings-status-item">
          <span class="settings-status-label">远程同步</span>
          <span class="settings-status-value mono">{{ remoteSyncText }}</span>
        </div>
      </div>

      <button
        id="btn-settings-close"
        class="settings-close"
        type="button"
        aria-label="关闭设置"
        title="关闭设置"
        @click="appShellStore.closeSettings()"
      >
        <X aria-hidden="true" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { X } from "lucide-vue-next";
import { useAppShellStore } from "../../stores/appShell.store";
import { useCodexProfilesStore } from "../../stores/codexProfiles.store";
import { useRemoteSyncStore } from "../../stores/remoteSync.store";

const appShellStore = useAppShellStore();
const profilesStore = useCodexProfilesStore();
const remoteSyncStore = useRemoteSyncStore();

const activeProfileText = computed(() => {
  if (profilesStore.loadState === "loading") return "loading";
  const profile = profilesStore.activeProfile;
  if (profile?.name) return profile.name;
  return profilesStore.activeProfileId || "未启用";
});
const remoteSyncText = computed(() => {
  const phase = remoteSyncStore.state.phase;
  if (phase === "syncing") return "syncing";
  if (phase === "error") return "error";
  if (phase === "disabled") return "disabled";
  return "idle";
});

onMounted(() => {
  if (profilesStore.loadState === "idle") void profilesStore.refresh();
});
</script>
