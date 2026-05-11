<template>
  <aside class="sidebar sidebar-right image-settings-sidebar" aria-label="图片工作台参数">
    <header class="image-settings-sidebar__header">
      <div>
        <div class="image-settings-sidebar__eyebrow">Images</div>
        <h2 class="image-settings-sidebar__title">生成参数</h2>
      </div>
      <button class="btn-mini" type="button" @click="openApiSettings">
        <Settings2 class="btn-mini__icon" aria-hidden="true" />
        <span>API</span>
      </button>
    </header>

    <div class="image-settings-sidebar__scroll app-scrollbar">
      <div class="image-workbench__control-grid">
        <label class="image-workbench__field image-workbench__field--full">
          <span class="image-workbench__label">提示词</span>
          <textarea
            v-model="workbench.prompt"
            class="image-workbench__textarea context-input mono"
            rows="8"
            placeholder="描述你要生成或编辑的画面"
            :disabled="workbench.busy"
          />
        </label>

        <div class="image-workbench__field">
          <span class="image-workbench__label">模式</span>
          <div class="image-workbench__segmented" role="tablist" aria-label="图片模式">
            <button
              class="image-workbench__segment"
              :class="{ 'is-active': workbench.mode === 'generate' }"
              type="button"
              :disabled="workbench.busy"
              @click="workbench.mode = 'generate'"
            >
              生成
            </button>
            <button
              class="image-workbench__segment"
              :class="{ 'is-active': workbench.mode === 'edit' }"
              type="button"
              :disabled="workbench.busy"
              @click="workbench.mode = 'edit'"
            >
              编辑
            </button>
          </div>
        </div>

        <label class="image-workbench__field">
          <span class="image-workbench__label">数量</span>
          <input v-model.number="workbench.count" class="context-input mono" type="number" min="1" max="4" step="1" :disabled="workbench.busy" />
        </label>

        <label class="image-workbench__field">
          <span class="image-workbench__label">尺寸</span>
          <select v-model="workbench.size" class="context-input mono" :disabled="workbench.busy">
            <option value="auto">auto</option>
            <option value="1024x1024">1024x1024</option>
            <option value="1024x1536">1024x1536</option>
            <option value="1536x1024">1536x1024</option>
          </select>
        </label>

        <label class="image-workbench__field">
          <span class="image-workbench__label">质量</span>
          <select v-model="workbench.quality" class="context-input mono" :disabled="workbench.busy">
            <option value="auto">auto</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>

        <label class="image-workbench__field">
          <span class="image-workbench__label">格式</span>
          <select v-model="workbench.outputFormat" class="context-input mono" :disabled="workbench.busy">
            <option value="png">png</option>
            <option value="jpeg">jpeg</option>
            <option value="webp">webp</option>
          </select>
        </label>

        <label class="image-workbench__field">
          <span class="image-workbench__label">背景</span>
          <select v-model="workbench.background" class="context-input mono" :disabled="workbench.busy">
            <option value="auto">auto</option>
            <option value="transparent">transparent</option>
            <option value="opaque">opaque</option>
          </select>
        </label>

        <label class="image-workbench__field">
          <span class="image-workbench__label">审核</span>
          <select v-model="workbench.moderation" class="context-input mono" :disabled="workbench.busy">
            <option value="auto">auto</option>
            <option value="low">low</option>
          </select>
        </label>

        <label class="image-workbench__field">
          <span class="image-workbench__label">压缩</span>
          <div class="image-workbench__inline">
            <input
              v-model.number="workbench.outputCompression"
              class="context-input mono"
              type="number"
              min="0"
              max="100"
              step="1"
              :disabled="workbench.busy || workbench.outputFormat === 'png'"
            />
            <span class="dim mono">jpeg/webp</span>
          </div>
        </label>
      </div>

      <div class="image-workbench__attachments">
        <div class="image-workbench__attachments-head">
          <span>输入</span>
          <span class="mono">{{ workbench.mode === "edit" ? `${workbench.inputImages.length} 张参考图` : "仅提示词" }}</span>
        </div>

        <div
          v-if="workbench.mode === 'edit'"
          class="image-workbench__dropzone"
          :class="{ 'is-dragging': workbench.dragActive }"
          @dragover="onDragOver"
          @dragleave="workbench.stopDrag"
          @drop="onDrop"
        >
          <input ref="imageInputRef" class="image-workbench__file" type="file" accept="image/*" multiple :disabled="workbench.busy" @change="onPickImages" />
          <button class="image-workbench__dropzone-btn" type="button" :disabled="workbench.busy" @click="triggerPickImages">
            <Upload class="btn-mini__icon" aria-hidden="true" />
            <span>添加参考图</span>
          </button>
          <div class="image-workbench__dropzone-hint">最多 4 张参考图</div>
        </div>

        <div v-if="workbench.mode === 'edit' && workbench.inputImages.length" class="image-workbench__thumb-grid">
          <div v-for="image in workbench.inputImages" :key="image.id" class="image-workbench__thumb">
            <img :src="image.dataUrl" :alt="image.name" />
            <div class="image-workbench__thumb-meta">
              <span class="image-workbench__thumb-name">{{ image.name }}</span>
              <button class="btn-mini" type="button" :disabled="workbench.busy" @click="workbench.removeInputImage(image.id)">
                <Trash2 class="btn-mini__icon" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="workbench.mode === 'edit'" class="image-workbench__mask-row">
          <div class="image-workbench__mask-copy">
            <div class="image-workbench__label">Mask</div>
            <div class="dim">可选，用于局部编辑。</div>
          </div>
          <div class="image-workbench__mask-actions">
            <input ref="maskInputRef" class="image-workbench__file" type="file" accept="image/*" :disabled="workbench.busy" @change="onPickMask" />
            <button class="btn-mini" type="button" :disabled="workbench.busy" @click="triggerPickMask">
              <Upload class="btn-mini__icon" aria-hidden="true" />
              <span>{{ workbench.maskDataUrl ? "替换" : "选择" }}</span>
            </button>
            <button class="btn-mini" type="button" :disabled="workbench.busy || !workbench.maskDataUrl" @click="workbench.clearMask">
              <X class="btn-mini__icon" aria-hidden="true" />
              <span>清除</span>
            </button>
          </div>
        </div>

        <div v-if="workbench.mode === 'edit' && workbench.maskDataUrl" class="image-workbench__mask-preview">
          <img :src="workbench.maskDataUrl" alt="Mask preview" />
        </div>
      </div>

      <div v-if="workbench.errorText" class="image-workbench__error mono">{{ workbench.errorText }}</div>

      <button class="image-settings-sidebar__generate" type="button" :disabled="workbench.busy || !workbench.canGenerate" @click="workbench.generate">
        <Loader2 v-if="workbench.busy" class="btn-mini__icon is-spinning" aria-hidden="true" />
        <Wand2 v-else class="btn-mini__icon" aria-hidden="true" />
        <span>{{ workbench.busy ? "生成中" : "生成图片" }}</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { Loader2, Settings2, Trash2, Upload, Wand2, X } from "lucide-vue-next";
