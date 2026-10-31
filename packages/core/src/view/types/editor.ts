import type { GraphNode, NodeParameterOption } from '../../protocol/index.js'

import type {
  NodeWrightBounds,
  NodeWrightNodeEditorActivateOn,
  NodeWrightNodeEditorFieldType,
  NodeWrightNodeEditorInset,
  NodeWrightRenderContext,
} from './common.js'

export interface NodeWrightNodeEditorFieldContext {
  node: GraphNode
  key: string
  value: unknown
  readonly: boolean
  context: NodeWrightRenderContext
}

/**
 * Display hint for the editor field of the node parameter with the same `key`. Like DOM field
 * hints, editor hints never declare fields: the editable fields are exactly the node definition's
 * `parameters`, and the value domain (`options`) always comes from the parameter itself.
 */
export interface NodeWrightNodeEditorField {
  key: string
  label?: string
  type?: NodeWrightNodeEditorFieldType
  placeholder?: string
  rows?: number
  step?: number
  min?: number
  max?: number
  visible?: (context: NodeWrightNodeEditorFieldContext) => boolean
  disabled?: (context: NodeWrightNodeEditorFieldContext) => boolean
  parse?: (value: string | number | boolean, node: GraphNode) => unknown
}

export interface NodeWrightResolvedNodeEditorField extends Omit<
  NodeWrightNodeEditorField,
  'disabled' | 'type' | 'label' | 'visible'
> {
  label: string
  type: NodeWrightNodeEditorFieldType
  disabled: boolean
  /** The parameter's own options. */
  options?: NodeParameterOption[]
  value: unknown
}

export interface NodeWrightNodeEditorDefinition {
  enabled?: boolean
  activateOn?: NodeWrightNodeEditorActivateOn
  inset?: Partial<NodeWrightNodeEditorInset>
  maxFields?: number
  /** Display hints keyed by parameter. */
  fields?: NodeWrightNodeEditorField[]
}

export type NodeWrightNodeEditorRegistry = Record<string, NodeWrightNodeEditorDefinition>

export interface NodeWrightNodeEditorState {
  nodeId: string
  node: GraphNode
  bounds: NodeWrightBounds
  inset: NodeWrightNodeEditorInset
  activateOn: NodeWrightNodeEditorActivateOn
  fields: NodeWrightResolvedNodeEditorField[]
}
