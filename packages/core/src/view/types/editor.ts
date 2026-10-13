import type { GraphNode, NodeParameterOption } from '../../protocol/index.js'

import type {
  NodeEngineBounds,
  NodeEngineNodeEditorActivateOn,
  NodeEngineNodeEditorFieldType,
  NodeEngineNodeEditorInset,
  NodeEngineRenderContext,
} from './common.js'

export interface NodeEngineNodeEditorFieldContext {
  node: GraphNode
  key: string
  value: unknown
  readonly: boolean
  context: NodeEngineRenderContext
}

/**
 * Display hint for the editor field of the node parameter with the same `key`. Like DOM field
 * hints, editor hints never declare fields: the editable fields are exactly the node definition's
 * `parameters`, and the value domain (`options`) always comes from the parameter itself.
 */
export interface NodeEngineNodeEditorField {
  key: string
  label?: string
  type?: NodeEngineNodeEditorFieldType
  placeholder?: string
  rows?: number
  step?: number
  min?: number
  max?: number
  visible?: (context: NodeEngineNodeEditorFieldContext) => boolean
  disabled?: (context: NodeEngineNodeEditorFieldContext) => boolean
  parse?: (value: string | number | boolean, node: GraphNode) => unknown
}

export interface NodeEngineResolvedNodeEditorField extends Omit<
  NodeEngineNodeEditorField,
  'disabled' | 'type' | 'label' | 'visible'
> {
  label: string
  type: NodeEngineNodeEditorFieldType
  disabled: boolean
  /** The parameter's own options. */
  options?: NodeParameterOption[]
  value: unknown
}

export interface NodeEngineNodeEditorDefinition {
  enabled?: boolean
  activateOn?: NodeEngineNodeEditorActivateOn
  inset?: Partial<NodeEngineNodeEditorInset>
  maxFields?: number
  /** Display hints keyed by parameter. */
  fields?: NodeEngineNodeEditorField[]
}

export type NodeEngineNodeEditorRegistry = Record<string, NodeEngineNodeEditorDefinition>

export interface NodeEngineNodeEditorState {
  nodeId: string
  node: GraphNode
  bounds: NodeEngineBounds
  inset: NodeEngineNodeEditorInset
  activateOn: NodeEngineNodeEditorActivateOn
  fields: NodeEngineResolvedNodeEditorField[]
}