import { useAppShellStore } from "../../stores/appShell.store";
import { useImageWorkbenchStore } from "../../stores/imageWorkbench.store";

const appShellStore = useAppShellStore();
const workbench = useImageWorkbenchStore();
const imageInputRef = ref<HTMLInputElement | null>(null);
const maskInputRef = ref<HTMLInputElement | null>(null);

function openApiSettings() {
  appShellStore.openSettings("image");
}

function triggerPickImages() {
  imageInputRef.value?.click();
}

function triggerPickMask() {
  maskInputRef.value?.click();
}

async function onPickImages(event: Event) {
  const target = event.target as HTMLInputElement | null;
  const files = target?.files;
  if (!files || files.length === 0) return;
  await workbench.appendFiles(files);
  if (target) target.value = "";
}

async function onPickMask(event: Event) {
  const target = event.target as HTMLInputElement | null;
  const file = target?.files?.[0];
  if (!file) return;
  await workbench.setMaskFromFile(file);
  if (target) target.value = "";
}

async function onDrop(event: DragEvent) {
  event.preventDefault();
  workbench.stopDrag();
  if (workbench.mode !== "edit" || workbench.busy) return;
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;
  await workbench.appendFiles(files);
}

function onDragOver(event: DragEvent) {
  if (workbench.mode !== "edit") return;
  workbench.dragActive = true;
  event.preventDefault();
}

