import type { GraphSnapshot } from '@node-wright/core/protocol'
import type { NodeWrightEditorOptions, NodeWrightEventMap } from '@node-wright/core/view'
import type { Component } from 'vue'

/**
 * Props of the Vue `NodeWright` component: the editor options plus the Vue-only rendering
 * concerns. `domComponents` registers the Vue components that DOM node renderers refer to by
 * their `component` key.
 */
export interface NodeWrightProps extends Omit<NodeWrightEditorOptions, 'onEvent'> {
  ariaLabel?: string
  domComponents?: Record<string, Component>
}

/** Editor events as Vue emits; graph changes use `update:graph` for `v-model:graph`. */
export type NodeWrightEmitMap = Omit<NodeWrightEventMap, 'graph-change'> & {
  'update:graph': [graph: GraphSnapshot]
}
