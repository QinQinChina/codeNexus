<template>
  <section class="skills-panel">
    <header class="skills-panel-head">
      <div class="skills-panel-title">
        <Blocks class="skills-panel-icon" aria-hidden="true" />
        <div class="skills-panel-title-copy">
          <span class="skills-panel-title-text">{{ t("skills.panelTitle") }}</span>
          <span class="skills-panel-title-subtext mono dim">{{ t("skills.panelSubtitle") }}</span>
        </div>
      </div>

      <div class="skills-panel-actions">
        <button
          id="btn-open-skills-manager"
          class="btn-mini"
          type="button"
          :disabled="!canOpenManager"
          @click="emit('open-manager')"
        >
          {{ t("skills.manager") }}
        </button>
        <button
          id="btn-refresh-skills"
          class="btn-mini"
          type="button"
          :disabled="!canRefreshSkills"
          @click="refreshSkills"
        >
          {{ t("skills.refresh") }}
        </button>
      </div>
    </header>

    <div v-if="skillsStore.items.length > 0 && !skillsStateText" class="skills-panel-meta mono dim">
      <span>{{ t("skills.totalCount", { count: skillsStore.items.length }) }}</span>
      <span>{{ t("skills.enabledCount", { count: enabledCount }) }}</span>
    </div>

    <SkillsList
      :items="skillsStore.items"
      :pendingPath="skillPendingPath"
      :stateText="skillsStateText"
      :emptyText="t('skills.empty')"
      mode="compact"
      @toggle-skill="onSkillToggleRequest"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Blocks } from "lucide-vue-next";
import { getRuntimeOrchestrator } from "../../../domain/runtimeOrchestrator";
import { useRuntimeStore } from "../../../stores/runtime.store";
import { useSkillsStore } from "../../../stores/skills.store";
import type { SkillState } from "../../../domain/types";
import SkillsList from "./SkillsList.vue";

const emit = defineEmits<{
  (event: "open-manager"): void;
}>();

const runtime = getRuntimeOrchestrator();
const { t } = useI18n();
const runtimeStore = useRuntimeStore();
const skillsStore = useSkillsStore();

const skillPendingPath = ref("");

const canRefreshSkills = computed(
  () => Boolean(runtimeStore.serverId) && Boolean(runtimeStore.workspacePath) && skillsStore.loadState !== "loading"
);
const canOpenManager = computed(
  () => Boolean(runtimeStore.serverId) || Boolean(runtimeStore.workspacePath) || skillsStore.items.length > 0
);
const enabledCount = computed(() => skillsStore.items.filter((item) => item.enabled).length);

const skillsStateText = computed(() => {
  if (!runtimeStore.serverId) return t("skills.disconnected");
  if (!runtimeStore.workspacePath) return t("skills.noWorkspace");
  if (skillsStore.loadState === "loading") return t("skills.loading");
  if (skillsStore.loadState === "error")
    return skillsStore.errorText
      ? t("skills.loadFailedWithMessage", { message: skillsStore.errorText })
      : t("skills.loadFailed");
  if (skillsStore.items.length === 0) {
    if (skillsStore.parseErrors.length > 0)
      return t("skills.emptyWithErrors", { count: skillsStore.parseErrors.length });
    return t("skills.empty");
  }
  return "";
});

const refreshSkills = async () => {
  await runtime.refreshSkills(true);
};

const onToggleSkill = async (skill: SkillState, enabled: boolean) => {
  const path = String(skill.path ?? "").trim();
  if (!path || !skill.configurable) return;
  if (skillPendingPath.value === path) return;
  skillPendingPath.value = path;
  try {
    await runtime.toggleSkill(path, enabled);
  } finally {
    skillPendingPath.value = "";
  }
};

const onSkillToggleRequest = ({ skill, enabled }: { skill: SkillState; enabled: boolean }) => {
  void onToggleSkill(skill, enabled);
};

onMounted(() => {
  if (runtimeStore.serverId) {
    void runtime.refreshSkills(false);
  }
});
</script>
