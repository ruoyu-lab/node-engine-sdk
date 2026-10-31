<script setup lang="ts">
import { DOM_NODE_RESIZE_HANDLES, type DomNodeControls } from '@node-wright/core/view'

defineProps<{
  controls: DomNodeControls
}>()
</script>

<template>
  <div
    v-for="item in DOM_NODE_RESIZE_HANDLES"
    :key="item.handle"
    class="nw-default-dom-node__resize-corner"
    :class="item.className"
    @pointerdown="controls.resizePointerDown(item.handle, $event)"
  />
</template>
