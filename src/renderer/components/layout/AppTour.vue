<template>
  <el-tour
    v-model="tourOpenModel"
    v-model:current="tourCurrentModel"
    append-to="body"
    :z-index="1300"
    :mask="true"
    :target-area-clickable="true"
    :show-close="true"
    :close-on-press-escape="true"
    :scroll-into-view-options="{ block: 'center', inline: 'center' }"
    type="primary"
    @close="onClose"
    @finish="onFinish"
  >
    <el-tour-step :target="workspaceTarget" placement="bottom" :next-button-props="{ disabled: !hasWorkspace }">
      <template #header>
        <div class="app-tour-heading">
          <span class="app-tour-kicker mono">步骤 01</span>
          <span class="app-tour-title">先选择工作区</span>
        </div>
      </template>
      <div class="app-tour-copy">
        <p>点击左上角的工作区按钮，把当前任务绑定到一个明确的目录。</p>
        <p class="app-tour-note">选择完成后会自动进入下一步。</p>
      </div>
    </el-tour-step>

    <el-tour-step
      :target="newThreadTarget"
      placement="right"
      :prev-button-props="{ disabled: true }"
      :next-button-props="{ disabled: !hasCurrentThread }"
    >
      <template #header>
        <div class="app-tour-heading">
          <span class="app-tour-kicker mono">步骤 02</span>
          <span class="app-tour-title">创建新会话</span>
        </div>
      </template>
      <div class="app-tour-copy">
        <p>切到左侧的线程页后，点击 <span class="mono">新建线程</span> 创建一个新的会话。</p>
        <p class="app-tour-note">创建成功后会自动进入下一步。</p>
      </div>
    </el-tour-step>

    <el-tour-step :target="modelTarget" placement="top">
      <template #header>
        <div class="app-tour-heading">
          <span class="app-tour-kicker mono">步骤 03</span>
          <span class="app-tour-title">选择模型</span>
        </div>
      </template>
      <div class="app-tour-copy">
        <p>在这里选择你要使用的模型。</p>
        <p class="app-tour-note">不确定时先用默认值即可。</p>
      </div>
    </el-tour-step>

    <el-tour-step :target="effortTarget" placement="top">
      <template #header>
        <div class="app-tour-heading">
          <span class="app-tour-kicker mono">步骤 04</span>
          <span class="app-tour-title">选择思考强度</span>
        </div>
      </template>
      <div class="app-tour-copy">
        <p>思考强度越高，可能更稳但也更慢。</p>
      </div>
    </el-tour-step>

    <el-tour-step :target="sandboxTarget" placement="top">
      <template #header>
        <div class="app-tour-heading">
          <span class="app-tour-kicker mono">步骤 05</span>
          <span class="app-tour-title">选择权限</span>
        </div>
      </template>
      <div class="app-tour-copy">
        <p>这里控制执行环境的权限范围。</p>
      </div>
    </el-tour-step>

    <el-tour-step :target="composerTarget" placement="top" :next-button-props="{ disabled: !hasThreadTitleEcho }">
      <template #header>
        <div class="app-tour-heading">
          <span class="app-tour-kicker mono">步骤 06</span>
          <span class="app-tour-title">输入并发送消息</span>
        </div>
      </template>
      <div class="app-tour-copy">
        <p>在输入框里输入内容，然后按 <span class="mono">回车（Enter）</span> 或点击发送按钮。</p>
        <p class="app-tour-note">发送后会自动完成引导，并播放动效。</p>
      </div>
    </el-tour-step>
  </el-tour>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ElTour, ElTourStep } from "element-plus";
import { fallbackThreadTitle } from "../../features/history/threadTitle";
import { useAppShellStore } from "../../stores/appShell.store";
import { useRuntimeStore } from "../../stores/runtime.store";
import { useThreadStore } from "../../stores/thread.store";
import { fireConfetti } from "../../ui/confetti";

const appShellStore = useAppShellStore();
const runtimeStore = useRuntimeStore();
const threadStore = useThreadStore();

const workspaceTarget = "#btn-workspace-select";
const newThreadTarget = "#btn-add-thread";
const modelTarget = "#sel-model";
const effortTarget = "#sel-effort";
const sandboxTarget = "#sel-sandbox";
const composerTarget = "#input";

const didCelebrate = ref(false);

