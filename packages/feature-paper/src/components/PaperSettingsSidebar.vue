<template>
  <aside class="sidebar sidebar-right paper-settings-sidebar" :aria-label="t('paperSidebar.aria')">
    <header class="paper-settings-head">
      <div>
        <div class="paper-settings-eyebrow">Paper</div>
        <h2>{{ t("paperSidebar.title") }}</h2>
      </div>
      <span class="paper-settings-badge mono">{{ selectedSectionWords }}</span>
    </header>

    <div class="paper-settings-scroll app-scrollbar">
      <section class="paper-settings-section">
        <div class="paper-control-label">{{ t("paperSidebar.mode") }}</div>
        <div class="paper-mode-grid">
          <button
            v-for="mode in modes"
            :key="mode.value"
            class="paper-mode-button"
            :class="{ 'is-active': paper.mode === mode.value }"
            type="button"
            @click="paper.setMode(mode.value)"
          >
            <component :is="mode.icon" aria-hidden="true" />
            <span>{{ t(mode.labelKey) }}</span>
          </button>
        </div>
      </section>

      <section class="paper-settings-section">
        <label class="paper-field">
          <span>{{ t("paperSidebar.researchQuestion") }}</span>
          <textarea
            class="paper-textarea"
            rows="5"
            :value="paper.researchQuestion"
            @input="paper.updateResearchQuestion(($event.target as HTMLTextAreaElement).value)"
          />
        </label>

        <label class="paper-field">
          <span>{{ t("paperSidebar.constraints") }}</span>
          <textarea
            class="paper-textarea"
            rows="5"
            :value="paper.constraints"
            @input="paper.updateConstraints(($event.target as HTMLTextAreaElement).value)"
          />
        </label>
      </section>

      <section class="paper-settings-section">
        <div class="paper-section-head">
          <span>{{ t("paperSidebar.references") }}</span>
          <span class="mono">{{ paper.references.length }}</span>
        </div>
        <div class="paper-reference-list">
          <article v-for="reference in paper.references" :key="reference.id" class="paper-reference-item">
            <div class="paper-reference-title">{{ reference.title }}</div>
            <div class="paper-reference-meta">
              <span>{{ reference.meta }}</span>
              <span>{{ t(`paperSidebar.referenceStatus.${reference.statusKey}`) }}</span>
            </div>
          </article>
        </div>
      </section>

      <section class="paper-settings-section">
        <div class="paper-section-head">
          <span>{{ t("paperSidebar.promptPreview") }}</span>
        </div>
        <pre class="paper-prompt-preview app-scrollbar">{{ localizedPrompt }}</pre>
        <button class="paper-primary-action" type="button" @click="copyPrompt">
          <ClipboardCopy aria-hidden="true" />
          <span>{{ t("paperSidebar.copyPrompt") }}</span>
        </button>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ClipboardCopy, FilePenLine, ListTree, Quote, ScanSearch } from "lucide-vue-next";
import { usePaperStore, type PaperGenerationMode } from "../store";
import { showPaperToast } from "../runtimeBridge";

const { t } = useI18n();
const paper = usePaperStore();

const modes: Array<{ value: PaperGenerationMode; labelKey: string; icon: unknown }> = [
  { value: "outline", labelKey: "paperSidebar.modes.outline", icon: ListTree },
  { value: "draft", labelKey: "paperSidebar.modes.draft", icon: FilePenLine },
  { value: "revise", labelKey: "paperSidebar.modes.revise", icon: ScanSearch },
  { value: "citations", labelKey: "paperSidebar.modes.citations", icon: Quote },
];

const selectedSectionWords = computed(() => `${paper.selectedSection.wordTarget}w`);
const localizedPrompt = computed(() =>
  [
    `${t("paperSidebar.promptTask")}: ${t(`paperSidebar.modes.${paper.mode}`)}`,
    `${t("paperSidebar.promptTitle")}: ${paper.title}`,
    `${t("paperSidebar.promptField")}: ${paper.field}`,
    `${t("paperSidebar.promptSection")}: ${t(`paperWorkspace.sectionNames.${paper.selectedSection.titleKey}`)}`,
    `${t("paperSidebar.promptQuestion")}: ${paper.researchQuestion}`,
    `${t("paperSidebar.promptConstraints")}: ${paper.constraints}`,
  ].join("\n")
);

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(localizedPrompt.value);
    showPaperToast({ kind: "success", message: t("paperSidebar.promptCopied") });
  } catch (error) {
    showPaperToast({ kind: "error", message: String((error as Error)?.message ?? error) });
  }
}
</script>

<style scoped>
.paper-settings-sidebar {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-1) 94%, transparent), transparent 42%),
    color-mix(in srgb, var(--bg) 94%, var(--surface-1) 6%);
}

.paper-settings-head {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
}

.paper-settings-eyebrow {
  color: var(--accent);
  font-size: 10px;
  font-weight: 760;
  line-height: 1;
  text-transform: uppercase;
}

.paper-settings-head h2 {
  margin: 5px 0 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 780;
  line-height: 1.2;
}

.paper-settings-badge {
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-1));
  color: var(--text);
  font-size: 11px;
  padding: 4px 8px;
}

.paper-settings-scroll {
  min-height: 0;
  flex: 1 1 auto;
  display: grid;
  align-content: start;
  gap: 13px;
  overflow: auto;
  padding: 12px;
}

.paper-settings-section,
.paper-reference-list {
  display: grid;
  gap: 9px;
}

.paper-control-label,
.paper-section-head,
.paper-field span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 740;
  line-height: 1.2;
}

.paper-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.paper-mode-button {
  min-width: 0;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-1) 86%, transparent);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.paper-mode-button:hover,
.paper-mode-button.is-active {
  border-color: color-mix(in srgb, var(--accent) 44%, var(--border));
  background: color-mix(in srgb, var(--accent) 12%, var(--surface-1));
  color: var(--text);
}

.paper-mode-button svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.paper-field {
  display: grid;
  gap: 6px;
}

.paper-textarea,
.paper-prompt-preview {
  width: 100%;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-code-bg) 88%, transparent);
  color: var(--text);
  font: inherit;
  font-size: 12px;
  line-height: 1.45;
  padding: 9px;
}

.paper-textarea {
  resize: vertical;
}

.paper-textarea:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--accent) 46%, var(--border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent);
}

.paper-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.paper-reference-item {
  min-width: 0;
  display: grid;
  gap: 5px;
  border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-1) 82%, transparent);
  padding: 9px;
}

.paper-reference-title {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  font-weight: 720;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paper-reference-meta {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-muted);
  font-size: 10.5px;
}

.paper-reference-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paper-reference-meta span:last-child {
  flex: 0 0 auto;
  color: var(--accent);
}

.paper-prompt-preview {
  max-height: 190px;
  overflow: auto;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.paper-primary-action {
  width: 100%;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 14%, var(--surface-1));
  color: var(--text);
  font-size: 12px;
  font-weight: 760;
}

.paper-primary-action:hover {
  background: color-mix(in srgb, var(--accent) 20%, var(--surface-1));
}

.paper-primary-action svg {
  width: 14px;
  height: 14px;
}
</style>
