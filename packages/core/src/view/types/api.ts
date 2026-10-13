import type { GraphStore } from '../../store/index.js'
import type {
  ConnectionValidationResult,
  GraphDiagnostic,
  GraphEdge,
  GraphEdgePatch,
  GraphEdgeReconnect,
  GraphEndpoint,
  GraphGroup,
  GraphGroupPatch,
  GraphMetadata,
  GraphNode,
  GraphNodePatch,
  GraphPort,
  GraphSnapshot,
  GraphRepairResult,
  GraphValue,
  GraphCommandRegistryEntry,
  GraphCommandDispatchResult,
  GraphValidationResult,
  EdgeDefinition,
  NodeDefinition,
  XYPosition,
} from '../../protocol/index.js'

import type {
  NodeEngineBounds,
  NodeEngineClipboard,
  NodeEngineCoordinateSpace,
  NodeEngineInteractionState,
  NodeEngineContextTarget,
  NodeEngineFitPadding,
  NodeEngineGridState,
  NodeEnginePerformanceSample,
  NodeEnginePortAnchor,
  NodeEngineSelectionMode,
  SelectionState,
  ViewportState,
} from './common.js'
import type { NodeEngineNodeEditorState } from './editor.js'
import type {
  NodeEngineResolvedContextMenuItem,
  NodeEngineResolvedToolbarItem,
} from './extensions.js'
import type { NodeEngineContextMenuState } from './events.js'

