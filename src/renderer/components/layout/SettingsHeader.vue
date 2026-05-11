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

<style scoped>
.settings-header {
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface-1) 96%, transparent),
    color-mix(in srgb, var(--surface-1) 82%, transparent)
  );
  -webkit-app-region: no-drag;
}

.settings-header-inner {
  min-width: 0;
  max-width: none;
  width: 100%;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 14px;
}

.settings-title-block {
  min-width: 160px;
  display: grid;
  gap: 2px;
}

.settings-kicker {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.settings-title-block h1 {
  margin: 0;
  color: var(--text-1);
  font-size: 18px;
  line-height: 1.2;
  font-weight: 720;
}

.settings-status-strip {
  min-width: 0;
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: 8px;
}

.settings-status-item {
  min-width: 0;
  display: grid;
  gap: 2px;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
  background: color-mix(in srgb, var(--surface-2) 42%, transparent);
}

.settings-status-label {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.2;
}

.settings-status-value {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-close {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, var(--surface-1) 82%, transparent);
  color: var(--text-muted);
  cursor: pointer;
  display: inline-grid;
  place-items: center;
  transition:
    background-color 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease;
}

.settings-close:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--border-accent, var(--accent-soft)) 42%, var(--border) 58%);
  background: color-mix(in srgb, var(--accent) 9%, var(--surface-1));
  color: var(--text);
}

.settings-close :deep(svg) {
  width: 16px;
  height: 16px;
  stroke-width: 2.2;
}

@media (max-width: 900px) {
  .settings-status-strip {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 680px) {
  .settings-header-inner {
    align-items: center;
    flex-wrap: wrap;
  }

  .settings-title-block {
    flex: 1 1 auto;
  }

  .settings-status-strip {
    flex-basis: 100%;
    order: 3;
  }
}
</style>
