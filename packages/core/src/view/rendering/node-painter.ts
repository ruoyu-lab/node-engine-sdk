import type { GraphEndpoint } from '../../protocol/index.js'
import type { NodeWrightCanvasNodeRenderContext } from '../types/index.js'
import { resolveNodeAccent } from '../dom-model/definition.js'
import { adjustColor, CANVAS_FONT_FAMILY, withAlpha } from './color.js'

/** Built-in canvas node painter with zoom-dependent levels of detail. */
const DEFAULT_NODE_RADIUS = 12
const DEFAULT_PORT_RADIUS = 5

const TITLE_FONT = `600 13px ${CANVAS_FONT_FAMILY}`

const META_FONT = `700 9px ${CANVAS_FONT_FAMILY}`

const BODY_FONT = `12px ${CANVAS_FONT_FAMILY}`

const PORT_LABEL_FONT = `500 11px ${CANVAS_FONT_FAMILY}`

const ULTRA_COMPACT_NODE_ZOOM = 0.18

const COMPACT_NODE_ZOOM = 0.32

const FULL_DETAIL_NODE_ZOOM = 0.55

interface DefaultNodeVisuals {
  accent: string
  title: string
  subtitle?: string
  metaText: string
  borderRadius: number
  headerHeight: number
}

/**
 * Paints the built-in node card; detail is reduced as the zoom level drops.
 */
