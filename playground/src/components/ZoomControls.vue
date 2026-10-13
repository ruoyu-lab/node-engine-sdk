<script setup lang="ts">
import { formatZoom } from '@playground/shared/app/editor-commands'
import PlaygroundIcon from './PlaygroundIcon.vue'

defineProps<{
  zoom: number
}>()

defineEmits<{
  (event: 'zoom-out'): void
  (event: 'zoom-in'): void
}>()
</script>

<template>
  <div class="app-shell__zoom-controls" role="group" aria-label="缩放">
    <button
      type="button"
      class="pg-icon-button"
      aria-label="缩小"
      data-tooltip="缩小"
      data-tooltip-side="top"
      @click="$emit('zoom-out')"
    >
      <PlaygroundIcon name="minus" />
    </button>
    <output class="app-shell__zoom" aria-label="缩放比例">{{ formatZoom(zoom) }}</output>
    <button
      type="button"
      class="pg-icon-button"
      aria-label="放大"
      data-tooltip="放大"
      data-tooltip-side="top"
      @click="$emit('zoom-in')"
    >
      <PlaygroundIcon name="plus" />
    </button>
  </div>
</template>
