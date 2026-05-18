<template>
  <div class="topbar-approval-trigger" :class="{ 'is-open': props.open }">
    <button
      id="btn-topbar-approval"
      class="btn-icon topbar-approval-button"
      :class="{
        'is-active': props.open,
        'has-approval-dot': hasPendingApproval && !props.open,
        'attn-breathe': hasPendingApproval && !props.open,
      }"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="props.open ? 'true' : 'false'"
      :aria-label="t('topbarApproval.approval')"
      @click.stop="emit('toggle')"
    >
      <ShieldCheck class="topbar-approval-button__icon" aria-hidden="true" />
    </button>
  </div>

  <Transition name="topbar-fly">
    <div v-if="props.open" class="topbar-menu-shell topbar-menu-shell--approval" @click.stop>
      <div class="topbar-dropdown topbar-menu app-scrollbar" role="menu" :aria-label="t('topbarApproval.approval')">
        <div class="topbar-menu-section">
          <div class="row" style="align-items: baseline; justify-content: space-between; gap: 10px">
            <div class="topbar-menu-heading">{{ t("topbarApproval.approval") }}</div>
            <div class="mono dim text-[11px]">{{ approvalQueueText }}</div>
          </div>

          <div id="approval-box" :class="{ dim: !activeApprovalPrompt }">
            <template v-if="!activeApprovalPrompt">
              <div class="grid gap-2">
                <div>{{ t("topbarApproval.noPending") }}</div>
                <GuardianReviewDiagnostics
                  :threadId="guardianThreadId"
                  :focusTargetItemId="guardianTargetItemId"
                  :maxItems="4"
                />
              </div>
            </template>
            <template v-else>
              <div class="user-input-card">
                <div v-if="approvalStore.queue.length > 1" class="grid gap-1.5 mb-2">
                  <button
                    v-for="p in approvalStore.queue.slice(0, 8)"
                    :key="`${p.serverId}:${p.requestId}`"
                    type="button"
                    class="btn-mini !justify-start"
                    @click="approvalStore.setActive(p.serverId, p.requestId)"
                  >
                    <span class="mono dim">{{ approvalPromptAgeText(p) }}</span>
                    <span class="truncate">{{ approvalHeaderText(p) }}</span>
                    <span class="mono dim truncate">· {{ approvalQueueItemMetaText(p) }}</span>
                  </button>
                  <div v-if="approvalStore.queue.length > 8" class="mono dim text-[11px]">
                    {{ t("topbarApproval.hiddenCount", { count: approvalStore.queue.length - 8 }) }}
                  </div>
                </div>

                <div class="user-input-head">
                  <div class="user-input-header">{{ approvalHeaderText(activeApprovalPrompt) }}</div>
                  <div class="user-input-progress mono dim">{{ approvalMetaText(activeApprovalPrompt) }}</div>
                </div>

                <div v-if="approvalInfoRows(activeApprovalPrompt).length" class="grid gap-1.5 mb-2">
                  <div
                    v-for="row in approvalInfoRows(activeApprovalPrompt)"
                    :key="row.label"
                    class="user-input-question mono"
                  >
                    <span class="dim">{{ row.label }}：</span>{{ row.value }}
                  </div>
                </div>

                <div v-if="approvalDetailText(activeApprovalPrompt)" class="user-input-question mono">
                  {{ approvalDetailText(activeApprovalPrompt) }}
                </div>

                <GuardianReviewDiagnostics
                  :threadId="guardianThreadId"
                  :focusTargetItemId="guardianTargetItemId"
                  :maxItems="4"
                />

                <div v-if="activeApprovalPrompt.kind === 'applyPatch'" class="grid gap-2">
                  <DetailDisclosure
                    v-for="file in applyPatchFiles(activeApprovalPrompt)"
                    :key="file.path"
                    :defaultOpen="false"
                    :content="file.body"
                  />
                </div>

                <div class="row user-input-actions" style="gap: 8px; flex-wrap: wrap">
                  <button type="button" @click="emit('close')">{{ t("topbarApproval.closeMenu") }}</button>

                  <template v-if="activeApprovalPrompt.kind === 'fileChange'">
                    <button type="button" @click="runtime.submitActiveApprovalPrompt('decline')">
                      {{ t("topbarApproval.decline") }}
                    </button>
                    <button type="button" class="danger" @click="runtime.submitActiveApprovalPrompt('cancel')">
                      {{ t("topbarApproval.declineAndInterrupt") }}
                    </button>
                    <button type="button" @click="runtime.submitActiveApprovalPrompt('acceptForSession')">
                      {{ t("topbarApproval.acceptForSession") }}
                    </button>
                    <button type="button" @click="runtime.submitActiveApprovalPrompt('accept')">
                      {{ t("topbarApproval.accept") }}
                    </button>
                  </template>

                  <template v-else-if="activeApprovalPrompt.kind === 'applyPatch'">
                    <button type="button" @click="runtime.submitActiveApprovalPrompt('denied')">
                      {{ t("topbarApproval.decline") }}
                    </button>
                    <button type="button" class="danger" @click="runtime.submitActiveApprovalPrompt('abort')">
                      {{ t("topbarApproval.declineAndStop") }}
                    </button>
                    <button type="button" @click="runtime.submitActiveApprovalPrompt('approved_for_session')">
                      {{ t("topbarApproval.acceptForSession") }}
                    </button>
                    <button type="button" @click="runtime.submitActiveApprovalPrompt('approved')">
                      {{ t("topbarApproval.accept") }}
                    </button>
                  </template>

                  <template v-else-if="activeApprovalPrompt.kind === 'commandExecution'">
                    <button
                      v-for="btn in toCommandExecutionDecisionButtons(activeApprovalPrompt)"
                      :key="btn.key"
                      type="button"
                      :class="btn.kind === 'danger' ? 'danger' : ''"
                      @click="runtime.submitActiveApprovalPrompt(btn.decision)"
                    >
                      {{ btn.label }}
                    </button>
                  </template>

                  <template v-else-if="activeApprovalPrompt.kind === 'permissions'">
                    <button type="button" @click="runtime.submitActiveApprovalPrompt('decline')">
                      {{ t("topbarApproval.decline") }}
                    </button>
                    <button type="button" class="danger" @click="runtime.submitActiveApprovalPrompt('cancel')">
                      {{ t("topbarApproval.declineAndClose") }}
                    </button>
                    <button type="button" @click="runtime.submitActiveApprovalPrompt('session')">
                      {{ t("topbarApproval.acceptForSession") }}
                    </button>
                    <button type="button" @click="runtime.submitActiveApprovalPrompt('turn')">
                      {{ t("topbarApproval.acceptForTurn") }}
                    </button>
                  </template>

                  <template v-else>
                    <button type="button" @click="runtime.submitActiveApprovalPrompt('denied')">
                      {{ t("topbarApproval.decline") }}
                    </button>
                    <button type="button" class="danger" @click="runtime.submitActiveApprovalPrompt('abort')">
                      {{ t("topbarApproval.declineAndStop") }}
                    </button>
                    <button type="button" @click="runtime.submitActiveApprovalPrompt('approved_for_session')">
                      {{ t("topbarApproval.acceptForSession") }}
                    </button>
                    <button type="button" @click="runtime.submitActiveApprovalPrompt('approved')">
                      {{ t("topbarApproval.accept") }}
                    </button>
                  </template>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { ShieldCheck } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import type { FileChange } from "../../../../generated/codex-app-server";
