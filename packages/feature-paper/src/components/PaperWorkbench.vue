<template>
  <section class="paper-workbench" :aria-label="t('paperWorkbench.aria')">
    <header class="paper-workbench-toolbar">
      <div class="paper-workbench-title">
        <span class="paper-workbench-title__icon" aria-hidden="true">
          <FileText />
        </span>
        <div>
          <div class="paper-workbench-kicker">{{ t("paperWorkbench.kicker") }}</div>
          <h1>{{ paper.title }}</h1>
        </div>
      </div>
      <div class="paper-workbench-metrics">
        <div>
          <span>{{ t("paperWorkbench.progress") }}</span>
          <strong>{{ paper.progressPercent }}%</strong>
        </div>
        <div>
          <span>{{ t("paperWorkbench.sections") }}</span>
          <strong>{{ paper.completedSectionCount }}/{{ paper.sections.length }}</strong>
        </div>
        <div>
          <span>{{ t("paperWorkbench.words") }}</span>
          <strong>{{ paper.totalWordTarget.toLocaleString() }}</strong>
        </div>
      </div>
    </header>

    <div class="paper-workbench-body">
      <section class="paper-editor-surface">
        <div class="paper-editor-head">
          <div>
            <div class="paper-workbench-kicker">{{ t("paperWorkbench.currentSection") }}</div>
            <h2>{{ t(`paperWorkspace.sectionNames.${paper.selectedSection.titleKey}`) }}</h2>
          </div>
          <span class="paper-section-state" :class="`is-${paper.selectedSection.status}`">
            {{ t(`paperWorkspace.status.${paper.selectedSection.status}`) }}
          </span>
        </div>

        <div class="paper-outline-grid">
          <article v-for="item in outlineItems" :key="item.key" class="paper-outline-item">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </article>
        </div>

        <div class="paper-draft-sheet app-scrollbar">
          <p>{{ t("paperWorkbench.paragraphA") }}</p>
          <p>{{ t("paperWorkbench.paragraphB") }}</p>
          <p>{{ t("paperWorkbench.paragraphC") }}</p>
        </div>
      </section>

      <section class="paper-review-rail">
        <div class="paper-review-head">
          <span>{{ t("paperWorkbench.reviewRail") }}</span>
          <span class="mono">{{ paper.mode }}</span>
        </div>
        <div class="paper-review-list">
          <article v-for="check in reviewChecks" :key="check.key" class="paper-review-item" :class="check.kind">
            <component :is="check.icon" aria-hidden="true" />
            <div>
              <strong>{{ check.title }}</strong>
              <p>{{ check.desc }}</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { CheckCircle2, CircleAlert, FileText, Quote, Target } from "lucide-vue-next";
import { usePaperStore } from "../store";

const { t } = useI18n();
const paper = usePaperStore();

const outlineItems = computed(() => [
  { key: "field", label: t("paperWorkbench.field"), value: paper.field },
  { key: "target", label: t("paperWorkbench.sectionTarget"), value: `${paper.selectedSection.wordTarget} words` },
  { key: "mode", label: t("paperWorkbench.generationMode"), value: t(`paperSidebar.modes.${paper.mode}`) },
]);

const reviewChecks = computed(() => [
  {
    key: "scope",
    kind: "is-ok",
    icon: Target,
    title: t("paperWorkbench.checks.scopeTitle"),
    desc: t("paperWorkbench.checks.scopeDesc"),
  },
  {
    key: "citation",
    kind: "is-warn",
    icon: Quote,
    title: t("paperWorkbench.checks.citationTitle"),
    desc: t("paperWorkbench.checks.citationDesc"),
  },
  {
    key: "integrity",
    kind: "is-ok",
    icon: CheckCircle2,
    title: t("paperWorkbench.checks.integrityTitle"),
    desc: t("paperWorkbench.checks.integrityDesc"),
  },
  {
    key: "gap",
    kind: "is-attention",
    icon: CircleAlert,
    title: t("paperWorkbench.checks.gapTitle"),
    desc: t("paperWorkbench.checks.gapDesc"),
  },
]);
</script>

