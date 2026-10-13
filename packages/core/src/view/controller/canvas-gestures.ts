import type { GraphEdge, GraphGroup, XYPosition } from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import { batch, type ReadonlySignal } from '../reactive.js'
import type { PortLayout, ResolvedNodeView } from '../rendering/node-layout.js'
import type {
  NodeEngineCanvasGroupHitAreaKind,
  NodeEngineContextTarget,
  NodeEngineDomNodeResizeHandle,
  NodeEngineEditorHost,
  NodeEngineEventSink,
} from '../types/index.js'
import type { ContextMenuModel } from './context-menu.js'
import type { EdgeCommands } from './edge-commands.js'
import type { GeometryQueries } from './geometry-queries.js'
import type { GroupCommands } from './group-commands.js'
import type { CanvasHitTester } from './hit-test.js'
import { resolveGroupNodeIds } from './groups.js'
import { hasActiveGesture, type InteractionState } from './interaction-state.js'
import type { ConnectionGesture } from './interactions/connection.js'
import type { DragGesture } from './interactions/drag.js'
import type { InteractionFrame } from './interactions/interaction-frame.js'
import type { MarqueeGesture } from './interactions/marquee.js'
import { createPointerSession, type PointerSession } from './interactions/pointer-session.js'
import type { ResizeGesture } from './interactions/resize.js'
import type { PanGesture } from './interactions/viewport-gestures.js'
import type { WheelGesture } from './interactions/wheel.js'
import type { NodeEditorModel } from './node-editor.js'
import type { NodeViews } from './node-views.js'
import type { SelectionModel } from './selection.js'
import type { NodeStackOrder } from './stack-order.js'
import type { ResolvedNodeEngineBehaviors } from './theme.js'

/**
 * Routes canvas and DOM node pointer input to gestures: ports start connections, nodes select
 * and drag, group handles drag/resize/act, edges select or disconnect, the background pans.
 * One pointer session at a time tracks the pressed pointer on the window.
 */
export interface CanvasGestures {
  pointerDown: (event: PointerEvent) => void
  pointerMove: (event: PointerEvent) => void
  pointerLeave: () => void
  contextMenu: (event: MouseEvent) => void
  domNodePointerDown: (nodeId: string, event: PointerEvent) => boolean
  nodeResizePointerDown: (
    nodeId: string,
    event: PointerEvent,
    handle: NodeEngineDomNodeResizeHandle,
  ) => boolean
  startPortConnection: (nodeId: string, portId: string, event: PointerEvent) => boolean
  finishPortConnection: (nodeId: string, portId: string, event: PointerEvent) => boolean
  previewPortConnection: (nodeId: string, portId: string | null) => boolean
  /** Brings a node to the front of the paint order. */
  raiseNode: (nodeId: string) => void
  beginPointerSession: (event: PointerEvent) => void
  /** Cancels the active pointer session; its gesture finishes without committing. */
  cancelSession: () => void
  focus: () => void
  attach: (view: Window) => void
  detach: () => void
}