import type { CommandExecutionApprovalDecision } from "../../../../generated/codex-app-server/v2/CommandExecutionApprovalDecision";
import { getRuntimeOrchestrator } from "../../../domain/runtimeOrchestrator";
import { useRuntimeStore } from "../../../stores/runtime.store";
import { useApprovalStore, type ApprovalPrompt } from "../../../stores/approval.store";

const DetailDisclosure = defineAsyncComponent(() => import("../../ui/DetailDisclosure.vue"));
const GuardianReviewDiagnostics = defineAsyncComponent(() => import("../../guardian/GuardianReviewDiagnostics.vue"));

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle"): void;
  (e: "close"): void;
}>();

const runtime = getRuntimeOrchestrator();
const runtimeStore = useRuntimeStore();
const approvalStore = useApprovalStore();
const { t } = useI18n();

const hasPendingApproval = computed(() => approvalStore.queue.length > 0);
const activeApprovalPrompt = computed(() => approvalStore.activePrompt);
const guardianThreadId = computed(() => {
  return (
    String(
      activeApprovalPrompt.value?.threadId ?? runtimeStore.currentThreadId ?? runtimeStore.timelineKey ?? "__app__"
    ).trim() || "__app__"
  );
});
const guardianTargetItemId = computed(() => String(activeApprovalPrompt.value?.itemId ?? "").trim());

const approvalQueueText = computed(() => String(approvalStore.queue.length || 0));