export function drawDefaultCanvasNode(context: NodeWrightCanvasNodeRenderContext): void {
  const { ctx, node, zoom } = context

  const visuals: DefaultNodeVisuals = {
    accent: resolveNodeAccent(node, context.definition) ?? context.theme.border,
    title: readString(node.data?.title) ?? readString(node.meta?.title) ?? node.type,
    subtitle: readString(node.data?.summary),
    metaText: [readString(node.data?.category), readString(node.data?.state)]
      .filter(Boolean)
      .join(' • '),
    borderRadius: DEFAULT_NODE_RADIUS,
    headerHeight: 36,
  }

  ctx.save()

  if (zoom < ULTRA_COMPACT_NODE_ZOOM) {
    drawUltraCompactCanvasNode(context, visuals)
    ctx.restore()
    return
  }

  if (zoom < COMPACT_NODE_ZOOM) {
    drawCompactCanvasNode(context, visuals)
    ctx.restore()
    return
  }

  if (zoom < FULL_DETAIL_NODE_ZOOM) {
    drawReducedCanvasNode(context, visuals)
    ctx.restore()
    return
  }

  const { bounds, selected, dragging, inputs, outputs, theme, connectionSource, connectionTarget } =
    context
  const { accent, title, subtitle, metaText, borderRadius, headerHeight } = visuals

  // --- 1. 绘制多重物理阴影 ---
  ctx.beginPath()
  drawRoundedRectPath(ctx, bounds.x, bounds.y, bounds.width, bounds.height, borderRadius)

  if (dragging) {
    // 拖拽时的环境遮蔽影
    ctx.shadowColor = withAlpha(theme.shadow, 0.25)
    ctx.shadowBlur = 30 / zoom
    ctx.shadowOffsetY = 15 / zoom
  } else {
    // 静止时的柔和阴影
    ctx.shadowColor = withAlpha(theme.shadow, 0.12)
    ctx.shadowBlur = 12 / zoom
    ctx.shadowOffsetY = 4 / zoom
  }

  const bgGrad = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x, bounds.y + bounds.height)
  bgGrad.addColorStop(0, theme.background)
  bgGrad.addColorStop(1, adjustColor(theme.background, -4)) // 底部稍微加深一点点
  ctx.fillStyle = bgGrad
  ctx.fill()

  // 重置阴影
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0

  // --- 2. 绘制内边缘高光 (Inner Gloss) ---
  // 这会让节点看起来有厚度，像一个精美的实体卡片
  ctx.beginPath()
  drawRoundedRectPath(
    ctx,
    bounds.x + 0.5,
    bounds.y + 0.5,
    bounds.width - 1,
    bounds.height - 1,
    borderRadius,
  )
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 1
  ctx.stroke()

  // --- 3. 绘制外部边框 (Border) ---
  ctx.beginPath()
  drawRoundedRectPath(ctx, bounds.x, bounds.y, bounds.width, bounds.height, borderRadius)
  ctx.lineWidth = selected ? 2 : 1
  ctx.strokeStyle = selected ? accent : withAlpha(theme.border, 0.25)
  ctx.stroke()

  // --- 4. Header 区域绘制 ---
  ctx.save()
  // 裁剪出 Header 区域以应用背景
  ctx.beginPath()
  drawRoundedRectPath(ctx, bounds.x, bounds.y, bounds.width, headerHeight, {
    tl: borderRadius,
    tr: borderRadius,
    bl: 0,
    br: 0,
  })
  ctx.clip()

  // Header 背景微渐变 + 磨砂感
  const headerGrad = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x, bounds.y + headerHeight)
  headerGrad.addColorStop(0, withAlpha(accent, 0.12))
  headerGrad.addColorStop(1, withAlpha(accent, 0.04))
  ctx.fillStyle = headerGrad
  ctx.fill()

  // Header 底部装饰线 (0.5px 锐利化处理)
  ctx.beginPath()
  ctx.moveTo(bounds.x, bounds.y + headerHeight - 0.5)
  ctx.lineTo(bounds.x + bounds.width, bounds.y + headerHeight - 0.5)
  ctx.strokeStyle = withAlpha(accent, 0.15)
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()

  // --- 5. 文本渲染 ---
  const px = 16 // Horizontal padding

  // 标题：使用更现代的对齐和字重
  ctx.fillStyle = theme.title
  ctx.font = TITLE_FONT
  ctx.textBaseline = 'middle'
  fillClippedText(ctx, title, bounds.x + px, bounds.y + headerHeight / 2, bounds.width - px * 2)

  // 内容文字：调整行间距和透明度
  if (subtitle) {
    ctx.fillStyle = theme.subtitle
    ctx.font = BODY_FONT
    ctx.textBaseline = 'top'
    fillClippedText(
      ctx,
      subtitle,
      bounds.x + px,
      bounds.y + headerHeight + 12,
      bounds.width - px * 2,
    )
  }

  if (metaText) {
    ctx.fillStyle = withAlpha(theme.meta, 0.4)
    ctx.font = META_FONT
    ctx.textBaseline = 'top'
    const metaY = subtitle ? bounds.y + headerHeight + 32 : bounds.y + headerHeight + 12
    // 字母间距模拟（Canvas 没原生 letter-spacing，通过大写增加专业感）
    fillClippedText(ctx, metaText.toUpperCase(), bounds.x + px, metaY, bounds.width - px * 2)
  }

  // --- 6. 端口绘制 (拟物化细节) ---
  for (const port of [...inputs, ...outputs]) {
    const active =
      endpointEquals(connectionSource, port.endpoint) ||
      endpointEquals(connectionTarget, port.endpoint)
    const connected = (port.connectionCount ?? 0) > 0
    const output = port.port.direction === 'output'
    const radius = resolvePortRadius(port.radius)
    const displayColor = port.connectionColor ?? (output ? accent : undefined)

    // 端口光晕 (Glow)
    if (active) {
      ctx.beginPath()
      ctx.arc(port.x, port.y, radius + 4, 0, Math.PI * 2)
      ctx.fillStyle = withAlpha(theme.portActive, 0.2)
      ctx.fill()
    }

    // 端口主体：使用径向渐变模拟凹凸感
    const portGrad = ctx.createRadialGradient(port.x, port.y - 1, 0, port.x, port.y, radius)
    if (active) {
      portGrad.addColorStop(0, adjustColor(theme.portActiveFill, 20))
      portGrad.addColorStop(1, theme.portActiveFill)
    } else if (displayColor) {
      portGrad.addColorStop(0, adjustColor(displayColor, 20))
      portGrad.addColorStop(1, displayColor)
    } else {
      portGrad.addColorStop(0, theme.portFill)
      portGrad.addColorStop(1, adjustColor(theme.portFill, -10))
    }

    drawPortShapePath(ctx, port.x, port.y, radius, port.port.kind)
    ctx.fillStyle = portGrad
    ctx.strokeStyle = active ? theme.portActive : (displayColor ?? theme.portStroke)
    ctx.lineWidth = 1.2
    ctx.fill()
    ctx.stroke()

    // 连接状态的内白点
    if (connected && !active) {
      ctx.beginPath()
      drawPortShapePath(ctx, port.x, port.y, radius * 0.4, port.port.kind)
      ctx.fillStyle = theme.portConnectedDot
      ctx.fill()
    }

    // 端口标签：稍微减小字体大小，使其更精致
    const label = port.port.label ?? port.port.name ?? port.port.id
    ctx.fillStyle = theme.portLabel
    ctx.font = PORT_LABEL_FONT
    ctx.textBaseline = 'middle'

    const labelSpacing = radius + 8
    const maxLabelW = bounds.width / 2 - labelSpacing - 4

    if (port.side === 'right') {
      ctx.textAlign = 'right'
      fillClippedText(ctx, label, port.x - labelSpacing, port.y, maxLabelW)
    } else if (port.side === 'left') {
      ctx.textAlign = 'left'
      fillClippedText(ctx, label, port.x + labelSpacing, port.y, maxLabelW)
    }
  }

  ctx.restore()
}

