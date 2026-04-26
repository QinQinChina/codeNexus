<template>
  <Teleport to="body" :disabled="isSettings">
    <Transition name="global-config-drawer">
      <div
        v-if="open"
        class="global-config-drawer-overlay"
        :class="{ 'is-settings': isSettings }"
        role="dialog"
        aria-modal="true"
        aria-label="环境检测"
        @click.self="onOverlayClick"
      >
        <div v-if="!isSettings" class="global-config-drawer-backdrop" @click="close"></div>
        <section class="global-config-drawer-panel" @click.stop>
          <header class="global-config-drawer-head">
            <div class="panel-title">环境检测</div>
            <div class="row global-config-head-actions">
              <button class="btn-mini" type="button" :disabled="busy" @click="onRefreshDiagnostics">检测</button>
              <button v-if="!isSettings" ref="closeBtnRef" class="btn-mini" type="button" @click="close">关闭</button>
            </div>
          </header>

          <div class="global-config-drawer-body app-scrollbar" :class="{ 'is-settings': isSettings }">
            <section class="panel">
              <div class="panel-head">
                <div class="panel-title">检测结果</div>
                <div class="row" style="gap: 8px; align-items: center">
                  <span class="status-chip mono" :class="statusChipClass">{{ statusChipText }}</span>
                  <span v-if="busy" class="dim mono">处理中…</span>
                </div>
              </div>

              <div class="env-diag-grid">
                <div class="env-diag-item" :class="diagItemClass(diag.codex?.ok)">
                  <div class="env-diag-key mono">codex</div>
                  <div class="env-diag-val mono">{{ diagText(diag.codex) }}</div>
                </div>
                <div class="env-diag-item" :class="diagItemClass(diag.node?.ok)">
                  <div class="env-diag-key mono">node</div>
                  <div class="env-diag-val mono">{{ diagText(diag.node) }}</div>
                </div>
                <div class="env-diag-item" :class="diagItemClass(diag.npm?.ok)">
                  <div class="env-diag-key mono">npm</div>
                  <div class="env-diag-val mono">{{ diagText(diag.npm) }}</div>
                </div>
              </div>

              <div v-if="showManualGuide" class="env-guide">
                <div class="env-guide-title mono">手动安装指引</div>
                <div class="env-guide-body">
                  <div class="env-guide-text dim">
                    <span v-if="missingNodeOrNpm">未检测到 Node.js / npm。请先安装 Node.js LTS（包含 npm）。</span>
                    <span v-else>未检测到 codex。请使用 npm 全局安装 @openai/codex。</span>
                  </div>
                  <pre class="env-guide-cmd mono">npm i -g @openai/codex</pre>
                  <div class="env-guide-text dim">安装后如仍显示“缺失”，建议重启终端或重启本应用，再点击“检测”。</div>
                  <pre class="env-guide-cmd mono">
node -v
npm -v
codex --version</pre
                  >
                </div>
              </div>

              <div class="env-runtime-hint">
                <div class="env-runtime-hint-title mono">提示</div>
                <div class="env-runtime-hint-text dim">
                  当前环境检测只保证环境齐全（能在本机找到 codex/node/npm），不保证 codex 一定能在应用内正常启动。
                  如果仍然无法使用，请在 CMD 中使用 codex 自检是否可以正常运行：
                </div>
                <pre class="env-guide-cmd mono">codex --version</pre>
              </div>

              <div v-if="lastResultText" class="env-last-result mono" :class="lastResultClass">
                {{ lastResultText }}
              </div>
              <div class="env-debug-hint mono dim">调试日志请打开开发者工具（DevTools）控制台查看。</div>
            </section>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useAppShellStore } from "../../stores/appShell.store";
import { codexDesktop } from "../../api/codexDesktopClient";
import type { CodexDiagnosticsResult } from "../../../shared/ipc/contracts";

type DiagItem = { ok: boolean; details?: string };

const appShellStore = useAppShellStore();
const props = defineProps<{ mode?: "drawer" | "settings" }>();
const isSettings = computed(() => props.mode === "settings");
const open = computed(() => (isSettings.value ? true : appShellStore.envSetupDrawerOpen));

const busy = ref(false);
const diag = ref<Partial<CodexDiagnosticsResult>>({});
const lastResultText = ref("");
const lastResultKind = ref<"info" | "warn" | "error">("info");

const closeBtnRef = ref<HTMLButtonElement | null>(null);

function close() {
  if (isSettings.value) return;
  appShellStore.setEnvSetupDrawerOpen(false);
}

function onOverlayClick() {
  if (isSettings.value) return;
  close();
}

function diagText(item?: DiagItem): string {
  if (!item) return "未知";
  const head = item.ok ? "正常" : "缺失";
  const details = String(item.details ?? "").trim();
  return details ? `${head}\n${details}` : head;
}

