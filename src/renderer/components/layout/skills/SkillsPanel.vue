<template>
  <section class="skills-panel">
    <header class="skills-panel-head">
      <div class="skills-panel-title">
        <Blocks class="skills-panel-icon" aria-hidden="true" />
        <div class="skills-panel-title-copy">
          <span class="skills-panel-title-text">技能（Skills）</span>
          <span class="skills-panel-title-subtext mono dim">内置能力开关</span>
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
          管理器
        </button>
        <button
          id="btn-refresh-skills"
          class="btn-mini"
          type="button"
          :disabled="!canRefreshSkills"
          @click="refreshSkills"
        >
          刷新
        </button>
      </div>
    </header>

    <div v-if="skillsStore.items.length > 0 && !skillsStateText" class="skills-panel-meta mono dim">
      <span>共 {{ skillsStore.items.length }} 项</span>
      <span>已启用 {{ enabledCount }} 项</span>
    </div>

    <SkillsList
      :items="skillsStore.items"
      :pendingPath="skillPendingPath"
      :stateText="skillsStateText"
      emptyText="暂无可用技能"
      mode="compact"
      @toggle-skill="onSkillToggleRequest"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
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
  if (!runtimeStore.serverId) return "未连接服务";
  if (!runtimeStore.workspacePath) return "未选择工作区";
  if (skillsStore.loadState === "loading") return "加载中…";
  if (skillsStore.loadState === "error")
    return skillsStore.errorText ? `加载失败：${skillsStore.errorText}` : "加载失败";
  if (skillsStore.items.length === 0) {
    if (skillsStore.parseErrors.length > 0) return `暂无可用技能（错误 ${skillsStore.parseErrors.length} 项）`;
    return "暂无可用技能";
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
