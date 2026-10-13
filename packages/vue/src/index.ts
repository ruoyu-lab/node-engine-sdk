import type { NodeEngineDomNodeProps } from '@node-engine-sdk/core/view'
import type { DefineComponent } from 'vue'
import NodeEngineComponent from './vue/NodeEngine.vue'
import DefaultDomNodeComponent from './vue/DefaultDomNode.vue'
import type { NodeEngineProps } from './types.js'

export const NodeEngine = NodeEngineComponent as unknown as DefineComponent<NodeEngineProps>
export const DefaultDomNode =
  DefaultDomNodeComponent as unknown as DefineComponent<NodeEngineDomNodeProps>

export type { NodeEngineEmitMap, NodeEngineProps } from './types.js'
