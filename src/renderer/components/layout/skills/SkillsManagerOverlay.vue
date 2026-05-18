<template>
  <section class="skills-manager-page app-scrollbar" :aria-label="t('skills.managerAria')">
    <div class="skills-manager-sticky">
      <header class="skills-manager-head">
        <div class="skills-manager-title-row">
          <Blocks class="skills-manager-title-icon" aria-hidden="true" />
          <h2 class="skills-manager-title">{{ t("skills.managerTitle") }}</h2>
        </div>

        <div class="skills-manager-head-actions">
          <button class="btn-mini" type="button" :disabled="!canRefreshSkills" @click="refreshSkills">
            {{ t("skills.refresh") }}
          </button>
          <button class="btn-mini" type="button" @click="closeManager">{{ t("skills.back") }}</button>
        </div>
      </header>
    </div>

    <div class="skills-manager-body">
      <SkillsList
        :items="filteredItems"
        :pendingPath="skillPendingPath"
        :stateText="skillsStateText"
        :emptyText="t('skills.noMatch')"
        mode="manager"
        @toggle-skill="onSkillToggleRequest"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Blocks } from "lucide-vue-next";
import SkillsList from "./SkillsList.vue";
import { getRuntimeOrchestrator } from "../../../domain/runtimeOrchestrator";
import { useRuntimeStore } from "../../../stores/runtime.store";
import { useSkillsStore } from "../../../stores/skills.store";
import { useSkillsUiStore } from "../../../stores/skillsUi.store";
import type { SkillState } from "../../../domain/types";

const runtime = getRuntimeOrchestrator();
const { t } = useI18n();
const runtimeStore = useRuntimeStore();
const skillsStore = useSkillsStore();
const skillsUiStore = useSkillsUiStore();

const skillPendingPath = ref("");

const canRefreshSkills = computed(
  () => Boolean(runtimeStore.serverId) && Boolean(runtimeStore.workspacePath) && skillsStore.loadState !== "loading"
);

const skillsStateText = computed(() => {
  if (!runtimeStore.serverId) return t("skills.disconnected");
  if (!runtimeStore.workspacePath) return t("skills.noWorkspace");
  if (skillsStore.loadState === "loading") return t("skills.loading");
  if (skillsStore.loadState === "error")
    return skillsStore.errorText ? t("skills.loadFailedWithMessage", { message: skillsStore.errorText }) : t("skills.loadFailed");
  if (skillsStore.items.length === 0) {
    if (skillsStore.parseErrors.length > 0)
      return t("skills.emptyWithErrorsRaw", { count: skillsStore.parseErrors.length });
    return t("skills.empty");
  }
  return "";
});

const filteredItems = computed(() => {
  return skillsStore.items;
});

const refreshSkills = async () => {
  await runtime.refreshSkills(true);
};

const closeManager = () => {
  skillsUiStore.closeManager();
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

const onWindowKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") closeManager();
};

onMounted(() => {
  window.addEventListener("keydown", onWindowKeydown);
  if (runtimeStore.serverId && skillsStore.loadState === "idle") {
    void runtime.refreshSkills(false);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onWindowKeydown);
});
</script>
