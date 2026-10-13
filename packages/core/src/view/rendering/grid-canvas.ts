import type { ViewportState } from '../types/index.js'

export interface GraphGridCanvasState {
  visible: boolean
  pixelStep: number
  majorPixelStep: number
  style?: 'line' | 'dash' | 'dot'
}

export interface GraphGridCanvasDrawOptions {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  dpr: number
  viewport: ViewportState
  grid: GraphGridCanvasState
  minorColor: string
  majorColor: string
}

export function drawGridCanvas({
  ctx,
  width,
  height,
  dpr,
  viewport,
  grid,
  minorColor,
  majorColor,
}: GraphGridCanvasDrawOptions): void {
  const deviceWidth = Math.max(Math.round(width * dpr), 1)
  const deviceHeight = Math.max(Math.round(height * dpr), 1)

  if (ctx.canvas.width !== deviceWidth || ctx.canvas.height !== deviceHeight) {
    ctx.canvas.width = deviceWidth
    ctx.canvas.height = deviceHeight
    ctx.canvas.style.width = `${width}px`
    ctx.canvas.style.height = `${height}px`
  }

  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.restore()

  if (!grid.visible || width <= 0 || height <= 0) {
    return
  }

  const minorStep = Math.max(grid.pixelStep, 1)
  const majorStep = Math.max(grid.majorPixelStep, minorStep)
  const style = grid.style ?? 'line'

  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  if (Math.abs(majorStep - minorStep) < 0.001) {
    drawGridPattern(ctx, {
      width,
      height,
      step: majorStep,
      offsetX: viewport.x,
      offsetY: viewport.y,
      color: majorColor,
      style,
      emphasis: 'major',
    })
  } else {
    drawGridPattern(ctx, {
      width,
      height,
      step: minorStep,
      offsetX: viewport.x,
      offsetY: viewport.y,
      color: minorColor,
      style,
      emphasis: 'minor',
    })

    drawGridPattern(ctx, {
      width,
      height,
      step: majorStep,
      offsetX: viewport.x,
      offsetY: viewport.y,
      color: majorColor,
      style,
      emphasis: 'major',
    })
  }

  ctx.restore()
}

function drawGridPattern(
  ctx: CanvasRenderingContext2D,
  options: {
    width: number
    height: number
    step: number
    offsetX: number
    offsetY: number
    color: string
    style: 'line' | 'dash' | 'dot'
    emphasis: 'minor' | 'major'
  },
): void {
  if (!Number.isFinite(options.step) || options.step <= 0) {
    return
  }

  if (options.style === 'dot') {
    drawGridDots(ctx, options)
    return
  }

  const startX = getGridOffset(options.offsetX, options.step)
  const startY = getGridOffset(options.offsetY, options.step)

  ctx.beginPath()

  for (let x = startX; x <= options.width; x += options.step) {
    const aligned = alignToPixel(x)
    ctx.moveTo(aligned, 0)
    ctx.lineTo(aligned, options.height)
  }

  for (let y = startY; y <= options.height; y += options.step) {
    const aligned = alignToPixel(y)
    ctx.moveTo(0, aligned)
    ctx.lineTo(options.width, aligned)
  }

  ctx.strokeStyle = options.color
  ctx.lineWidth = 1
  ctx.setLineDash(options.style === 'dash' ? (options.emphasis === 'major' ? [8, 6] : [4, 8]) : [])
  ctx.stroke()
  ctx.setLineDash([])
}

function drawGridDots(
  ctx: CanvasRenderingContext2D,
  options: {
    width: number
    height: number
    step: number
    offsetX: number
    offsetY: number
    color: string
    emphasis: 'minor' | 'major'
  },
): void {
  const startX = getGridOffset(options.offsetX, options.step)
  const startY = getGridOffset(options.offsetY, options.step)
  const radius = options.emphasis === 'major' ? 1.3 : 0.9

  // One path for every dot: a single fill instead of one per dot.
  ctx.beginPath()

  for (let x = startX; x <= options.width; x += options.step) {
    const alignedX = alignToPixel(x) - 0.5

    for (let y = startY; y <= options.height; y += options.step) {
      const alignedY = alignToPixel(y) - 0.5
      ctx.moveTo(alignedX + radius, alignedY)
      ctx.arc(alignedX, alignedY, radius, 0, Math.PI * 2)
    }
  }

  ctx.fillStyle = options.color
  ctx.fill()
}

function getGridOffset(offset: number, step: number): number {
  const remainder = offset % step
  return remainder > 0 ? remainder - step : remainder
}

function alignToPixel(value: number): number {
  return Math.round(value) + 0.5
}
