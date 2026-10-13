import { batch, computed, effect, signal, type ReadonlySignal, type Signal } from '../reactive.js'
import { createPerformanceSample, type PerformanceSampleInput } from '../rendering/performance.js'
import type {
  NodeEngineEditorHost,
  NodeEngineEventSink,
  NodeEnginePerformanceSample,
} from '../types/index.js'
import { paintCanvas, paintGrid, type CanvasFrame, type GridFrame } from './canvas-layers.js'
import type { FrameScheduler } from './frame-scheduler.js'
import type { ResolvedNodeEnginePerformanceOptions } from './theme.js'
import type { RenderSurface } from './visibility.js'

const MAX_FRAME_GAP_MS = 250
const REFRESH_INTERVAL_MS = 150

interface MountedRenderer {
  host: NodeEngineEditorHost
  scheduler: FrameScheduler
  gridFrame: number | null
  canvasFrame: number | null
  /** Inputs of the last paint; a frame is only scheduled when the inputs changed since. */
  lastGrid: GridFrame | null
  lastCanvas: CanvasFrame | null
}

export type PerformanceMetrics = Omit<
  PerformanceSampleInput,
  'frameMs' | 'avgFrameMs' | 'drawMs' | 'avgDrawMs'
>

/**
 * Paints the grid and graph canvases at most once per animation frame, and only when the inputs
 * of a paint changed since the last one. Also observes the host size and samples frame timing
 * for the performance overlay.
 */
export interface RenderScheduler {
  readonly performanceSample: ReadonlySignal<NodeEnginePerformanceSample | null>
  readonly overlayVisible: ReadonlySignal<boolean>
  /** Paints both canvases immediately (used inside gesture animation frames). */
  drawNow: (timestamp: number) => void
  hideOverlay: () => void
  mount: (host: NodeEngineEditorHost, scheduler: FrameScheduler) => () => void
}

