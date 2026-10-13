import type {
  GraphEdge,
  GraphEndpoint,
  GraphGroup,
  GraphNode,
  GraphPlugin,
  GraphPort,
  GraphSnapshot,
  EdgeDefinition,
  NodeDefinition,
  XYPosition,
} from '../../protocol/index.js'

import type { NodeEngineContextTarget, NodeEngineRenderContext } from './common.js'
import type {
  NodeEngineCanvasEdgeRenderer,
  NodeEngineCanvasGroupRenderer,
  NodeEngineCanvasRenderers,
  NodeEngineCanvasNodeRenderer,
  NodeEngineDomNodeRendererDefinition,
} from './render.js'
import type { NodeEngineNodeEditorDefinition, NodeEngineNodeEditorRegistry } from './editor.js'
import type { NodeEngineApi } from './api.js'

export interface NodeTypeDefinition {
  label?: string
  /**
   * Accent colour of the node type (any CSS colour; hex enables the derived tints of canvas
   * painting): the header marker of the default DOM node, the canvas node accent, the minimap
   * fill and the fallback colour of edges from untyped ports. A node's `meta.accent` overrides it.
   */
  accent?: string
  width?: number
  height?: number
  canvas?: NodeEngineCanvasNodeRenderer
  dom?: NodeEngineDomNodeRendererDefinition
  editor?: NodeEngineNodeEditorDefinition
  ports?: GraphPort[]
}

export interface EdgeTypeDefinition {
  stroke?: string
  strokeWidth?: number
  canvas?: NodeEngineCanvasEdgeRenderer
}

export type NodeTypeRegistry = Record<string, NodeTypeDefinition>
export type EdgeTypeRegistry = Record<string, EdgeTypeDefinition>

export interface NodeEngineGroupRendererContribution {
  id: string
  order?: number
  match?: (group: GraphGroup) => boolean
  renderer: NodeEngineCanvasGroupRenderer
}

export interface NodeEngineEdgeRendererContribution {
  id: string
  type?: string
  order?: number
  match?: (edge: GraphEdge, schema: EdgeDefinition | undefined) => boolean
  renderer: NodeEngineCanvasEdgeRenderer
}

export interface NodeEngineToolbarItem {
  id: string
  label: string
  title?: string
  order?: number
  kind?: 'default' | 'accent'
  visible?: (context: NodeEngineRenderContext) => boolean
  disabled?: (context: NodeEngineRenderContext) => boolean
  run: (context: NodeEngineRenderContext, event?: MouseEvent | KeyboardEvent) => void
}

export interface NodeEngineResolvedToolbarItem {
  id: string
  label: string
  title?: string
  order?: number
  kind?: 'default' | 'accent'
  disabled: boolean
  run: (event?: MouseEvent | KeyboardEvent) => void
}

export interface NodeEngineContextMenuContext extends NodeEngineRenderContext {
  position: XYPosition
  graphPosition: XYPosition
  target: NodeEngineContextTarget
}

export interface NodeEngineContextMenuItem {
  id: string
  label: string
  title?: string
  order?: number
  visible?: (context: NodeEngineContextMenuContext) => boolean
  disabled?: (context: NodeEngineContextMenuContext) => boolean
  run: (context: NodeEngineContextMenuContext, event?: MouseEvent | KeyboardEvent) => void
}

export interface NodeEngineResolvedContextMenuItem {
  id: string
  label: string
  title?: string
  order?: number
  disabled: boolean
  run: (event?: MouseEvent | KeyboardEvent) => void
}

export interface NodeEngineHotkey {
  id: string
  key: string
  priority?: number
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  preventDefault?: boolean
  visible?: (context: NodeEngineRenderContext) => boolean
  run: (context: NodeEngineRenderContext, event: KeyboardEvent) => void
}

export interface NodeEngineComponentsPluginContributions {
  nodeTypes?: NodeTypeRegistry
  nodeEditors?: NodeEngineNodeEditorRegistry
  edgeTypes?: EdgeTypeRegistry
  renderers?: Partial<NodeEngineCanvasRenderers>
  groupRenderers?: NodeEngineGroupRendererContribution[]
  edgeRenderers?: NodeEngineEdgeRendererContribution[]
  toolbarItems?: NodeEngineToolbarItem[]
  contextMenuItems?: NodeEngineContextMenuItem[]
  hotkeys?: NodeEngineHotkey[]
}

export interface NodeEnginePlugin extends GraphPlugin {
  components?: NodeEngineComponentsPluginContributions
}

export interface NodeEngineResolvePortValueContext {
  graph: GraphSnapshot
  endpoint: GraphEndpoint
  port?: GraphPort
  node?: GraphNode
  schema?: NodeDefinition
  definition?: NodeTypeDefinition
  api: NodeEngineApi
}

export type NodeEngineResolvePortValueHook = (context: NodeEngineResolvePortValueContext) => unknown

export type NodeEngineSerializeHook = (graph: GraphSnapshot) => GraphSnapshot
export type NodeEngineDeserializeHook = (input: unknown) => unknown
export type NodeEngineBeforeImportHook = (graph: GraphSnapshot) => GraphSnapshot | false | void
export type NodeEngineAfterImportHook = (graph: GraphSnapshot) => void