const currentThreadTitle = computed(() => {
  const threadId = String(runtimeStore.currentThreadId ?? "").trim();
  if (!threadId) return "";
  const current = threadStore.threadHistory.find((item) => item.id === threadId);
  return String(current?.title ?? "").trim();
});

const hasWorkspace = computed(() => Boolean(String(runtimeStore.workspacePath ?? "").trim()));
const hasCurrentThread = computed(() => Boolean(String(runtimeStore.currentThreadId ?? "").trim()));
const hasThreadTitleEcho = computed(() => {
  const threadId = String(runtimeStore.currentThreadId ?? "").trim();
  if (!threadId) return false;
  const title = currentThreadTitle.value;
  if (!title) return false;
  return title !== fallbackThreadTitle(threadId);
});

// 仅自动推进前两步；后续为“看得到目标就继续”的引导流程。
const suggestedStepIndex = computed(() => {
  if (!hasWorkspace.value) return 0;
  if (!hasCurrentThread.value) return 1;
  return 2;
});

const tourOpenModel = computed({
  get: () => appShellStore.onboardingTourOpen,
  set: (value: boolean) => {
    if (value) {
      appShellStore.openOnboardingTour();
      return;
    }
    appShellStore.closeOnboardingTour({ markSeen: true });
  },
});

const tourCurrentModel = computed({
  get: () => appShellStore.onboardingTourCurrent,
  set: (value: number) => appShellStore.setOnboardingTourCurrent(value),
});

function syncTourStep(force = false) {
  if (!appShellStore.onboardingTourOpen) return;
  if (hasWorkspace.value && !hasCurrentThread.value) {
    appShellStore.setLeftSidebarVisible(true, { save: false });
  }
  const nextStep = suggestedStepIndex.value;
  if (force || nextStep > appShellStore.onboardingTourCurrent) {
    appShellStore.setOnboardingTourCurrent(nextStep);
  }
}

function celebrateAndClose() {
  if (didCelebrate.value) return;
  didCelebrate.value = true;
  appShellStore.closeOnboardingTour({ markSeen: true });
  fireConfetti({
    durationMs: 2000,
    intervalMs: 180,
    particleCount: 14,
    startVelocity: 30,
    spread: 52,
    ticks: 94,
    origins: [
      { x: [-0.02, 0.03], y: [0.88, 0.97], angle: 52, spread: 48, startVelocity: 32, particleCountScale: 1 },
      { x: [0.97, 1.02], y: [0.88, 0.97], angle: 128, spread: 48, startVelocity: 32, particleCountScale: 1 },
    ],
  });
}

function onClose() {
  appShellStore.closeOnboardingTour({ markSeen: true });
}

function onFinish() {
  if (hasThreadTitleEcho.value) {
    celebrateAndClose();
    return;
  }
  appShellStore.closeOnboardingTour({ markSeen: true });
}

watch(
  () => appShellStore.onboardingTourOpen,
  (open) => {
    if (!open) return;
    didCelebrate.value = false;
    void nextTick(() => {
      syncTourStep(true);
    });
  }
);

watch(
  () =>
    [
      runtimeStore.workspacePath,
      runtimeStore.currentThreadId,
      currentThreadTitle.value,
      appShellStore.onboardingTourOpen,
    ] as const,
  () => {
    void nextTick(() => {
      syncTourStep();
    });
  },
  { flush: "post" }
);

watch(
  () => [appShellStore.onboardingTourOpen, appShellStore.onboardingTourCurrent, hasThreadTitleEcho.value] as const,
  ([open, current, titleEcho]) => {
    if (!open) return;
    if (didCelebrate.value) return;
    if (current !== 5) return;
    if (!titleEcho) return;
    celebrateAndClose();
  },
  { flush: "post" }
);
</script>

<style scoped>
.app-tour-heading {
  display: grid;
  gap: 4px;
}

.app-tour-kicker {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: color-mix(in srgb, currentColor 58%, transparent);
}

.app-tour-title {
  font-size: 15px;
  font-weight: 700;
}

.app-tour-copy {
  display: grid;
  gap: 8px;
  max-width: 280px;
  line-height: 1.55;
}

.app-tour-copy p {
  margin: 0;
}

.app-tour-note {
  font-size: 12px;
  color: color-mix(in srgb, currentColor 68%, transparent);
}
</style>
