<script setup lang="ts">
import {
  NODE_ENGINE_DEFAULT_DOM_COMPONENT,
  type NodeEngineApi,
  type NodeEngineEventSink,
} from '@node-engine-sdk/core/view'
import { ref, type Component } from 'vue'
import type { NodeEngineEmitMap, NodeEngineProps } from '../types'
import DefaultDomNode from './DefaultDomNode.vue'
import NodeEngineMinimap from './NodeEngineMinimap.vue'
import { useNodeEngineEditor } from './use-node-engine-editor'

defineOptions({
  name: 'NodeEngine',
})

const props = withDefaults(defineProps<NodeEngineProps>(), {
  ariaLabel: 'Node graph editor',
  readonly: undefined,
  gridVisible: undefined,
  snapToGrid: undefined,
  connectionPreview: undefined,
  wheelInertia: undefined,
  minimap: undefined,
})

const emit = defineEmits<NodeEngineEmitMap>()

const rootRef = ref<HTMLElement | null>(null)
const gridCanvasRef = ref<HTMLCanvasElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

/** Vue emits graph changes as `update:graph`; every other editor event keeps its name. */
const emitEvent = emit as (event: string, ...args: unknown[]) => void
const forwardEvent: NodeEngineEventSink = (event, ...args) => {
  emitEvent(event === 'graph-change' ? 'update:graph' : event, ...args)
}

const { controller, view } = useNodeEngineEditor(props, forwardEvent, {
  root: rootRef,
  canvas: canvasRef,
  gridCanvas: gridCanvasRef,
})
const api = controller.api

function resolveDomComponent(key: string): Component {
  if (key === NODE_ENGINE_DEFAULT_DOM_COMPONENT) {
    return DefaultDomNode
  }

  const component = props.domComponents?.[key]

  if (!component) {
    throw new Error(`NodeEngine has no DOM node component registered as "${key}".`)
  }

  return component
}

defineExpose<NodeEngineApi>(api)
</script>

<template>
  <div
    ref="rootRef"
    class="ne-root"
    :data-color-scheme="view.colorScheme"
    :style="view.rootStyle"
    role="application"
    :aria-label="props.ariaLabel"
    tabindex="0"
  >
    <canvas
      v-show="view.gridState.visible"
      ref="gridCanvasRef"
      class="ne-grid-surface"
      aria-hidden="true"
    />
    <canvas
      ref="canvasRef"
      class="ne-canvas-surface"
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
      class="ne-dom-node-layer"
      :class="{ 'ne-dom-node-layer--composited': view.domLayer.composited }"
      :style="view.domLayer.style"
    >
      <div
        v-for="entry in view.domLayer.nodes"
        :key="entry.id"
        class="ne-dom-node"
        :class="entry.className"
        :style="entry.style"
      >
        <component :is="resolveDomComponent(entry.component)" v-bind="entry.props" />
      </div>
    </div>

    <ul v-if="view.accessibleNodes.length" class="ne-accessible-nodes" aria-label="Canvas nodes">
      <li v-for="node in view.accessibleNodes" :key="node.id">
        <button
          class="ne-accessible-node"
          type="button"
          :aria-pressed="node.selected"
          @click="controller.selectAccessibleNode(node.id)"
        >
          {{ node.label }}
        </button>
      </li>
    </ul>

    <div v-if="view.marqueeStyle" class="ne-marquee" :style="view.marqueeStyle" />
    <div v-if="view.performance.visible && view.performance.sample" class="ne-performance">
      <button
        v-if="view.performance.dismissible"
        class="ne-performance__close"
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

    <NodeEngineMinimap v-if="view.minimap" :controller="controller" :state="view.minimap" />

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
