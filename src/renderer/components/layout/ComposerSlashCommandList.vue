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
          <span class="composer-slash-empty-text mono dim">未匹配到命令</span>
        </div>
      </div>
      <div v-else key="list" class="composer-slash-list">
        <button
          v-for="(command, index) in commands"
          :key="command.id"
          type="button"
          class="composer-slash-option group"
          :class="{ 'is-active': index === activeIndex && !command.disabled }"
          :title="
            command.disabled ? command.disabledHint || command.hint || command.title : command.hint || command.title
          "
          :disabled="command.disabled"
          @mouseenter="$emit('hover', index)"
          @click="$emit('select', command.id)"
        >
          <span class="composer-slash-code mono transition-colors duration-200" :class="index === activeIndex ? 'bg-[var(--accent)] text-[var(--surface-1)] border-transparent' : 'bg-[var(--bg-accent-soft)] text-[var(--text)] border-[var(--border-accent)]'">/{{ command.code }}</span>
          <span class="composer-slash-title font-medium transition-colors duration-200" :class="index === activeIndex ? 'text-[var(--accent)]' : ''">{{ command.title }}</span>
          <span v-if="command.disabled && command.disabledHint" class="composer-slash-hint mono dim text-[11px] opacity-60">{{
            command.disabledHint
          }}</span>
          <span v-else-if="command.hint" class="composer-slash-hint mono dim text-[11px] opacity-60 transition-opacity duration-200 group-hover:opacity-100">{{ command.hint }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
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
</script>
