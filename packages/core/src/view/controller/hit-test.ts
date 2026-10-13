import type {
  ConnectionValidationResult,
  GraphEndpoint,
  GraphPort,
  XYPosition,
} from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import type { ReadonlySignal } from '../reactive.js'
import { isPointNearEdge, type GraphCanvasEdgeEntry } from '../rendering/edge-canvas.js'
import type { VisibleGroupEntry } from '../rendering/entries.js'
import { resolveGroupHitArea } from '../rendering/group-hit-test.js'
import {
  isPointInNodeBounds,
  isPointNearPort,
  type CanvasNodeEntry,
} from '../rendering/node-canvas.js'
import type { PortLayout, ResolvedNodeView } from '../rendering/node-layout.js'
import { resolvePortRadius } from '../rendering/node-painter.js'
import type {
  NodeEngineCanvasGroupHitTestContext,
  NodeEngineCanvasGroupTheme,
  NodeEngineCanvasNodeHitTestContext,
  NodeEngineCanvasNodeTheme,
  NodeEngineRenderContext,
} from '../types/index.js'
import type { CanvasHitTarget, InteractionState } from './interaction-state.js'
import type { ResolvedNodeEngineBehaviors } from './theme.js'

const CONNECTION_SNAP_DISTANCE_PX = 20

/**
 * Canvas hit testing in paint order: ports and nodes (topmost first), then group actions and
 * handles, then edges, and finally group bodies.
 */
export interface CanvasHitTester {
  resolveTarget: (screenPoint: XYPosition) => CanvasHitTarget
  /**
   * Nearest port of the expected direction within the snap distance of the pointer, preferring
   * ports that accept the pending connection.
   */
  findConnectionTarget: (screenPoint: XYPosition) => PortLayout | null
}

export function createCanvasHitTester(options: {
  screenToGraph: (point: XYPosition) => XYPosition
  zoom: () => number
  nodes: ReadonlySignal<CanvasNodeEntry[]>
  groups: ReadonlySignal<VisibleGroupEntry[]>
  edges: ReadonlySignal<GraphCanvasEdgeEntry[]>
  getStore: () => GraphStore
  state: InteractionState
  readonly: () => boolean
  groupBehaviors: ReadonlySignal<ResolvedNodeEngineBehaviors['group']>
  nodeTheme: ReadonlySignal<NodeEngineCanvasNodeTheme>
  groupTheme: ReadonlySignal<NodeEngineCanvasGroupTheme>
  renderContext: ReadonlySignal<NodeEngineRenderContext>
  getCanvasContext: () => CanvasRenderingContext2D
  connectionTargetDirection: () => GraphPort['direction'] | null
  validateConnectionTarget: (
    target: GraphEndpoint,
  ) => { validation: ConnectionValidationResult } | null
}): CanvasHitTester {
  function nodeHitContext(
    entry: CanvasNodeEntry,
    point: XYPosition,
  ): NodeEngineCanvasNodeHitTestContext {
    return {
      ctx: options.getCanvasContext(),
      node: entry.node,
      schema: entry.schema,
      definition: entry.definition,
      bounds: entry.bounds,
      selected: entry.selected,
      dragging: entry.dragging,
      readonly: options.readonly(),
      zoom: options.zoom(),
      inputs: entry.inputs,
      outputs: entry.outputs,
      connectionSource: options.state.connection.peek()?.source,
      connectionTarget: options.state.connectionTarget.peek()?.endpoint,
      theme: options.nodeTheme.value,
      context: options.renderContext.value,
      point,
    }
  }

  function groupHitContext(
    entry: VisibleGroupEntry,
    point: XYPosition,
  ): NodeEngineCanvasGroupHitTestContext {
    return {
      ctx: options.getCanvasContext(),
      point,
      group: entry.group,
      bounds: entry.bounds,
      headerHeight: entry.headerHeight,
      collapsed: entry.collapsed,
      readonly: options.readonly(),
      zoom: options.zoom(),
      borderColor: entry.borderColor,
      backgroundColor: entry.backgroundColor,
      labelColor: entry.labelColor,
      theme: options.groupTheme.value,
      context: options.renderContext.value,
    }
  }

  function resolveTarget(screenPoint: XYPosition): CanvasHitTarget {
    const point = options.screenToGraph(screenPoint)
    const zoom = options.zoom()
    const nodes = options.nodes.value
    let groupBody: CanvasHitTarget | null = null

    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const entry = nodes[index]!
      const node = entry.node as ResolvedNodeView

      for (const port of [...entry.outputs, ...entry.inputs]) {
        if (isPointNearPort(point, port, zoom)) {
          return { kind: 'port', node, port }
        }
      }

      const customHit = entry.definition?.canvas?.hitTestNode

      if (
        (customHit && customHit(nodeHitContext(entry, point))) ||
        isPointInNodeBounds(point, entry.bounds)
      ) {
        return { kind: 'node', node }
      }
    }

    const groups = options.groups.value

    for (let index = groups.length - 1; index >= 0; index -= 1) {
      const entry = groups[index]!
      const area = resolveGroupHitArea(entry, point, {
        collapsed: entry.collapsed,
        dragHandle: options.groupBehaviors.value.dragHandle,
        createHitContext: () => groupHitContext(entry, point),
      })

      if (!area) {
        continue
      }

      const target: CanvasHitTarget = {
        kind: 'group',
        group: entry.group,
        areaId: area.id,
        areaKind: area.kind,
      }

      if (
        area.kind === 'action' ||
        area.kind === 'resize-handle' ||
        (area.kind === 'drag-handle' && area.id !== 'body')
      ) {
        return target
      }

      groupBody ??= target
    }

    const edges = options.edges.value

    for (let index = edges.length - 1; index >= 0; index -= 1) {
      const entry = edges[index]!

      if (isPointNearEdge(point, entry, zoom)) {
        const edge = options.getStore().getEdge(entry.id)

        if (edge) {
          return { kind: 'edge', edge }
        }
      }
    }

    return groupBody ?? { kind: 'canvas' }
  }

  function findConnectionTarget(screenPoint: XYPosition): PortLayout | null {
    const direction = options.connectionTargetDirection()

    if (!direction) {
      return null
    }

    const point = options.screenToGraph(screenPoint)
    const zoom = Math.max(options.zoom(), 0.0001)
    let nearestValid: { port: PortLayout; distance: number } | null = null
    let nearestInvalid: { port: PortLayout; distance: number } | null = null

    for (const entry of options.nodes.value) {
      for (const port of (direction === 'input' ? entry.inputs : entry.outputs) as PortLayout[]) {
        const threshold = resolvePortRadius(port.radius) + CONNECTION_SNAP_DISTANCE_PX / zoom
        const distance = Math.hypot(point.x - port.x, point.y - port.y)

        if (distance > threshold) {
          continue
        }

        if (options.validateConnectionTarget(port.endpoint)?.validation.valid) {
          if (!nearestValid || distance < nearestValid.distance) {
            nearestValid = { port, distance }
          }
        } else if (!nearestInvalid || distance < nearestInvalid.distance) {
          nearestInvalid = { port, distance }
        }
      }
    }

    return nearestValid?.port ?? nearestInvalid?.port ?? null
  }

  return { resolveTarget, findConnectionTarget }
}
