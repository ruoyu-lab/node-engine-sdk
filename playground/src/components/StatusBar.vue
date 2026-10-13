<script setup lang="ts">
import { playgroundShortcuts } from '@playground/shared/app/shortcuts'
import PlaygroundIcon from './PlaygroundIcon.vue'

defineProps<{
  shortcutsOpen: boolean
  performanceOverlay: boolean
}>()

defineEmits<{
  (event: 'toggle-shortcuts'): void
  (event: 'toggle-performance'): void
}>()
</script>

<template>
  <div class="app-shell__status">
    <div id="shortcut-hints" class="shortcut-hints" :hidden="!shortcutsOpen" aria-label="快捷键">
      <div class="shortcut-hints__header">
        <strong>快捷键与手势</strong>
        <button
          type="button"
          class="pg-icon-button pg-icon-button--small"
          aria-label="关闭快捷键"
          @click="$emit('toggle-shortcuts')"
        >
          <PlaygroundIcon name="close" />
        </button>
      </div>
      <dl class="shortcut-hints__list">
        <div
          v-for="shortcut in playgroundShortcuts"
          :key="shortcut.action + shortcut.keys.join('+')"
          class="shortcut-hints__row"
        >
          <dt>
            <kbd v-for="key in shortcut.keys" :key="key">{{ key }}</kbd>
          </dt>
          <dd>{{ shortcut.action }}</dd>
        </div>
      </dl>
    </div>
    <div class="app-shell__status-actions">
      <button
        type="button"
        class="pg-chip-button"
        :aria-expanded="shortcutsOpen"
        aria-controls="shortcut-hints"
        @click="$emit('toggle-shortcuts')"
      >
        <PlaygroundIcon name="keyboard" />
        <span>快捷键</span>
      </button>
      <button
        type="button"
        class="pg-chip-button"
        :aria-pressed="performanceOverlay"
        @click="$emit('toggle-performance')"
      >
        <PlaygroundIcon name="activity" />
        <span>性能</span>
      </button>
    </div>
  </div>
</template>