function diagItemClass(ok?: boolean) {
  if (ok === true) return "is-ok";
  if (ok === false) return "is-missing";
  return "is-unknown";
}

const hasDiagnostics = computed(() => Boolean(diag.value.codex || diag.value.node || diag.value.npm));
const isReady = computed(
  () => Boolean(diag.value.codex?.ok) && Boolean(diag.value.node?.ok) && Boolean(diag.value.npm?.ok)
);
const missingNodeOrNpm = computed(() => diag.value.node?.ok === false || diag.value.npm?.ok === false);
const showManualGuide = computed(() => !busy.value && hasDiagnostics.value && !isReady.value);

const statusChipText = computed(() => {
  if (busy.value) return "处理中";
  if (!hasDiagnostics.value) return "待检测";
  return isReady.value ? "已就绪" : "未就绪";
});

const statusChipClass = computed(() => {
  if (busy.value) return "warn";
  if (!hasDiagnostics.value) return "warn";
  return isReady.value ? "success" : "error";
});

const lastResultClass = computed(() =>
  lastResultKind.value === "error" ? "is-error" : lastResultKind.value === "warn" ? "is-warn" : "is-info"
);

async function onRefreshDiagnostics() {
  busy.value = true;
  lastResultText.value = "";
  try {
    console.info("[EnvSetup] diagnostics: start");
    const res = await codexDesktop.codexServer.getDiagnostics();
    diag.value = res;
    console.info("[EnvSetup] diagnostics:", {
      codex: res.codex.ok,
      node: res.node.ok,
      npm: res.npm.ok,
    });
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    lastResultKind.value = "error";
    lastResultText.value = `检测失败：${msg}`;
    console.error("[EnvSetup] diagnostics: error:", msg);
  } finally {
    busy.value = false;
  }
}

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return;
    void onRefreshDiagnostics();
    void nextTick().then(() => {
      try {
        closeBtnRef.value?.focus();
      } catch {}
    });
  },
  { immediate: true }
);
</script>

<style scoped>
.env-diag-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

@media (min-width: 560px) {
  .env-diag-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.env-diag-item {
  min-width: 0;
  border-radius: 12px;
  border: 1px solid var(--card-border, var(--border));
  background: color-mix(in srgb, var(--card-bg, var(--surface-1)) 84%, transparent);
  padding: 10px 10px;
  display: grid;
  gap: 6px;
}

.env-diag-item.is-ok {
  border-color: color-mix(in srgb, var(--success) 38%, var(--card-border, var(--border)));
  background: color-mix(
    in srgb,
    var(--bg-success-soft) 42%,
    var(--card-bg, var(--surface-1))
  );
}

.env-diag-item.is-missing {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--card-border, var(--border)));
  background: color-mix(in srgb, var(--bg-danger-soft) 42%, var(--card-bg, var(--surface-1)));
}

.env-diag-key {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: var(--text);
}

.env-diag-val {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 12px;
  color: color-mix(in srgb, var(--text) 76%, transparent);
}

.env-guide {
  margin-top: 10px;
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid var(--card-border, var(--border));
  background: color-mix(in srgb, var(--card-bg, var(--surface-1)) 82%, transparent);
}

.env-guide-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: var(--text);
}

.env-guide-body {
  margin-top: 8px;
  display: grid;
  gap: 8px;
}

.env-guide-text {
  font-size: 12px;
  line-height: 1.4;
}

.env-guide-cmd {
  margin: 0;
  padding: 8px 9px;
  border-radius: 10px;
  border: 1px dashed var(--border);
  background: color-mix(in srgb, var(--card-bg, var(--surface-1)) 72%, transparent);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 12px;
  color: color-mix(in srgb, var(--text) 86%, transparent);
}

.env-runtime-hint {
  margin-top: 10px;
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid var(--card-border, var(--border));
  background: color-mix(in srgb, var(--card-bg, var(--surface-1)) 72%, transparent);
}

.env-runtime-hint-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: var(--text);
}

.env-runtime-hint-text {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.4;
}

.env-last-result {
  margin-top: 10px;
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid var(--card-border, var(--border));
  background: color-mix(in srgb, var(--card-bg, var(--surface-1)) 78%, transparent);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.env-last-result.is-error {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--card-border, var(--border)));
  background: color-mix(in srgb, var(--bg-danger-soft) 42%, var(--card-bg, var(--surface-1)));
}

.env-last-result.is-warn {
  border-color: color-mix(in srgb, var(--warning) 30%, var(--card-border, var(--border)));
  background: color-mix(in srgb, var(--bg-warning-soft, var(--accent-soft)) 56%, var(--card-bg, var(--surface-1)));
}

.env-debug-hint {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.4;
}
</style>
