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

import type { NodeWrightContextTarget, NodeWrightRenderContext } from './common.js'
import type {
  NodeWrightCanvasEdgeRenderer,
  NodeWrightCanvasGroupRenderer,
  NodeWrightCanvasRenderers,
  NodeWrightCanvasNodeRenderer,
  NodeWrightDomNodeRendererDefinition,
} from './render.js'
import type { NodeWrightNodeEditorDefinition, NodeWrightNodeEditorRegistry } from './editor.js'
import type { NodeWrightApi } from './api.js'

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
  canvas?: NodeWrightCanvasNodeRenderer
  dom?: NodeWrightDomNodeRendererDefinition
  editor?: NodeWrightNodeEditorDefinition
  ports?: GraphPort[]
}

export interface EdgeTypeDefinition {
  stroke?: string
  strokeWidth?: number
  canvas?: NodeWrightCanvasEdgeRenderer
}

export type NodeTypeRegistry = Record<string, NodeTypeDefinition>
export type EdgeTypeRegistry = Record<string, EdgeTypeDefinition>

export interface NodeWrightGroupRendererContribution {
  id: string
  order?: number
  match?: (group: GraphGroup) => boolean
  renderer: NodeWrightCanvasGroupRenderer
}

export interface NodeWrightEdgeRendererContribution {
  id: string
  type?: string
  order?: number
  match?: (edge: GraphEdge, schema: EdgeDefinition | undefined) => boolean
  renderer: NodeWrightCanvasEdgeRenderer
}

export interface NodeWrightToolbarItem {
  id: string
  label: string
  title?: string
  order?: number
  kind?: 'default' | 'accent'
  visible?: (context: NodeWrightRenderContext) => boolean
  disabled?: (context: NodeWrightRenderContext) => boolean
  run: (context: NodeWrightRenderContext, event?: MouseEvent | KeyboardEvent) => void
}

export interface NodeWrightResolvedToolbarItem {
  id: string
  label: string
  title?: string
  order?: number
  kind?: 'default' | 'accent'
  disabled: boolean
  run: (event?: MouseEvent | KeyboardEvent) => void
}

export interface NodeWrightContextMenuContext extends NodeWrightRenderContext {
  position: XYPosition
  graphPosition: XYPosition
  target: NodeWrightContextTarget
}

export interface NodeWrightContextMenuItem {
  id: string
  label: string
  title?: string
  order?: number
  visible?: (context: NodeWrightContextMenuContext) => boolean
  disabled?: (context: NodeWrightContextMenuContext) => boolean
  run: (context: NodeWrightContextMenuContext, event?: MouseEvent | KeyboardEvent) => void
}

export interface NodeWrightResolvedContextMenuItem {
  id: string
  label: string
  title?: string
  order?: number
  disabled: boolean
  run: (event?: MouseEvent | KeyboardEvent) => void
}

export interface NodeWrightHotkey {
  id: string
  key: string
  priority?: number
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  preventDefault?: boolean
  visible?: (context: NodeWrightRenderContext) => boolean
  run: (context: NodeWrightRenderContext, event: KeyboardEvent) => void
}

export interface NodeWrightComponentsPluginContributions {
  nodeTypes?: NodeTypeRegistry
  nodeEditors?: NodeWrightNodeEditorRegistry
  edgeTypes?: EdgeTypeRegistry
  renderers?: Partial<NodeWrightCanvasRenderers>
  groupRenderers?: NodeWrightGroupRendererContribution[]
  edgeRenderers?: NodeWrightEdgeRendererContribution[]
  toolbarItems?: NodeWrightToolbarItem[]
  contextMenuItems?: NodeWrightContextMenuItem[]
  hotkeys?: NodeWrightHotkey[]
}

export interface NodeWrightPlugin extends GraphPlugin {
  components?: NodeWrightComponentsPluginContributions
}

export interface NodeWrightResolvePortValueContext {
  graph: GraphSnapshot
  endpoint: GraphEndpoint
  port?: GraphPort
  node?: GraphNode
  schema?: NodeDefinition
  definition?: NodeTypeDefinition
  api: NodeWrightApi
}

export type NodeWrightResolvePortValueHook = (context: NodeWrightResolvePortValueContext) => unknown

export type NodeWrightSerializeHook = (graph: GraphSnapshot) => GraphSnapshot
export type NodeWrightDeserializeHook = (input: unknown) => unknown
export type NodeWrightBeforeImportHook = (graph: GraphSnapshot) => GraphSnapshot | false | void
export type NodeWrightAfterImportHook = (graph: GraphSnapshot) => void