export function createRenderScheduler(options: {
  surface: Signal<RenderSurface>
  performanceOptions: ReadonlySignal<ResolvedNodeEnginePerformanceOptions>
  gridFrame: ReadonlySignal<GridFrame>
  canvasFrame: ReadonlySignal<CanvasFrame>
  getMetrics: () => PerformanceMetrics
  emit: NodeEngineEventSink
}): RenderScheduler {
  const performanceSample = signal<NodeEnginePerformanceSample | null>(null)
  const overlayDismissed = signal(false)
  const overlayEnabled = computed(() => {
    const performance = options.performanceOptions.value

    return (
      performance.overlay &&
      !overlayDismissed.value &&
      options.surface.value.width >= performance.overlayMinWidth
    )
  })
  const sampling = computed(() => options.performanceOptions.value.enabled || overlayEnabled.value)
  let mounted: MountedRenderer | null = null
  let frameIntervals: number[] = []
  let drawDurations: number[] = []
  let lastFrameTimestamp: number | null = null
  let lastFrameMs = 0
  let lastDrawMs = 0

  function drawGrid(): void {
    if (!mounted) {
      return
    }

    const frame = options.gridFrame.peek()
    const ctx = mounted.host.gridCanvas.getContext('2d')
    mounted.lastGrid = frame

    if (ctx) {
      paintGrid(ctx, frame)
    }
  }

  function drawCanvas(timestamp: number): void {
    if (!mounted) {
      return
    }

    const frame = options.canvasFrame.peek()
    const ctx = mounted.host.canvas.getContext('2d')
    mounted.lastCanvas = frame

    if (!ctx) {
      return
    }

    const start = mounted.scheduler.now()
    paintCanvas(ctx, frame)
    recordFrame(mounted.scheduler.now() - start, timestamp)
  }

  function cancelFrames(): void {
    if (!mounted) {
      return
    }

    if (mounted.gridFrame !== null) {
      mounted.scheduler.cancelFrame(mounted.gridFrame)
      mounted.gridFrame = null
    }

    if (mounted.canvasFrame !== null) {
      mounted.scheduler.cancelFrame(mounted.canvasFrame)
      mounted.canvasFrame = null
    }
  }

  function recordFrame(drawMs: number, timestamp: number): void {
    const rawFrameMs = lastFrameTimestamp === null ? 0 : Math.max(timestamp - lastFrameTimestamp, 0)
    lastFrameTimestamp = timestamp

    if (!sampling.peek()) {
      return
    }

    const sampleWindow = options.performanceOptions.peek().sampleWindow
    const nextFrames = trimSamples(frameIntervals, sampleWindow)
    const nextDraws = trimSamples(drawDurations, sampleWindow)

    if (rawFrameMs > MAX_FRAME_GAP_MS) {
      nextFrames.length = 0
      nextDraws.length = 0
    }

    const frameMs = rawFrameMs > 0 && rawFrameMs <= MAX_FRAME_GAP_MS ? rawFrameMs : 0

    if (frameMs > 0) {
      nextFrames.push(frameMs)
    }

    nextDraws.push(drawMs)
    frameIntervals = nextFrames
    drawDurations = nextDraws
    lastFrameMs = frameMs
    lastDrawMs = drawMs
  }

  function resetSampling(): void {
    frameIntervals = []
    drawDurations = []
    lastFrameTimestamp = null
    lastFrameMs = 0
    lastDrawMs = 0
  }

  function publishSample(scheduler: FrameScheduler): void {
    if (!sampling.peek()) {
      return
    }

    const recent =
      lastFrameTimestamp !== null && scheduler.now() - lastFrameTimestamp <= MAX_FRAME_GAP_MS

    if (!recent) {
      resetSampling()
    }

    const sample = createPerformanceSample({
      ...options.getMetrics(),
      frameMs: recent ? lastFrameMs : 0,
      avgFrameMs: average(frameIntervals),
      drawMs: recent ? lastDrawMs : 0,
      avgDrawMs: average(drawDurations),
    })

    performanceSample.value = sample
    options.emit('performance-sample', sample)
  }

  return {
    performanceSample,
    overlayVisible: computed(() => overlayEnabled.value && performanceSample.value !== null),
    drawNow(timestamp) {
      cancelFrames()
      drawGrid()
      drawCanvas(timestamp)
    },
    hideOverlay() {
      if (options.performanceOptions.peek().overlayDismissible) {
        overlayDismissed.value = true
      }
    },
    mount(host, scheduler) {
      const state: MountedRenderer = {
        host,
        scheduler,
        gridFrame: null,
        canvasFrame: null,
        lastGrid: null,
        lastCanvas: null,
      }
      const view = host.root.ownerDocument.defaultView
      const updateSurface = () => {
        options.surface.value = {
          width: host.root.clientWidth,
          height: host.root.clientHeight,
          dpr: view?.devicePixelRatio || 1,
        }
      }
      const observer = new ResizeObserver(() => batch(updateSurface))
      let refreshInterval: number | null = null

      mounted = state
      updateSurface()
      observer.observe(host.root)

      const stopGrid = effect(() => {
        if (options.gridFrame.value !== state.lastGrid && state.gridFrame === null) {
          state.gridFrame = scheduler.requestFrame(() => {
            state.gridFrame = null
            drawGrid()
          })
        }
      })
      const stopCanvas = effect(() => {
        if (options.canvasFrame.value !== state.lastCanvas && state.canvasFrame === null) {
          state.canvasFrame = scheduler.requestFrame((timestamp) => {
            state.canvasFrame = null
            drawCanvas(timestamp)
          })
        }
      })
      const stopSampling = effect(() => {
        if (sampling.value) {
          refreshInterval ??= scheduler.setInterval(
            () => publishSample(scheduler),
            REFRESH_INTERVAL_MS,
          )
          publishSample(scheduler)
          return
        }

        if (refreshInterval !== null) {
          scheduler.clearInterval(refreshInterval)
          refreshInterval = null
        }

        resetSampling()
        performanceSample.value = null
      })
      let overlayOptions: unknown[] | null = null
      const stopOverlayReset = effect(() => {
        const performance = options.performanceOptions.value
        const next = [
          performance.overlay,
          performance.overlayMinWidth,
          performance.overlayDismissible,
        ]

        if (overlayOptions && next.some((value, index) => value !== overlayOptions?.[index])) {
          overlayDismissed.value = false
        }

        overlayOptions = next
      })

      return () => {
        stopGrid()
        stopCanvas()
        stopSampling()
        stopOverlayReset()
        observer.disconnect()
        cancelFrames()

        if (refreshInterval !== null) {
          scheduler.clearInterval(refreshInterval)
        }

        resetSampling()
        performanceSample.value = null
        options.surface.value = { width: 0, height: 0, dpr: view?.devicePixelRatio || 1 }
        mounted = null
      }
    },
  }
}

function trimSamples(samples: number[], sampleWindow: number): number[] {
  return samples.length >= sampleWindow ? samples.slice(1) : samples.slice()
}

function average(samples: number[]): number {
  return samples.length ? samples.reduce((total, value) => total + value, 0) / samples.length : 0
}
