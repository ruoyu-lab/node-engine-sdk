<script setup lang="ts">
import { ref } from 'vue'
import type { CanvasThemeId } from '@playground/shared/app/canvas-themes'
import type { HistoryAvailability } from '@playground/shared/app/editor-commands'
import { GRAPH_FILE_ACCEPT } from '@playground/shared/app/graph-file'
import PlaygroundIcon from './PlaygroundIcon.vue'

defineProps<{
  canRun: boolean
  running: boolean
  history: HistoryAvailability
  theme: CanvasThemeId
}>()

const emit = defineEmits<{
  (event: 'run'): void
  (event: 'layout'): void
  (event: 'fit'): void
  (event: 'reset'): void
  (event: 'undo'): void
  (event: 'redo'): void
  (event: 'import', file: File): void
  (event: 'export'): void
  (event: 'toggle-theme'): void
}>()

const importInput = ref<HTMLInputElement | null>(null)

function readImportFile(event: Event): void {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]

  input.value = ''

  if (file) {
    emit('import', file)
  }
}
</script>

<template>
  <div class="app-shell__toolbar" role="toolbar" aria-label="画布操作" data-canvas-inset>
    <button
      type="button"
      class="pg-toolbar-button pg-toolbar-button--primary"
      :disabled="!canRun || running"
      @click="$emit('run')"
    >
      <PlaygroundIcon name="play" />
      <span class="pg-toolbar-button__label">{{ running ? '运行中' : '运行' }}</span>
    </button>
    <span class="pg-toolbar-separator" aria-hidden="true" />
    <button
      type="button"
      class="pg-icon-button"
      aria-label="自动布局"
      data-tooltip="自动布局"
      @click="$emit('layout')"
    >
      <PlaygroundIcon name="layout" />
    </button>
    <button
      type="button"
      class="pg-icon-button"
      aria-label="适配"
      data-tooltip="适配画布"
      @click="$emit('fit')"
    >
      <PlaygroundIcon name="fit" />
    </button>
    <button
      type="button"
      class="pg-icon-button"
      aria-label="重置"
      data-tooltip="重置场景"
      @click="$emit('reset')"
    >
      <PlaygroundIcon name="reset" />
    </button>
    <span class="pg-toolbar-separator" aria-hidden="true" />
    <button
      type="button"
      class="pg-icon-button"
      aria-label="撤销"
      data-tooltip="撤销 · ⌘Z"
      :disabled="!history.canUndo"
      @click="$emit('undo')"
    >
      <PlaygroundIcon name="undo" />
    </button>
    <button
      type="button"
      class="pg-icon-button"
      aria-label="重做"
      data-tooltip="重做 · ⇧⌘Z"
      :disabled="!history.canRedo"
      @click="$emit('redo')"
    >
      <PlaygroundIcon name="redo" />
    </button>
    <span class="pg-toolbar-separator" aria-hidden="true" />
    <button
      type="button"
      class="pg-icon-button"
      aria-label="导入"
      data-tooltip="导入 JSON"
      @click="importInput?.click()"
    >
      <PlaygroundIcon name="import" />
    </button>
    <button
      type="button"
      class="pg-icon-button"
      aria-label="导出"
      data-tooltip="导出 JSON"
      @click="$emit('export')"
    >
      <PlaygroundIcon name="export" />
    </button>
    <input
      ref="importInput"
      class="app-shell__file-input"
      type="file"
      :accept="GRAPH_FILE_ACCEPT"
      aria-label="导入图文件"
      @change="readImportFile"
    />
    <span class="pg-toolbar-separator" aria-hidden="true" />
    <button
      type="button"
      class="pg-icon-button"
      aria-label="浅色主题"
      :aria-pressed="theme === 'light'"
      :data-tooltip="theme === 'light' ? '切换到深色主题' : '切换到浅色主题'"
      @click="$emit('toggle-theme')"
    >
      <PlaygroundIcon :name="theme === 'light' ? 'sun' : 'moon'" />
    </button>
  </div>
</template>
