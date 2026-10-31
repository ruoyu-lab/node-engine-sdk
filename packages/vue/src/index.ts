import type { NodeWrightDomNodeProps } from '@node-wright/core/view'
import type { DefineComponent } from 'vue'
import NodeWrightComponent from './vue/NodeWright.vue'
import DefaultDomNodeComponent from './vue/DefaultDomNode.vue'
import type { NodeWrightProps } from './types.js'

export const NodeWright = NodeWrightComponent as unknown as DefineComponent<NodeWrightProps>
export const DefaultDomNode =
  DefaultDomNodeComponent as unknown as DefineComponent<NodeWrightDomNodeProps>

export type { NodeWrightEmitMap, NodeWrightProps } from './types.js'
