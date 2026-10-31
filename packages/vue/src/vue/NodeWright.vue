<script setup lang="ts">
import {
  NODE_WRIGHT_DEFAULT_DOM_COMPONENT,
  type NodeWrightApi,
  type NodeWrightEventSink,
} from '@node-wright/core/view'
import { ref, type Component } from 'vue'
import type { NodeWrightEmitMap, NodeWrightProps } from '../types'
import DefaultDomNode from './DefaultDomNode.vue'
import NodeWrightMinimap from './NodeWrightMinimap.vue'
import { useNodeWrightEditor } from './use-node-wright-editor'

defineOptions({
  name: 'NodeWright',
})

const props = withDefaults(defineProps<NodeWrightProps>(), {
  ariaLabel: 'Node graph editor',
  readonly: undefined,
  gridVisible: undefined,
  snapToGrid: undefined,
  connectionPreview: undefined,
  wheelInertia: undefined,
  minimap: undefined,
})

const emit = defineEmits<NodeWrightEmitMap>()

const rootRef = ref<HTMLElement | null>(null)
const gridCanvasRef = ref<HTMLCanvasElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

/** Vue emits graph changes as `update:graph`; every other editor event keeps its name. */
const emitEvent = emit as (event: string, ...args: unknown[]) => void
const forwardEvent: NodeWrightEventSink = (event, ...args) => {
  emitEvent(event === 'graph-change' ? 'update:graph' : event, ...args)
}

const { controller, view } = useNodeWrightEditor(props, forwardEvent, {
  root: rootRef,
  canvas: canvasRef,
  gridCanvas: gridCanvasRef,
})
const api = controller.api

function resolveDomComponent(key: string): Component {
  if (key === NODE_WRIGHT_DEFAULT_DOM_COMPONENT) {
    return DefaultDomNode
  }

  const component = props.domComponents?.[key]

  if (!component) {
    throw new Error(`NodeWright has no DOM node component registered as "${key}".`)
  }

  return component
}

defineExpose<NodeWrightApi>(api)
</script>

<template>
  <div
    ref="rootRef"
    class="nw-root"
    :data-color-scheme="view.colorScheme"
    :style="view.rootStyle"
    role="application"
    :aria-label="props.ariaLabel"
    tabindex="0"
  >
    <canvas
      v-show="view.gridState.visible"
      ref="gridCanvasRef"
      class="nw-grid-surface"
      aria-hidden="true"
    />
    <canvas
      ref="canvasRef"
      class="nw-canvas-surface"
      :style="{ cursor: view.canvasCursor }"
      aria-hidden="true"
    />

    <slot
      name="background"
      :api="api"
      :graph="view.graph"
      :readonly="view.readonly"
      :grid-state="view.gridState"
      :interaction-state="view.interaction"
      :node-editor-state="view.nodeEditor"
      :toggle-grid="api.view.grid.toggle"
      :render-context="view.renderContext"
    />

    <div
      v-if="view.domLayer.nodes.length"
      class="nw-dom-node-layer"
      :class="{ 'nw-dom-node-layer--composited': view.domLayer.composited }"
      :style="view.domLayer.style"
    >
      <div
        v-for="entry in view.domLayer.nodes"
        :key="entry.id"
        class="nw-dom-node"
        :class="entry.className"
        :style="entry.style"
      >
        <component :is="resolveDomComponent(entry.component)" v-bind="entry.props" />
      </div>
    </div>

    <ul v-if="view.accessibleNodes.length" class="nw-accessible-nodes" aria-label="Canvas nodes">
      <li v-for="node in view.accessibleNodes" :key="node.id">
        <button
          class="nw-accessible-node"
          type="button"
          :aria-pressed="node.selected"
          @click="controller.selectAccessibleNode(node.id)"
        >
          {{ node.label }}
        </button>
      </li>
    </ul>

    <div v-if="view.marqueeStyle" class="nw-marquee" :style="view.marqueeStyle" />
    <div v-if="view.performance.visible && view.performance.sample" class="nw-performance">
      <button
        v-if="view.performance.dismissible"
        class="nw-performance__close"
        type="button"
        aria-label="Close performance monitor"
        @click="controller.hidePerformanceOverlay()"
      >
        ×
      </button>
      <div>{{ view.performance.sample.renderMode }} / {{ view.performance.sample.mode }}</div>
      <div>{{ view.performance.sample.fps.toFixed(0) }} fps</div>
      <div>frame {{ view.performance.sample.frameMs.toFixed(2) }} ms</div>
      <div>draw {{ view.performance.sample.drawMs.toFixed(2) }} ms</div>
      <div>
        nodes {{ view.performance.sample.visibleNodes }}/{{ view.performance.sample.totalNodes }}
      </div>
      <div>
        edges {{ view.performance.sample.visibleEdges }}/{{ view.performance.sample.totalEdges }}
      </div>
      <div>
        groups {{ view.performance.sample.visibleGroups }}/{{ view.performance.sample.totalGroups }}
      </div>
    </div>

    <NodeWrightMinimap v-if="view.minimap" :controller="controller" :state="view.minimap" />

    <slot
      name="overlay"
      :api="api"
      :graph="view.graph"
      :selection="view.selection"
      :grid-state="view.gridState"
      :interaction-state="view.interaction"
      :node-editor-state="view.nodeEditor"
      :context-menu-state="view.contextMenu"
    />
  </div>
</template>
