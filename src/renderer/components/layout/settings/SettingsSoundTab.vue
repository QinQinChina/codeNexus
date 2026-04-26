<template>
  <section class="settings-card" aria-label="提示音设置">
    <header class="settings-card-head">
      <div class="settings-card-title">提示音</div>
      <div class="row" style="gap: 8px; align-items: center">
        <button
          id="btn-settings-sound-preview"
          class="btn-mini"
          type="button"
          :disabled="notificationSoundControlsDisabled"
          @click="onPreview"
        >
          试听
        </button>
      </div>
    </header>

    <div class="settings-card-body">
      <div class="settings-grid">
        <label class="settings-row">
          <span class="context-label dim">铃声</span>
          <SelectDropdown
            id="sel-settings-notification-sound"
            class="context-input mono w-full"
            :modelValue="notificationSoundStore.selectedId"
            :disabled="notificationSoundControlsDisabled"
            :options="notificationSoundDropdownOptions"
            :minPopoverWidth="260"
            @update:modelValue="onSoundChange"
          />
        </label>

        <div v-if="notificationSoundStatusText" class="dim text-[12px] leading-[1.25]">
          {{ notificationSoundStatusText }}
        </div>

        <label class="settings-row">
          <span class="context-label dim">音量</span>
          <div class="settings-volume">
            <input
              id="rng-settings-notification-sound-volume"
              class="settings-volume-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              :value="notificationSoundStore.volumePercent"
              @input="onVolumeInput"
              @change="onVolumeChange"
            />
            <span class="mono dim settings-volume-value">{{ notificationSoundStore.volumePercent }}%</span>
          </div>
        </label>

        <div class="dim text-[12px] leading-[1.25]">线程结束时将播放一次提示音。音量设置会影响所有提示音播放。</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SelectDropdown from "../../ui/SelectDropdown.vue";
import { useNotificationSoundStore } from "../../../stores/notificationSound.store";
import { playNotificationSoundOnce } from "../../../features/notificationSound/player";

const notificationSoundStore = useNotificationSoundStore();

const notificationSoundDropdownOptions = computed(() => {
  return notificationSoundStore.available.map((item) => ({ value: item.id, label: item.label }));
});

const notificationSoundControlsDisabled = computed(() => {
  if (notificationSoundStore.loadState === "loading") return true;
  return notificationSoundStore.available.length === 0;
});

const notificationSoundStatusText = computed(() => {
  if (notificationSoundStore.loadState === "idle") return "";
  if (notificationSoundStore.loadState === "loading") return "加载中…";
  if (notificationSoundStore.loadState === "error") {
    return notificationSoundStore.errorText ? `加载失败：${notificationSoundStore.errorText}` : "加载失败";
  }
  if (notificationSoundStore.available.length === 0) return "未发现内置铃声（music/）";
  return "";
});

const onSoundChange = (nextRaw: string) => {
  const next = String(nextRaw ?? "").trim();
  if (!next) return;
  notificationSoundStore.setSelectedId(next, { save: true });
};

const onPreview = async () => {
  const id = String(notificationSoundStore.selectedId ?? "").trim();
  if (!id) return;
  await playNotificationSoundOnce({ soundId: id, force: true, volumePercent: notificationSoundStore.volumePercent });
};

const onVolumeInput = (event: Event) => {
  const el = event.target as HTMLInputElement | null;
  if (!el) return;
  notificationSoundStore.setVolumePercent(Number(el.value), { save: false });
};

const onVolumeChange = (event: Event) => {
  const el = event.target as HTMLInputElement | null;
  if (!el) return;
  notificationSoundStore.setVolumePercent(Number(el.value), { save: true });
};
</script>

<style scoped>
.settings-card {
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, var(--surface-1) 86%, transparent);
  box-shadow: 0 14px 34px color-mix(in srgb, rgb(from var(--ui-shadow-source) r g b / 0.6) 18%, transparent);
  overflow: hidden;
}

.settings-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface-1) 92%, transparent),
    color-mix(in srgb, var(--surface-1) 76%, transparent)
  );
}

.settings-card-title {
  font-weight: 650;
  letter-spacing: 0.2px;
}

.settings-card-body {
  padding: 12px;
}

.settings-grid {
  display: grid;
  gap: 10px;
}

.settings-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.settings-volume {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-volume-slider {
  flex: 1 1 auto;
  min-width: 0;
}

.settings-volume-value {
  flex: 0 0 auto;
  width: 52px;
  text-align: right;
}
</style>