function drawUltraCompactCanvasNode(
  context: NodeWrightCanvasNodeRenderContext,
  visuals: DefaultNodeVisuals,
): void {
  const { ctx, bounds, selected, theme, zoom } = context
  const borderWidth = Math.min((selected ? 2 : 1.25) / Math.max(zoom, 0.0001), selected ? 8 : 5)
  const accentHeight = Math.min(Math.max(bounds.height * 0.16, 10), 20)

  ctx.beginPath()
  drawRoundedRectPath(ctx, bounds.x, bounds.y, bounds.width, bounds.height, visuals.borderRadius)
  ctx.fillStyle = theme.background
  ctx.fill()

  ctx.beginPath()
  drawRoundedRectPath(ctx, bounds.x, bounds.y, bounds.width, accentHeight, {
    tl: visuals.borderRadius,
    tr: visuals.borderRadius,
    bl: 0,
    br: 0,
  })
  ctx.fillStyle = withAlpha(visuals.accent, selected ? 0.22 : 0.14)
  ctx.fill()

  ctx.beginPath()
  drawRoundedRectPath(ctx, bounds.x, bounds.y, bounds.width, bounds.height, visuals.borderRadius)
  ctx.lineWidth = borderWidth
  ctx.strokeStyle = selected ? visuals.accent : withAlpha(theme.border, 0.32)
  ctx.stroke()
}

function drawCompactCanvasNode(
  context: NodeWrightCanvasNodeRenderContext,
  visuals: DefaultNodeVisuals,
): void {
  const { ctx, bounds, selected, theme } = context

  ctx.beginPath()
  drawRoundedRectPath(ctx, bounds.x, bounds.y, bounds.width, bounds.height, visuals.borderRadius)
  ctx.fillStyle = theme.background
  ctx.fill()

  ctx.beginPath()
  drawRoundedRectPath(ctx, bounds.x, bounds.y, bounds.width, visuals.headerHeight, {
    tl: visuals.borderRadius,
    tr: visuals.borderRadius,
    bl: 0,
    br: 0,
  })
  ctx.fillStyle = withAlpha(visuals.accent, selected ? 0.18 : 0.1)
  ctx.fill()

  ctx.beginPath()
  drawRoundedRectPath(ctx, bounds.x, bounds.y, bounds.width, bounds.height, visuals.borderRadius)
  ctx.lineWidth = selected ? 1.8 : 1
  ctx.strokeStyle = selected ? visuals.accent : withAlpha(theme.border, 0.24)
  ctx.stroke()

  drawMinimalPorts(context, visuals.accent)
}

