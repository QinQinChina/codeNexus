<template>
  <div class="composer-slash-switch">
    <Transition name="composer-slash-content">
      <div
        v-if="commands.length === 0"
        key="empty"
        class="composer-slash-list composer-slash-list--empty"
        aria-live="polite"
      >
        <div class="composer-slash-option composer-slash-option--empty" aria-disabled="true">
          <span class="composer-slash-empty-text mono dim">{{ t("composer.slashNoCommands") }}</span>
        </div>
      </div>
      <div v-else key="list" class="composer-slash-list">
        <button
          v-for="(command, index) in commands"
          :key="command.id"
          type="button"
          class="composer-slash-option group"
          :class="{ 'is-active': index === activeIndex && !command.disabled }"
          :disabled="command.disabled"
          @mouseenter="$emit('hover', index)"
          @click="$emit('select', command.id)"
        >
          <span class="composer-slash-code mono">/{{ command.code }}</span>
          <span class="composer-slash-title">{{ command.title }}</span>
          <span
            v-if="command.disabled && command.disabledHint"
            class="composer-slash-hint mono"
            >{{ command.disabledHint }}</span
          >
          <span
            v-else-if="command.hint"
            class="composer-slash-hint mono"
            >{{ command.hint }}</span
          >
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

export type SlashCommandListItem = {
  id: string;
  code: string;
  title: string;
  hint?: string;
  disabled?: boolean;
  disabledHint?: string;
};

defineProps<{
  commands: SlashCommandListItem[];
  activeIndex: number;
}>();

defineEmits<{
  (event: "hover", index: number): void;
  (event: "select", commandId: string): void;
}>();

const { t } = useI18n();
</script>