<style scoped>
.paper-workbench {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--surface-1) 86%, transparent), transparent 38%),
    color-mix(in srgb, var(--surface-0, var(--bg)) 82%, var(--surface-1) 18%);
  color: var(--text);
}

.paper-workbench-toolbar {
  min-width: 0;
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
  background: color-mix(in srgb, var(--surface-1) 92%, transparent);
}

.paper-workbench-title {
  min-width: 0;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: center;
  gap: 11px;
}

.paper-workbench-title__icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 12%, var(--surface-1));
  color: var(--accent);
}

.paper-workbench-title__icon svg {
  width: 18px;
  height: 18px;
}

.paper-workbench-kicker {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 740;
  line-height: 1.2;
}

.paper-workbench h1,
.paper-editor-head h2 {
  min-width: 0;
  overflow: hidden;
  margin: 0;
  color: var(--text);
  line-height: 1.22;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paper-workbench h1 {
  font-size: 16px;
  font-weight: 790;
}

.paper-editor-head h2 {
  margin-top: 3px;
  font-size: 20px;
}

.paper-workbench-metrics {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(74px, auto));
  gap: 8px;
}

.paper-workbench-metrics div {
  min-width: 0;
  display: grid;
  gap: 3px;
  border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-2) 62%, transparent);
  padding: 7px 9px;
}

.paper-workbench-metrics span {
  color: var(--text-muted);
  font-size: 10.5px;
  line-height: 1;
}

.paper-workbench-metrics strong {
  color: var(--text);
  font-size: 13px;
  line-height: 1;
}

.paper-workbench-body {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
  gap: 14px;
  overflow: hidden;
  padding: 14px;
}

.paper-editor-surface,
.paper-review-rail {
  min-width: 0;
  min-height: 0;
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-1) 88%, transparent);
}

.paper-editor-surface {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: hidden;
}

.paper-editor-head {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
}

.paper-section-state {
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, currentColor 32%, var(--border));
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 760;
  line-height: 1;
  padding: 5px 8px;
}

.paper-section-state.is-drafting {
  color: var(--accent);
}

.paper-section-state.is-review {
  color: var(--fg-warning);
}

.paper-section-state.is-done {
  color: var(--fg-success);
}

.paper-outline-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 0 18px 14px;
}

.paper-outline-item {
  min-width: 0;
  display: grid;
  gap: 4px;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-2) 68%, transparent);
  padding: 9px 10px;
}

.paper-outline-item span,
.paper-review-head {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 720;
}

.paper-outline-item strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paper-draft-sheet {
  min-height: 0;
  overflow: auto;
  margin: 0 18px 18px;
  border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
  border-radius: 8px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-0, var(--bg)) 96%, white 4%), transparent 60%),
    color-mix(in srgb, var(--surface-0, var(--bg)) 90%, var(--surface-1) 10%);
  padding: 22px;
}

.paper-draft-sheet p {
  margin: 0 0 16px;
  color: var(--text);
  font-size: 14px;
  line-height: 1.78;
}

.paper-draft-sheet p:last-child {
  margin-bottom: 0;
}

.paper-review-rail {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.paper-review-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
}

.paper-review-list {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 9px;
  overflow: auto;
  padding: 12px;
}

.paper-review-item {
  min-width: 0;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 9px;
  border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-2) 66%, transparent);
  padding: 10px;
}

.paper-review-item svg {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  color: var(--text-muted);
}

.paper-review-item.is-ok svg {
  color: var(--fg-success);
}

.paper-review-item.is-warn svg {
  color: var(--fg-warning);
}

.paper-review-item.is-attention svg {
  color: var(--accent);
}

.paper-review-item strong {
  color: var(--text);
  font-size: 12px;
  line-height: 1.25;
}

.paper-review-item p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 11.5px;
  line-height: 1.45;
}

@media (max-width: 1120px) {
  .paper-workbench-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .paper-review-rail {
    display: none;
  }
}
</style>