function drawReducedCanvasNode(
  context: NodeWrightCanvasNodeRenderContext,
  visuals: DefaultNodeVisuals,
): void {
  const { ctx, bounds, selected, theme, zoom } = context
  const borderWidth =
    zoom < 0.4
      ? Math.min((selected ? 2 : 1.25) / Math.max(zoom, 0.0001), selected ? 6 : 4)
      : selected
        ? 1.8
        : 1

  ctx.beginPath()
  drawRoundedRectPath(ctx, bounds.x, bounds.y, bounds.width, bounds.height, visuals.borderRadius)
  ctx.fillStyle = theme.background
  ctx.fill()

  ctx.beginPath()
  drawRoundedRectPath(ctx, bounds.x, bounds.y, bounds.width, visuals.headerHeight, {
    tl: visuals.borderRadius,
    tr: visuals.borderRadius,
    bl: 0,
    br: 0,
  })
  ctx.fillStyle = withAlpha(visuals.accent, selected ? 0.16 : 0.08)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(bounds.x, bounds.y + visuals.headerHeight - 0.5)
  ctx.lineTo(bounds.x + bounds.width, bounds.y + visuals.headerHeight - 0.5)
  ctx.strokeStyle = withAlpha(visuals.accent, 0.12)
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.beginPath()
  drawRoundedRectPath(ctx, bounds.x, bounds.y, bounds.width, bounds.height, visuals.borderRadius)
  ctx.lineWidth = borderWidth
  ctx.strokeStyle = selected ? visuals.accent : withAlpha(theme.border, 0.24)
  ctx.stroke()

  ctx.fillStyle = theme.title
  ctx.font = TITLE_FONT
  ctx.textBaseline = 'middle'
  fillClippedText(
    ctx,
    visuals.title,
    bounds.x + 16,
    bounds.y + visuals.headerHeight / 2,
    bounds.width - 32,
  )

  drawMinimalPorts(context, visuals.accent)
}

function drawMinimalPorts(context: NodeWrightCanvasNodeRenderContext, accent: string): void {
  const { ctx, inputs, outputs, theme, connectionSource, connectionTarget } = context

  for (const port of [...inputs, ...outputs]) {
    const active =
      endpointEquals(connectionSource, port.endpoint) ||
      endpointEquals(connectionTarget, port.endpoint)
    const connected = (port.connectionCount ?? 0) > 0
    const output = port.port.direction === 'output'
    const radius = resolvePortRadius(port.radius)
    const displayColor = port.connectionColor ?? (output ? accent : undefined)
    const fillColor = active ? theme.portActiveFill : (displayColor ?? theme.portFill)
    const strokeColor = active ? theme.portActive : (displayColor ?? theme.portStroke)

    drawPortShapePath(ctx, port.x, port.y, radius, port.port.kind)
    ctx.fillStyle = fillColor
    ctx.fill()

    if (active || connected) {
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
}

function drawPortShapePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  kind?: string,
): void {
  ctx.beginPath()

  if (kind === 'exec') {
    ctx.moveTo(x, y - radius)
    ctx.lineTo(x + radius, y)
    ctx.lineTo(x, y + radius)
    ctx.lineTo(x - radius, y)
    ctx.closePath()
    return
  }

  ctx.arc(x, y, radius, 0, Math.PI * 2)
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | { tl: number; tr: number; bl: number; br: number },
): void {
  const r = typeof radius === 'number' ? { tl: radius, tr: radius, bl: radius, br: radius } : radius

  ctx.moveTo(x + r.tl, y)
  ctx.lineTo(x + width - r.tr, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r.tr)
  ctx.lineTo(x + width, y + height - r.br)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r.br, y + height)
  ctx.lineTo(x + r.bl, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r.bl)
  ctx.lineTo(x, y + r.tl)
  ctx.quadraticCurveTo(x, y, x + r.tl, y)
  ctx.closePath()
}

function fillClippedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
): void {
  ctx.fillText(trimText(ctx, text, maxWidth), x, y)
}

function trimText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return ''
  }

  if (ctx.measureText(text).width <= maxWidth) {
    return text
  }

  const ellipsis = '...'
  if (ctx.measureText(ellipsis).width > maxWidth) {
    return ''
  }

  let low = 0
  let high = text.length

  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    const candidate = text.slice(0, mid) + ellipsis

    if (ctx.measureText(candidate).width <= maxWidth) {
      low = mid
    } else {
      high = mid - 1
    }
  }

  return text.slice(0, low) + ellipsis
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function endpointEquals(left: GraphEndpoint | undefined, right: GraphEndpoint): boolean {
  return Boolean(left && left.nodeId === right.nodeId && left.portId === right.portId)
}

export function resolvePortRadius(radius?: number): number {
  return radius ?? DEFAULT_PORT_RADIUS
}
