<template>
  <section class="skills-manager-page app-scrollbar" aria-label="技能管理器（Skills）">
    <div class="skills-manager-sticky">
      <header class="skills-manager-head">
        <div class="skills-manager-title-row">
          <Blocks class="skills-manager-title-icon" aria-hidden="true" />
          <h2 class="skills-manager-title">技能管理（Skills）</h2>
        </div>

        <div class="skills-manager-head-actions">
          <button class="btn-mini" type="button" :disabled="!canRefreshSkills" @click="refreshSkills">刷新</button>
          <button class="btn-mini" type="button" @click="closeManager">返回</button>
        </div>
      </header>
    </div>

    <div class="skills-manager-body">
      <SkillsList
        :items="filteredItems"
        :pendingPath="skillPendingPath"
        :stateText="skillsStateText"
        emptyText="未找到匹配技能"
        mode="manager"
        @toggle-skill="onSkillToggleRequest"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Blocks } from "lucide-vue-next";
import SkillsList from "./SkillsList.vue";
import { getRuntimeOrchestrator } from "../../domain/runtimeOrchestrator";
import { useRuntimeStore } from "../../stores/runtime.store";
import { useSkillsStore } from "../../stores/skills.store";
import { useSkillsUiStore } from "../../stores/skillsUi.store";
import type { SkillState } from "../../domain/types";

const runtime = getRuntimeOrchestrator();
const runtimeStore = useRuntimeStore();
const skillsStore = useSkillsStore();
const skillsUiStore = useSkillsUiStore();

const skillPendingPath = ref("");

const canRefreshSkills = computed(
  () => Boolean(runtimeStore.serverId) && Boolean(runtimeStore.workspacePath) && skillsStore.loadState !== "loading"
);

const skillsStateText = computed(() => {
  if (!runtimeStore.serverId) return "未连接服务";
  if (!runtimeStore.workspacePath) return "未选择工作区";
  if (skillsStore.loadState === "loading") return "加载中…";
  if (skillsStore.loadState === "error")
    return skillsStore.errorText ? `加载失败：${skillsStore.errorText}` : "加载失败";
  if (skillsStore.items.length === 0) {
    if (skillsStore.parseErrors.length > 0) return `暂无可用技能（errors=${skillsStore.parseErrors.length}）`;
    return "暂无可用技能";
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
