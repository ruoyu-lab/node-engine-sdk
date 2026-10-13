<script setup lang="ts">
import {
  resolveDomPortDotClass,
  resolveDomPortDotStyle,
  resolveDomPortLabelClass,
  type DomNodeControls,
  type NodeEngineResolvedDomNodePort,
} from '@node-engine-sdk/core/view'

defineProps<{
  port: NodeEngineResolvedDomNodePort
  side: 'left' | 'right'
  controls: DomNodeControls
}>()
</script>

<template>
  <div
    class="ne-default-dom-node__port"
    :class="{
      'ne-default-dom-node__port--left': side === 'left',
      'ne-default-dom-node__port--right': side === 'right',
    }"
    :style="{ top: `${port.top}px` }"
  >
    <span
      v-if="side === 'left'"
      class="ne-default-dom-node__port-dot"
      :class="resolveDomPortDotClass(port)"
      :style="resolveDomPortDotStyle(port)"
      @pointerdown="controls.portPointerDown(port.id, $event)"
      @pointerenter="controls.portPointerEnter(port.id)"
      @pointerleave="controls.portPointerLeave()"
      @pointerup="controls.portPointerUp(port.id, $event)"
    />
    <span class="ne-default-dom-node__port-label" :class="resolveDomPortLabelClass(port)">
      {{ port.label }}
    </span>
    <span
      v-if="side === 'right'"
      class="ne-default-dom-node__port-dot"
      :class="resolveDomPortDotClass(port)"
      :style="resolveDomPortDotStyle(port)"
      @pointerdown="controls.portPointerDown(port.id, $event)"
      @pointerenter="controls.portPointerEnter(port.id)"
      @pointerleave="controls.portPointerLeave()"
      @pointerup="controls.portPointerUp(port.id, $event)"
    />
  </div>
</template>