export interface NodeEngineApi {
  runtime: {
    ids: {
      create: (prefix?: string) => string
    }
    store: {
      get: () => GraphStore
    }
    performance: {
      get: () => NodeEnginePerformanceSample | null
    }
  }
  graph: {
    get: () => GraphSnapshot
    getLive: () => GraphSnapshot
    set: (graph: GraphSnapshot) => GraphSnapshot
    apply: (graph: GraphSnapshot) => GraphSnapshot
    export: () => GraphSnapshot
    import: (input: unknown) => GraphSnapshot
    validate: () => GraphValidationResult
    repair: () => GraphRepairResult
  }
  view: {
    get: () => ViewportState
    getLive: () => ViewportState
    set: (patch: Partial<ViewportState>) => GraphSnapshot
    /**
     * Fits content into the editor: `graph` every node and group, `selection` and `nodes` the
     * given nodes. `padding` is the screen space kept free on every side, or per side (e.g. under
     * floating panels); the content is centred in the area that remains.
     */
    fit: {
      graph: (padding?: NodeEngineFitPadding) => void
      selection: (padding?: NodeEngineFitPadding) => void
      nodes: (nodeIds: string[], padding?: NodeEngineFitPadding) => void
    }
    center: {
      node: (nodeId: string) => void
      selection: () => void
    }
    zoom: {
      to: (zoom: number) => void
    }
    grid: {
      setVisible: (visible: boolean) => void
      toggle: () => void
      state: () => NodeEngineGridState
    }
  }
  coordinates: {
    screenToGraph: (point: XYPosition) => XYPosition
    clientToGraph: (point: XYPosition) => XYPosition
    graphToScreen: (point: XYPosition) => XYPosition
    graphRectToScreenRect: (bounds: NodeEngineBounds) => NodeEngineBounds
  }
  selection: {
    get: () => SelectionState
    set: (selection: Partial<SelectionState>) => GraphSnapshot
    clear: () => GraphSnapshot
    all: () => GraphSnapshot
    nodes: (nodeIds: string[]) => GraphSnapshot
    edges: (edgeIds: string[]) => GraphSnapshot
    rect: (
      bounds: NodeEngineBounds,
      options?: {
        mode?: NodeEngineSelectionMode
        includeEdges?: boolean
      },
    ) => GraphSnapshot
    remove: () => GraphSnapshot
  }
  history: {
    canUndo: () => boolean
    canRedo: () => boolean
    undo: () => GraphSnapshot
    redo: () => GraphSnapshot
  }
  nodes: {
    create: (type: string, patch?: Partial<Omit<GraphNode, 'id' | 'type'>>) => GraphNode | null
    add: (node: Omit<GraphNode, 'id'> & { id?: string }) => GraphNode
    get: (nodeId: string) => GraphNode | undefined
    getLive: (nodeId: string) => GraphNode | undefined
    update: (nodeId: string, patch: GraphNodePatch) => GraphSnapshot
    move: (nodeIds: string[], delta: XYPosition) => GraphSnapshot
    remove: (nodeId: string) => GraphSnapshot
    bounds: (nodeId: string, space?: NodeEngineCoordinateSpace) => NodeEngineBounds | null
    params: {
      update: (
        nodeId: string,
        key: string,
        value: GraphValue,
        options?: {
          source?: string
        },
      ) => GraphSnapshot
      set: (
        nodeId: string,
        params: GraphMetadata,
        options?: {
          replace?: boolean
          source?: string
        },
      ) => GraphSnapshot
    }
    editor: {
      open: (nodeId: string) => boolean
      close: () => void
      state: () => NodeEngineNodeEditorState | null
    }
  }
  edges: {
    add: (edge: Omit<GraphEdge, 'id'> & { id?: string }) => GraphEdge
    get: (edgeId: string) => GraphEdge | undefined
    update: (edgeId: string, patch: GraphEdgePatch) => GraphSnapshot
    reconnect: (edgeId: string, reconnect: GraphEdgeReconnect) => ConnectionValidationResult
    disconnect: (edgeId: string, reason?: string) => GraphSnapshot
    remove: (edgeId: string) => GraphSnapshot
    connect: (
      source: GraphEndpoint,
      target: GraphEndpoint,
      options?: {
        edgeId?: string
        edgeType?: string
        data?: GraphEdge['data']
      },
    ) => ConnectionValidationResult
    validate: (source: GraphEndpoint, target: GraphEndpoint) => ConnectionValidationResult
  }
  groups: {
    add: (group: Omit<GraphGroup, 'id'> & { id?: string }) => GraphGroup
    get: (groupId: string) => GraphGroup | undefined
    getLive: (groupId: string) => GraphGroup | undefined
    update: (groupId: string, patch: GraphGroupPatch) => GraphSnapshot
    move: (
      groupIds: string[],
      delta: XYPosition,
      options?: {
        moveNodes?: boolean
      },
    ) => GraphSnapshot
    resize: (
      groupId: string,
      size: {
        width?: number
        height?: number
      },
    ) => GraphSnapshot
    collapse: (groupId: string) => GraphSnapshot
    expand: (groupId: string) => GraphSnapshot
    toggleCollapsed: (groupId: string) => GraphSnapshot
    isCollapsed: (groupId: string) => boolean
    remove: (groupId: string) => GraphSnapshot
    list: () => GraphGroup[]
    bounds: (groupId: string, space?: NodeEngineCoordinateSpace) => NodeEngineBounds | null
  }
  ports: {
    get: (endpoint: GraphEndpoint) => GraphPort | undefined
    anchor: (
      endpoint: GraphEndpoint,
      space?: NodeEngineCoordinateSpace,
    ) => NodeEnginePortAnchor | null
  }
  clipboard: {
    copy: () => NodeEngineClipboard | null
    paste: (position?: XYPosition, clipboard?: NodeEngineClipboard | null) => GraphSnapshot | null
    duplicate: (offset?: XYPosition) => GraphSnapshot | null
  }
  commands: {
    dispatch: (commandId: string, payload?: unknown) => GraphCommandDispatchResult
    get: (commandId: string) => GraphCommandRegistryEntry | undefined
    list: () => GraphCommandRegistryEntry[]
  }
  definitions: {
    nodes: {
      get: (type: string) => NodeDefinition | undefined
      list: () => NodeDefinition[]
    }
    edges: {
      get: (type: string) => EdgeDefinition | undefined
      list: () => EdgeDefinition[]
    }
  }
  diagnostics: {
    list: () => GraphDiagnostic[]
  }
  transactions: {
    mutate: (label: string, recipe: (draft: GraphSnapshot) => void) => GraphSnapshot
    run: (label: string | undefined, operation: () => void) => GraphSnapshot
  }
  menu: {
    open: (target: NodeEngineContextTarget, position: XYPosition) => void
    close: () => void
    state: () => NodeEngineContextMenuState | null
    resolve: {
      toolbar: () => NodeEngineResolvedToolbarItem[]
      context: (
        target: NodeEngineContextTarget,
        position: XYPosition,
      ) => NodeEngineResolvedContextMenuItem[]
    }
  }
  interaction: {
    state: () => NodeEngineInteractionState
  }
}
