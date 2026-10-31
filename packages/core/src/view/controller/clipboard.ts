import type { GraphStore } from '../../store/index.js'
import {
  cloneValue,
  parseGraph,
  type GraphNode,
  type GraphSnapshot,
  type XYPosition,
} from '../../protocol/index.js'
import type { ReadonlySignal } from '../reactive.js'
import type {
  NodeWrightAfterImportHook,
  NodeWrightBeforeImportHook,
  NodeWrightClipboard,
  NodeWrightDeserializeHook,
  NodeWrightEventSink,
  NodeWrightSerializeHook,
  SelectionState,
} from '../types/index.js'

interface ClipboardBounds {
  x: number
  y: number
}

export interface GraphTransferHooks {
  serializeGraph?: NodeWrightSerializeHook
  deserializeGraph?: NodeWrightDeserializeHook
  beforeImport?: NodeWrightBeforeImportHook
  afterImport?: NodeWrightAfterImportHook
}

/**
 * Graph export/import through the serialization hooks, and copy/paste of the selection. Pasted
 * entities get fresh ids; edges are kept only when both endpoints are pasted.
 */
export interface ClipboardModel {
  hasContent: () => boolean
  serialize: () => GraphSnapshot
  importGraph: (input: unknown) => GraphSnapshot
  copySelection: () => NodeWrightClipboard | null
  pasteAt: (position?: XYPosition, clipboard?: NodeWrightClipboard | null) => GraphSnapshot | null
  duplicateSelection: (offset?: XYPosition) => GraphSnapshot | null
}

export function createClipboardModel(options: {
  selection: ReadonlySignal<SelectionState>
  getStore: () => GraphStore
  getHooks: () => GraphTransferHooks
  getBounds: (nodes: GraphNode[]) => ClipboardBounds | null
  setSelection: (selection: Partial<SelectionState>, source: string) => GraphSnapshot
  closeContextMenu: () => void
  emit: NodeWrightEventSink
}): ClipboardModel {
  let clipboardState: NodeWrightClipboard | null = null

  function serialize(): GraphSnapshot {
    const graph = options.getStore().getSnapshot()
    const { serializeGraph } = options.getHooks()

    return serializeGraph ? cloneValue(serializeGraph(cloneValue(graph))) : graph
  }

  function resolveImportedGraph(input: unknown): GraphSnapshot | null {
    const store = options.getStore()
    const { deserializeGraph, beforeImport } = options.getHooks()
    const deserialized = deserializeGraph ? deserializeGraph(input) : input
    const parseOptions = {
      nodeDefinitions: store.listNodeDefinitions(),
      edgeDefinitions: store.listEdgeDefinitions(),
    }
    const graph = parseGraph(deserialized, parseOptions)
    const intercepted = beforeImport?.(cloneValue(graph))

    if (intercepted === false) {
      return null
    }

    return intercepted ? parseGraph(intercepted, parseOptions) : graph
  }

  function importGraph(input: unknown): GraphSnapshot {
    options.closeContextMenu()
    const store = options.getStore()
    const nextGraph = resolveImportedGraph(input)

    if (!nextGraph) {
      return store.getSnapshot()
    }

    const importedGraph = store.replaceGraph(nextGraph, { source: 'import' })
    options.getHooks().afterImport?.(cloneValue(importedGraph))
    options.emit('imported', { input, graph: importedGraph })
    return importedGraph
  }

  function buildClipboardFromSelection(): NodeWrightClipboard | null {
    const graph = options.getStore().getSnapshot()
    const selection = options.selection.peek()
    const selectedNodeIds = new Set(selection.nodes)
    const selectedNodes = graph.nodes.filter((node) => selectedNodeIds.has(node.id))

    if (!selectedNodes.length) {
      return null
    }

    const selectedEdges = graph.edges.filter(
      (edge) =>
        selection.edges.includes(edge.id) ||
        (selectedNodeIds.has(edge.source.nodeId) && selectedNodeIds.has(edge.target.nodeId)),
    )
    const selectedGroups = graph.groups.filter((group) =>
      group.nodeIds?.some((nodeId) => selectedNodeIds.has(nodeId)),
    )

    return {
      nodes: cloneValue(selectedNodes),
      edges: cloneValue(selectedEdges),
      groups: cloneValue(selectedGroups),
      selection: {
        nodes: selectedNodes.map((node) => node.id),
        edges: selectedEdges.map((edge) => edge.id),
      },
    }
  }

  function getClipboardBounds(clipboard: NodeWrightClipboard) {
    return options.getBounds(clipboard.nodes)
  }

  function copySelection(): NodeWrightClipboard | null {
    const clipboard = buildClipboardFromSelection()
    clipboardState = clipboard ? cloneValue(clipboard) : null
    return clipboard
  }

  function pasteAt(position?: XYPosition, clipboard = clipboardState): GraphSnapshot | null {
    if (!clipboard?.nodes.length) {
      return null
    }

    const store = options.getStore()
    const bounds = getClipboardBounds(clipboard)
    const offset =
      position && bounds ? { x: position.x - bounds.x, y: position.y - bounds.y } : { x: 48, y: 48 }
    const nodeIdMap = new Map<string, string>()
    const nodes = clipboard.nodes.map((node) => {
      const nextId = store.createId('node')
      nodeIdMap.set(node.id, nextId)

      return {
        ...cloneValue(node),
        id: nextId,
        x: node.x + offset.x,
        y: node.y + offset.y,
      }
    })
    const edges = clipboard.edges.flatMap((edge) => {
      const sourceNodeId = nodeIdMap.get(edge.source.nodeId)
      const targetNodeId = nodeIdMap.get(edge.target.nodeId)

      if (!sourceNodeId || !targetNodeId) {
        return []
      }

      return [
        {
          ...cloneValue(edge),
          id: store.createId('edge'),
          source: { nodeId: sourceNodeId, portId: edge.source.portId },
          target: { nodeId: targetNodeId, portId: edge.target.portId },
        },
      ]
    })
    const groups = clipboard.groups.map((group) => ({
      ...cloneValue(group),
      id: store.createId('group'),
      x: group.x + offset.x,
      y: group.y + offset.y,
      nodeIds: group.nodeIds
        ?.map((nodeId) => nodeIdMap.get(nodeId))
        .filter((nodeId): nodeId is string => Boolean(nodeId)),
    }))
    const nextSnapshot = store.mutate(
      'Paste selection',
      (draft) => {
        draft.nodes = [...draft.nodes, ...nodes]
        draft.edges = [...draft.edges, ...edges]
        draft.groups = [...draft.groups, ...groups]
      },
      { source: 'api.paste' },
    )

    options.setSelection(
      {
        nodes: nodes.map((node) => node.id),
        edges: edges.map((edge) => edge.id),
      },
      'api.paste.select',
    )
    return nextSnapshot
  }

  function duplicateSelection(offset: XYPosition = { x: 48, y: 48 }): GraphSnapshot | null {
    const clipboard = copySelection()
    const bounds = clipboard ? getClipboardBounds(clipboard) : null

    if (!clipboard) {
      return null
    }

    return pasteAt(bounds ? { x: bounds.x + offset.x, y: bounds.y + offset.y } : offset, clipboard)
  }

  return {
    hasContent: () => Boolean(clipboardState?.nodes.length),
    serialize,
    importGraph,
    copySelection,
    pasteAt,
    duplicateSelection,
  }
}
