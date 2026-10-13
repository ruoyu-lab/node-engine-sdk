<script setup lang="ts">
import type { NodeEngineEditorController, NodeEngineMinimapState } from '@node-engine-sdk/core/view'
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineOptions({
  name: 'NodeEngineMinimap',
})

const props = defineProps<{
  controller: NodeEngineEditorController
  state: NodeEngineMinimapState
}>()

const rootRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let unmountMinimap: (() => void) | null = null

// A child mounts before its parent, so the minimap is attached before the editor itself; the
// controller supports both orders.
onMounted(() => {
  if (!rootRef.value || !canvasRef.value) {
    throw new Error('NodeEngine minimap rendered without its root and canvas elements.')
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
    class="ne-minimap"
    :class="{ 'ne-minimap--dragging': props.state.dragging }"
    :style="props.state.style"
    role="group"
    aria-label="Minimap"
    tabindex="0"
  >
    <canvas ref="canvasRef" class="ne-minimap__canvas" aria-hidden="true" />
    <div
      v-if="props.state.viewportStyle"
      class="ne-minimap__viewport"
      :style="props.state.viewportStyle"
    />
  </div>
</template>
