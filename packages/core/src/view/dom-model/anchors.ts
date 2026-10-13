import type { XYPosition } from '../../protocol/index.js'
import type {
  NodeEngineBounds,
  NodeEngineResolvedDomNodeField,
  NodeEngineResolvedDomNodeLayout,
  NodeEngineResolvedDomNodeModel,
  PortSide,
} from '../types/index.js'
import { resolveDomNodePortTop } from './layout.js'

/**
 * Graph-space anchor points of the ports a DOM node renders, keyed by port id, so canvas edges
 * attach exactly where the DOM port dots are drawn. Top/bottom ports keep their canvas layout.
 */
export function resolveDomPortAnchorPoints(
  bounds: Pick<NodeEngineBounds, 'x' | 'y' | 'width'>,
  model: NodeEngineResolvedDomNodeModel,
): Map<string, XYPosition> {
  const points = new Map<string, XYPosition>()

  for (const [index, port] of model.inputs.entries()) {
    const point = resolveDomSidePortPoint(bounds, port.side, index, model.layout)

    if (point) {
      points.set(port.port.id, point)
    }
  }

  for (const field of model.fields) {
    if (field.inputPort) {
      points.set(field.inputPort.id, resolveDomFieldInputPortPoint(bounds, field, model.layout))
    }
  }

  for (const [index, port] of model.outputs.entries()) {
    const point = resolveDomSidePortPoint(bounds, port.side, index, model.layout)

    if (point) {
      points.set(port.port.id, point)
    }
  }

  return points
}

function resolveDomSidePortPoint(
  bounds: Pick<NodeEngineBounds, 'x' | 'y' | 'width'>,
  side: PortSide,
  index: number,
  layout: NodeEngineResolvedDomNodeLayout,
): XYPosition | null {
  if (side !== 'left' && side !== 'right') {
    return null
  }

  return {
    x:
      side === 'left'
        ? bounds.x + layout.portInset + 0.5
        : bounds.x + bounds.width - layout.portInset - 0.5,
    y: bounds.y + resolveDomNodePortTop(index, layout) + 1,
  }
}

function resolveDomFieldInputPortPoint(
  bounds: Pick<NodeEngineBounds, 'x' | 'y'>,
  field: NodeEngineResolvedDomNodeField,
  layout: NodeEngineResolvedDomNodeLayout,
): XYPosition {
  return {
    x: bounds.x + layout.portInset,
    y: bounds.y + field.top + field.height / 2,
  }
}
