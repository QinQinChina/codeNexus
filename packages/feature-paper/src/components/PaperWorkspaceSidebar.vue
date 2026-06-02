<template>
  <aside class="sidebar sidebar-left paper-workspace-sidebar" :aria-label="t('paperWorkspace.aria')">
    <div class="paper-side-shell">
      <header class="paper-side-head">
        <div class="paper-side-title-block">
          <span class="paper-side-icon" aria-hidden="true">
            <BookOpen />
          </span>
          <div class="paper-side-title-copy">
            <h2>{{ t("paperWorkspace.title") }}</h2>
            <span class="mono">{{ t("paperWorkspace.progress", { progress: paper.progressPercent }) }}</span>
          </div>
        </div>
      </header>

      <div class="paper-side-scroll app-scrollbar">
        <section class="paper-project-panel">
          <div class="paper-project-title">{{ paper.title }}</div>
          <div class="paper-project-meta">
            <span>{{ paper.field }}</span>
            <span class="mono">{{ paper.targetWords.toLocaleString() }} words</span>
          </div>
          <div class="paper-progress-track" aria-hidden="true">
            <div class="paper-progress-bar" :style="{ width: `${paper.progressPercent}%` }"></div>
          </div>
        </section>

        <section class="paper-side-section">
          <div class="paper-section-head">
            <span>{{ t("paperWorkspace.sections") }}</span>
            <span class="mono">{{ paper.completedSectionCount }}/{{ paper.sections.length }}</span>
          </div>
          <div class="paper-section-list">
            <button
              v-for="section in paper.sections"
              :key="section.id"
              class="paper-section-item"
              :class="[`is-${section.status}`, { 'is-active': section.id === paper.selectedSectionId }]"
              type="button"
              @click="paper.selectSection(section.id)"
            >
              <span class="paper-section-status" aria-hidden="true"></span>
              <span class="paper-section-copy">
                <span class="paper-section-title">{{ t(`paperWorkspace.sectionNames.${section.titleKey}`) }}</span>
                <span class="paper-section-note">{{ t(`paperWorkspace.sectionNotes.${section.noteKey}`) }}</span>
              </span>
              <span class="paper-section-words mono">{{ section.wordTarget }}</span>
            </button>
          </div>
        </section>

        <section class="paper-side-section">
          <div class="paper-section-head">
            <span>{{ t("paperWorkspace.queue") }}</span>
            <span class="mono">{{ paper.activeSectionCount }}</span>
          </div>
          <div class="paper-task-list">
            <article v-for="task in paper.tasks" :key="task.id" class="paper-task-item" :class="`is-${task.status}`">
              <div class="paper-task-topline">
                <span>{{ t(`paperWorkspace.tasks.${task.titleKey}`) }}</span>
                <span>{{ statusLabel(task.status) }}</span>
              </div>
              <p>{{ t(`paperWorkspace.tasks.${task.descriptionKey}`) }}</p>
            </article>
          </div>
        </section>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { BookOpen } from "lucide-vue-next";
import { usePaperStore, type PaperSectionStatus } from "../store";

const { t } = useI18n();
const paper = usePaperStore();

function statusLabel(status: PaperSectionStatus): string {
  return t(`paperWorkspace.status.${status}`);
}
</script>

<style scoped>
.paper-workspace-sidebar {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.paper-side-shell {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--lsb-bg-strong) 94%, transparent), var(--lsb-bg)),
    var(--lsb-bg);
}

.paper-side-head {
  padding: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--lsb-line) 78%, transparent);
}

.paper-side-title-block {
  min-width: 0;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.paper-side-icon {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--lsb-accent) 24%, var(--lsb-line));
  border-radius: 8px;
  background: color-mix(in srgb, var(--lsb-accent) 11%, var(--lsb-surface));
  color: color-mix(in srgb, var(--lsb-accent) 82%, var(--lsb-text));
}