type ApprovalInfoRow = {
  label: string;
  value: string;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

const approvalHeaderText = (prompt: ApprovalPrompt) => {
  if (prompt.kind === "fileChange") return t("topbarApproval.fileChangeRequest");
  if (prompt.kind === "applyPatch") return t("topbarApproval.applyPatchRequest");
  if (prompt.kind === "commandExecution") return t("topbarApproval.commandExecutionRequest");
  if (prompt.kind === "permissions") return t("topbarApproval.permissionsRequest");
  return t("topbarApproval.approvalRequest");
};

const approvalMetaText = (prompt: ApprovalPrompt) => {
  const kind = String(prompt.kind ?? "approval");
  const method = String((prompt as any)?.method ?? "");
  return [kind, method, approvalPromptAgeText(prompt)].filter(Boolean).join(" · ");
};

const approvalQueueItemMetaText = (prompt: ApprovalPrompt) => {
  const threadId = toText(prompt.threadId);
  const itemId = toText(prompt.itemId);
  return [shortId(threadId), shortId(itemId)].filter(Boolean).join(" / ") || toText(prompt.method);
};

const approvalPromptAgeText = (prompt: ApprovalPrompt) => {
  const createdAt = Number(prompt.createdAt ?? 0);
  if (!Number.isFinite(createdAt) || createdAt <= 0) return t("topbarApproval.justNow");
  const seconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
};

const shortId = (value: string) => {
  const text = toText(value);
  if (!text) return "";
  if (text.length <= 12) return text;
  return `${text.slice(0, 6)}…${text.slice(-4)}`;
};

const approvalInfoRows = (prompt: ApprovalPrompt): ApprovalInfoRow[] => {
  const params = toRecord(prompt.params);
  const rows: ApprovalInfoRow[] = [];
  const reason = toText(params.reason);
  const grantRoot = toText(params.grantRoot);
  const cwd = toText(params.cwd);
  const command = Array.isArray(params.command)
    ? params.command
        .map((part) => toText(part))
        .filter(Boolean)
        .join(" ")
    : toText(params.command);

  if (reason) rows.push({ label: t("topbarApproval.reason"), value: reason });
  if (grantRoot) rows.push({ label: t("topbarApproval.grantRoot"), value: grantRoot });
  if (cwd) rows.push({ label: t("topbarApproval.cwd"), value: cwd });
  if (command) rows.push({ label: t("topbarApproval.command"), value: command });
  if (prompt.kind === "applyPatch") {
    rows.push({ label: t("topbarApproval.fileCount"), value: String(applyPatchFiles(prompt).length) });
  }
  return rows;
};

const approvalDetailText = (prompt: ApprovalPrompt) => {
  if (prompt.kind === "permissions") {
    return JSON.stringify(prompt.params.permissions ?? {}, null, 2);
  }
  return "";
};

type CommandExecutionDecisionButton = {
  key: string;
  label: string;
  decision: CommandExecutionApprovalDecision;
  kind: "primary" | "danger";
};

const toCommandExecutionDecisionButtons = (prompt: ApprovalPrompt): CommandExecutionDecisionButton[] => {
  if (prompt.kind !== "commandExecution") return [];
  const decisions =
    Array.isArray(prompt.params.availableDecisions) && prompt.params.availableDecisions.length > 0
      ? prompt.params.availableDecisions
      : (["decline", "cancel", "acceptForSession", "accept"] satisfies CommandExecutionApprovalDecision[]);
  const buttons: CommandExecutionDecisionButton[] = [];
  for (const decision of decisions) {
    if (decision === "accept") {
      buttons.push({ key: "accept", label: t("topbarApproval.accept"), decision, kind: "primary" });
      continue;
    }
    if (decision === "acceptForSession") {
      buttons.push({ key: "acceptForSession", label: t("topbarApproval.acceptForSession"), decision, kind: "primary" });
      continue;
    }
    if (decision === "decline") {
      buttons.push({ key: "decline", label: t("topbarApproval.decline"), decision, kind: "danger" });
      continue;
    }
    if (decision === "cancel") {
      buttons.push({ key: "cancel", label: t("topbarApproval.declineAndStop"), decision, kind: "danger" });
      continue;
    }
    if (!decision || typeof decision !== "object") continue;
    if ("acceptWithExecpolicyAmendment" in decision) {
      buttons.push({
        key: "acceptWithExecpolicyAmendment",
        label: t("topbarApproval.acceptWithPolicy"),
        decision,
        kind: "primary",
      });
      continue;
    }
    if ("applyNetworkPolicyAmendment" in decision) {
      const host = decision.applyNetworkPolicyAmendment.network_policy_amendment.host.trim();
      const action = decision.applyNetworkPolicyAmendment.network_policy_amendment.action.trim();
      const suffix = [action, host].filter(Boolean).join(" ");
      buttons.push({
        key: `applyNetworkPolicyAmendment:${action}:${host}`,
        label: suffix
          ? t("topbarApproval.applyNetworkPolicyWithSuffix", { suffix })
          : t("topbarApproval.applyNetworkPolicy"),
        decision,
        kind: "primary",
      });
      continue;
    }
    const fallbackKey = Object.keys(decision)[0] ?? "decision";
    buttons.push({ key: `obj:${fallbackKey}`, label: fallbackKey, decision, kind: "primary" });
  }
  return buttons.slice(0, 10);
};

const applyPatchFiles = (
  prompt: ApprovalPrompt
): Array<{ path: string; kind: FileChange["type"] | "unknown"; movePath: string; body: string }> => {
  if (prompt.kind !== "applyPatch") return [];
  const fc = (prompt as any).params?.fileChanges ?? {};
  const out: Array<{ path: string; kind: FileChange["type"] | "unknown"; movePath: string; body: string }> = [];
  for (const [path, change] of Object.entries(fc)) {
    const c = change as any;
    if (!c) continue;
    if (c.type === "update") {
      out.push({
        path: String(path ?? ""),
        kind: c.type,
        movePath: toText(c.move_path),
        body: toText(c.unified_diff),
      });
      continue;
    }
    out.push({ path: String(path ?? ""), kind: c.type, movePath: "", body: toText(c.content) });
  }
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
};
</script>