onBeforeUnmount(() => {
  workbench.stopDrag();
});
</script>

<style scoped>
.image-settings-sidebar {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-1) 94%, transparent), transparent 42%),
    color-mix(in srgb, var(--bg) 94%, var(--surface-1) 6%);
}

.image-settings-sidebar__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
}

.image-settings-sidebar__eyebrow {
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
  text-transform: uppercase;
}

.image-settings-sidebar__title {
  margin: 5px 0 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 750;
  line-height: 1.2;
}

.image-settings-sidebar__scroll {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
  padding: 10px 10px 14px;
}

.image-settings-sidebar__generate {
  display: inline-flex;
  width: 100%;
  height: 34px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--border) 58%);
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 14%, var(--surface-1) 86%);
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
}

.image-settings-sidebar__generate:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.image-workbench__control-grid,
.image-workbench__attachments {
  display: grid;
  gap: 10px;
}

.image-workbench__field {
  display: grid;
  gap: 5px;
}

.image-workbench__label,
.image-workbench__attachments-head {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.image-workbench__textarea {
  min-height: 128px;
  resize: vertical;
}

.image-workbench__segmented,
.image-workbench__inline,
.image-workbench__attachments-head,
.image-workbench__mask-row,
.image-workbench__mask-actions,
.image-workbench__thumb-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.image-workbench__attachments-head,
.image-workbench__mask-row,
.image-workbench__thumb-meta {
  justify-content: space-between;
}

.image-workbench__segmented {
  padding: 3px;
  border: 1px solid var(--ui-code-border);
  border-radius: 8px;
  background: var(--ui-code-bg);
}

.image-workbench__segment {
  flex: 1 1 0;
  height: 26px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.image-workbench__segment.is-active {
  border-color: color-mix(in srgb, var(--accent) 34%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--text);
}

.image-workbench__inline .context-input {
  min-width: 0;
}

.image-workbench__attachments {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
}

.image-workbench__dropzone {
  display: grid;
  place-items: center;
  gap: 6px;
  min-height: 92px;
  border: 1px dashed color-mix(in srgb, var(--border) 82%, var(--accent) 18%);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-1) 70%, transparent);
  padding: 10px;
}

.image-workbench__dropzone.is-dragging {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.image-workbench__dropzone-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.image-workbench__dropzone-hint {
  color: var(--text-muted);
  font-size: 11px;
}

.image-workbench__file {
  display: none;
}

.image-workbench__thumb-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.image-workbench__thumb,
.image-workbench__mask-preview {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--ui-code-border);
  border-radius: 8px;
  background: var(--ui-code-bg);
}

.image-workbench__thumb img,
.image-workbench__mask-preview img {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
}

.image-workbench__thumb-meta {
  padding: 6px;
}

.image-workbench__thumb-name {
  min-width: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-workbench__mask-copy {
  min-width: 0;
}

.image-workbench__error {
  margin-top: 10px;
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  color: var(--text);
  font-size: 11px;
  padding: 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.is-spinning {
  animation: image-settings-spin 1s linear infinite;
}

@keyframes image-settings-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