.paper-side-icon svg {
  width: 16px;
  height: 16px;
}

.paper-side-title-copy {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.paper-side-title-copy h2 {
  margin: 0;
  color: var(--lsb-text);
  font-size: 15px;
  line-height: 1.2;
}

.paper-side-title-copy .mono {
  color: var(--lsb-muted);
  font-size: 10.5px;
}

.paper-side-scroll {
  min-height: 0;
  flex: 1 1 auto;
  display: grid;
  align-content: start;
  gap: 12px;
  overflow: auto;
  padding: 12px;
}

.paper-project-panel,
.paper-task-item {
  border: 1px solid color-mix(in srgb, var(--lsb-line) 82%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--lsb-surface) 78%, transparent);
}

.paper-project-panel {
  display: grid;
  gap: 9px;
  padding: 10px;
}

.paper-project-title {
  color: var(--lsb-text);
  font-size: 13px;
  font-weight: 780;
  line-height: 1.35;
}

.paper-project-meta,
.paper-section-head,
.paper-task-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.paper-project-meta,
.paper-section-head {
  color: var(--lsb-muted);
  font-size: 11px;
  line-height: 1.2;
}

.paper-progress-track {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lsb-line) 72%, transparent);
}

.paper-progress-bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--lsb-accent), color-mix(in srgb, var(--success) 70%, var(--lsb-accent)));
}

.paper-side-section,
.paper-section-list,
.paper-task-list {
  display: grid;
  gap: 8px;
}

.paper-section-head {
  min-height: 24px;
  font-weight: 760;
}

.paper-section-item {
  min-width: 0;
  min-height: 54px;
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: color-mix(in srgb, var(--lsb-surface) 72%, transparent);
  color: var(--lsb-text);
  padding: 8px;
  text-align: left;
}

.paper-section-item:hover,
.paper-section-item.is-active {
  border-color: color-mix(in srgb, var(--lsb-accent) 38%, var(--lsb-line));
  background: color-mix(in srgb, var(--lsb-accent) 9%, var(--lsb-surface));
}

.paper-section-item.is-active {
  box-shadow: var(--lsb-active-shadow);
}

.paper-section-status {
  width: 8px;
  height: 32px;
  border-radius: 999px;
  background: var(--lsb-line);
}

.paper-section-item.is-drafting .paper-section-status,
.paper-task-item.is-drafting {
  --paper-status-color: var(--accent);
}

.paper-section-item.is-review .paper-section-status,
.paper-task-item.is-review {
  --paper-status-color: var(--warning);
}

.paper-section-item.is-done .paper-section-status,
.paper-task-item.is-done {
  --paper-status-color: var(--success);
}

.paper-section-item.is-todo .paper-section-status,
.paper-task-item.is-todo {
  --paper-status-color: var(--text-muted);
}

.paper-section-status {
  background: color-mix(in srgb, var(--paper-status-color, var(--lsb-line)) 72%, transparent);
}

.paper-section-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.paper-section-title {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 780;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paper-section-note {
  min-width: 0;
  overflow: hidden;
  color: var(--lsb-muted);
  font-size: 11px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paper-section-words {
  color: var(--lsb-muted);
  font-size: 10.5px;
}

.paper-task-item {
  display: grid;
  gap: 6px;
  padding: 9px;
  border-color: color-mix(in srgb, var(--paper-status-color, var(--lsb-line)) 30%, var(--lsb-line));
}

.paper-task-topline {
  color: var(--lsb-text);
  font-size: 12px;
  font-weight: 750;
}

.paper-task-topline span:last-child {
  color: color-mix(in srgb, var(--paper-status-color, var(--lsb-muted)) 78%, var(--lsb-muted));
  font-size: 10px;
  white-space: nowrap;
}

.paper-task-item p {
  margin: 0;
  color: var(--lsb-muted);
  font-size: 11px;
  line-height: 1.38;
}
</style>