export function createCanvasGestures(options: {
  host: ReadonlySignal<NodeEngineEditorHost | null>
  state: InteractionState
  getStore: () => GraphStore
  readonly: () => boolean
  behaviors: ReadonlySignal<ResolvedNodeEngineBehaviors>
  getScreenPoint: (event: Pick<MouseEvent, 'clientX' | 'clientY'>) => XYPosition
  screenToGraph: (point: XYPosition) => XYPosition
  hitTester: CanvasHitTester
  nodeViews: NodeViews
  geometry: GeometryQueries
  selection: SelectionModel
  stackOrder: NodeStackOrder
  nodeEditor: NodeEditorModel
  contextMenu: ContextMenuModel
  edges: EdgeCommands
  groups: GroupCommands
  drag: DragGesture
  resize: ResizeGesture
  marquee: MarqueeGesture
  connection: ConnectionGesture
  pan: PanGesture
  wheel: WheelGesture
  frame: InteractionFrame
  emit: NodeEngineEventSink
}): CanvasGestures {
  const { state } = options
  let session: PointerSession | null = null

  function focus(): void {
    options.host.peek()?.root.focus()
  }

  function beginPointerSession(event: PointerEvent): void {
    if (!session) {
      throw new Error('NodeEngine editor gestures require a mounted host.')
    }

    session.start(event)
  }

  function updateHover(screenPoint: XYPosition): void {
    if (!hasActiveGesture(state)) {
      state.hoverTarget.value = options.hitTester.resolveTarget(screenPoint)
    }
  }

  function finishSession(event: PointerEvent, commit: boolean): void {
    const point = options.getScreenPoint(event)

    options.frame.finish(point, commit)
    state.hoverTarget.value = options.hitTester.resolveTarget(point)
  }

  /** Common preparation of a primary interaction: close transient UI and take keyboard focus. */
  function prepare(config: { editor: boolean }): void {
    options.contextMenu.close()
    options.wheel.cancel()

    if (config.editor) {
      options.nodeEditor.close()
    }

    focus()
  }

  function nodePointerDown(node: ResolvedNodeView, event: PointerEvent): void {
    options.contextMenu.close()
    options.wheel.cancel()
    focus()
    options.stackOrder.raise(node.id)

    if (event.button !== 0) {
      return
    }

    if (options.readonly() || node.locked) {
      options.emit('node-click', { node, event })
      return
    }

    if (event.detail >= 2) {
      options.emit('node-double-click', { node, event })

      if (options.nodeEditor.resolve(node)?.activateOn === 'double-click') {
        options.selection.ensureNode(node.id, 'node.editor.select')
        options.nodeEditor.open(node.id)
        options.emit('node-click', { node, event })
        return
      }
    } else {
      const manualId = options.nodeEditor.manualNodeId.peek()

      if (manualId && manualId !== node.id) {
        options.nodeEditor.close()
      }
    }

    if (event.shiftKey) {
      options.nodeEditor.close()
      options.selection.toggleNode(node.id, 'node.toggle')
      options.emit('node-click', { node, event })
      return
    }

    options.selection.ensureNode(node.id, 'node.select')

    const nodeIds = options.selection.selection.peek().nodes
    const selected = new Set(nodeIds)
    const nodes = options
      .getStore()
      .getSnapshot()
      .nodes.filter((item) => selected.has(item.id))

    beginPointerSession(event)
    options.drag.startNodes(options.screenToGraph(options.getScreenPoint(event)), nodeIds, nodes)
    options.emit('node-click', { node, event })
  }

  function groupPointerDown(
    group: GraphGroup,
    event: PointerEvent,
    areaId: string,
    areaKind: NodeEngineCanvasGroupHitAreaKind,
  ): void {
    prepare({ editor: true })

    if (event.button !== 0) {
      return
    }

    options.emit('group-click', { group, event, areaId, areaKind })

    if (areaKind === 'action') {
      if (!options.readonly()) {
        if (areaId === 'close') {
          options.groups.remove(group.id)
        } else if (areaId === 'toggle-collapse') {
          options.groups.toggleCollapsed(group.id)
        }
      }

      return
    }

    if (options.readonly() || areaKind !== 'drag-handle') {
      return
    }

    const graph = options.getStore().getSnapshot()
    const nodeIds = options.behaviors.peek().group.moveNodesOnDrag
      ? resolveGroupNodeIds(graph, group)
      : []

    beginPointerSession(event)
    options.drag.startGroup(
      options.screenToGraph(options.getScreenPoint(event)),
      group,
      nodeIds,
      graph.nodes.filter((node) => nodeIds.includes(node.id)),
    )
  }

  function groupResizePointerDown(group: GraphGroup, event: PointerEvent): void {
    prepare({ editor: true })

    if (event.button !== 0 || options.readonly() || !options.behaviors.peek().group.resizable) {
      return
    }

    event.preventDefault()
    beginPointerSession(event)
    options.resize.startGroup(group, options.screenToGraph(options.getScreenPoint(event)))
  }

  function edgePointerDown(edge: GraphEdge, event: PointerEvent): void {
    prepare({ editor: true })

    if (event.button !== 0) {
      return
    }

    options.selection.set({ nodes: [], edges: [edge.id] }, 'edge.select')
    options.emit('edge-click', { edge, event })
  }

  function portPointerDown(node: ResolvedNodeView, port: PortLayout, event: PointerEvent): void {
    options.contextMenu.close()
    options.wheel.cancel()
    options.nodeEditor.close()
    options.stackOrder.raise(node.id)
    options.connection.start(
      { nodeId: node.id, portId: port.port.id },
      port.port.direction,
      options.screenToGraph(options.getScreenPoint(event)),
      event,
    )
  }

  function backgroundPointerDown(event: PointerEvent, clearSelectionSource: string): void {
    prepare({ editor: true })

    if (event.button !== 0) {
      return
    }

    beginPointerSession(event)
    options.pan.start(options.getScreenPoint(event), clearSelectionSource)
  }

  function openContextMenu(target: NodeEngineContextTarget, event: MouseEvent): void {
    options.contextMenu.open(target, options.getScreenPoint(event))
  }

  function edgeContextMenu(edge: GraphEdge, event: MouseEvent): void {
    prepare({ editor: true })

    const requested = options.behaviors.peek().edge.rightClickAction
    const readonly = options.readonly()
    const action = readonly && requested === 'disconnect' ? 'context-menu' : requested

    options.emit('edge-right-click', {
      edge,
      event,
      action,
      graph: options.getStore().getSnapshot(),
    })

    if (action === 'disconnect') {
      options.edges.disconnect(edge.id, 'edge.right-click.disconnect')
      return
    }

    if (action === 'none') {
      return
    }

    options.selection.set({ nodes: [], edges: [edge.id] }, 'edge.context-menu')

    if (action === 'context-menu' && !readonly) {
      openContextMenu({ kind: 'edge', edge }, event)
    }
  }

  return {
    pointerDown(event) {
      if (options.marquee.shouldStart(event)) {
        event.preventDefault()
        prepare({ editor: true })
        beginPointerSession(event)
        options.marquee.start(options.screenToGraph(options.getScreenPoint(event)), event)
        return
      }

      const target = options.hitTester.resolveTarget(options.getScreenPoint(event))
      state.hoverTarget.value = target

      switch (target.kind) {
        case 'port':
          portPointerDown(target.node, target.port, event)
          return
        case 'node':
          nodePointerDown(target.node, event)
          return
        case 'edge':
          edgePointerDown(target.edge, event)
          return
        case 'group':
          if (target.areaKind === 'resize-handle') {
            groupResizePointerDown(target.group, event)
          } else if (target.areaKind !== 'body') {
            groupPointerDown(target.group, event, target.areaId, target.areaKind)
          } else {
            backgroundPointerDown(event, 'group.body.click-clear-selection')
          }
          return
        case 'canvas':
          backgroundPointerDown(event, 'background.click-clear-selection')
      }
    },
    pointerMove(event) {
      updateHover(options.getScreenPoint(event))
    },
    pointerLeave() {
      if (!hasActiveGesture(state)) {
        state.hoverTarget.value = { kind: 'canvas' }
      }
    },
    contextMenu(event) {
      event.preventDefault()
      const target = options.hitTester.resolveTarget(options.getScreenPoint(event))
      state.hoverTarget.value = target

      switch (target.kind) {
        case 'port':
        case 'node':
          focus()
          options.stackOrder.raise(target.node.id)
          options.selection.ensureNode(target.node.id, 'node.context-menu')
          openContextMenu({ kind: 'node', node: target.node }, event)
          return
        case 'edge':
          edgeContextMenu(target.edge, event)
          return
        case 'group':
          options.nodeEditor.close()
          focus()
          openContextMenu(
            {
              kind: 'group',
              group: target.group,
              areaId: target.areaId,
              areaKind: target.areaKind,
            },
            event,
          )
          return
        case 'canvas':
          options.nodeEditor.close()
          focus()
          openContextMenu({ kind: 'canvas' }, event)
      }
    },
    domNodePointerDown(nodeId, event) {
      const node = options.nodeViews.findNode(nodeId)

      if (!node) {
        return false
      }

      event.stopPropagation()
      nodePointerDown(node, event)
      return true
    },
    nodeResizePointerDown(nodeId, event, handle) {
      prepare({ editor: true })

      if (event.button !== 0) {
        return false
      }

      const node = options.nodeViews.findNode(nodeId)

      if (!node || options.readonly() || node.locked) {
        return false
      }

      event.preventDefault()
      options.stackOrder.raise(node.id)
      options.selection.ensureNode(node.id, 'dom.node.resize.select')
      beginPointerSession(event)
      options.resize.startNode(node, handle, options.screenToGraph(options.getScreenPoint(event)))
      return true
    },
    startPortConnection(nodeId, portId, event) {
      const port = options.getStore().getPort({ nodeId, portId })
      const anchor = options.geometry.portAnchor({ nodeId, portId }, 'graph')

      if (!options.nodeViews.findNode(nodeId) || !port || !anchor) {
        return false
      }

      focus()
      options.stackOrder.raise(nodeId)

      return options.connection.start(
        { nodeId, portId },
        port.direction,
        { x: anchor.x, y: anchor.y },
        event,
      )
    },
    finishPortConnection(nodeId, portId, event) {
      const anchor = options.geometry.portAnchor({ nodeId, portId }, 'graph')

      if (!session?.matches(event) || !anchor) {
        return false
      }

      return options.connection.finish(anchor)
    },
    previewPortConnection(nodeId, portId) {
      if (!state.connection.peek()) {
        return false
      }

      if (!portId) {
        options.connection.previewTarget(null)
        return true
      }

      const anchor = options.geometry.portAnchor({ nodeId, portId }, 'graph')

      if (!anchor || anchor.port.direction !== options.connection.targetDirection()) {
        return false
      }

      return options.connection.previewTarget(anchor)
    },
    raiseNode: options.stackOrder.raise,
    beginPointerSession,
    cancelSession() {
      session?.cancel()
    },
    focus,
    attach(view) {
      session = createPointerSession(view, {
        move: (event) =>
          batch(() => {
            const point = options.getScreenPoint(event)
            updateHover(point)
            options.frame.queue(point)
          }),
        finish: (event) => batch(() => finishSession(event, true)),
        cancel: (event) => batch(() => finishSession(event, false)),
      })
    },
    detach() {
      session?.dispose()
      session = null
    },
  }
}
