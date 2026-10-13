import type { GraphSnapshot } from '@node-engine-sdk/core/protocol'
import type { NodeEngineEditorOptions, NodeEngineEventMap } from '@node-engine-sdk/core/view'
import type { Component } from 'vue'

/**
 * Props of the Vue `NodeEngine` component: the editor options plus the Vue-only rendering
 * concerns. `domComponents` registers the Vue components that DOM node renderers refer to by
 * their `component` key.
 */
export interface NodeEngineProps extends Omit<NodeEngineEditorOptions, 'onEvent'> {
  ariaLabel?: string
  domComponents?: Record<string, Component>
}

/** Editor events as Vue emits; graph changes use `update:graph` for `v-model:graph`. */
export type NodeEngineEmitMap = Omit<NodeEngineEventMap, 'graph-change'> & {
  'update:graph': [graph: GraphSnapshot]
}
