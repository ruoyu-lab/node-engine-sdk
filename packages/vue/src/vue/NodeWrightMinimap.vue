<script setup lang="ts">
import type { NodeWrightEditorController, NodeWrightMinimapState } from '@node-wright/core/view'
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineOptions({
  name: 'NodeWrightMinimap',
})

const props = defineProps<{
  controller: NodeWrightEditorController
  state: NodeWrightMinimapState
}>()

const rootRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let unmountMinimap: (() => void) | null = null

// A child mounts before its parent, so the minimap is attached before the editor itself; the
// controller supports both orders.
onMounted(() => {
  if (!rootRef.value || !canvasRef.value) {
    throw new Error('NodeWright minimap rendered without its root and canvas elements.')
  }

  unmountMinimap = props.controller.mountMinimap({ root: rootRef.value, canvas: canvasRef.value })
})

onBeforeUnmount(() => {
  unmountMinimap?.()
  unmountMinimap = null
})
</script>

<template>
  <div
    ref="rootRef"
    class="nw-minimap"
    :class="{ 'nw-minimap--dragging': props.state.dragging }"
    :style="props.state.style"
    role="group"
    aria-label="Minimap"
    tabindex="0"
  >
    <canvas ref="canvasRef" class="nw-minimap__canvas" aria-hidden="true" />
    <div
      v-if="props.state.viewportStyle"
      class="nw-minimap__viewport"
      :style="props.state.viewportStyle"
    />
  </div>
</template>
