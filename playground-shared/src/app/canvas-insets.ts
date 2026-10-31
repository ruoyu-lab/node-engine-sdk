import type { NodeWrightInsets } from '@node-wright/core/view'

/** Gap kept between fitted content and the floating panels around it. */
const PANEL_GAP = 24
/** Free space on sides no panel covers. */
const EDGE_PADDING = 48

export interface InsetRect {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Screen space the floating panels take from the canvas. Each panel is charged to the side of the
 * shell where it costs the least canvas area: a tall panel at the right edge narrows the canvas,
 * a short bar at the top lowers it. The result is the `padding` of `api.view.fit.*`.
 */
export function resolveCanvasInsets(
  shell: InsetRect,
  panels: readonly InsetRect[],
): Required<NodeWrightInsets> {
  const width = shell.right - shell.left
  const height = shell.bottom - shell.top
  const insets = {
    top: EDGE_PADDING,
    right: EDGE_PADDING,
    bottom: EDGE_PADDING,
    left: EDGE_PADDING,
  }

  for (const panel of panels) {
    if (panel.right <= panel.left || panel.bottom <= panel.top) {
      continue
    }

    const candidates = [
      { side: 'left' as const, size: panel.right - shell.left, area: height },
      { side: 'right' as const, size: shell.right - panel.left, area: height },
      { side: 'top' as const, size: panel.bottom - shell.top, area: width },
      { side: 'bottom' as const, size: shell.bottom - panel.top, area: width },
    ]
    const cheapest = candidates.reduce((best, candidate) =>
      candidate.size * candidate.area < best.size * best.area ? candidate : best,
    )

    insets[cheapest.side] = Math.max(insets[cheapest.side], cheapest.size + PANEL_GAP)
  }

  return insets
}

/** The canvas size and the insets its floating panels take. */
export interface CanvasArea {
  width: number
  height: number
  insets: Required<NodeWrightInsets>
}

/**
 * Measures the rendered panels marked `data-canvas-inset`. The playground canvas fills the
 * window, so the window is the area the panels are charged against.
 */
export function measureCanvasArea(document: Document): CanvasArea {
  const width = document.defaultView?.innerWidth ?? 0
  const height = document.defaultView?.innerHeight ?? 0

  return {
    width,
    height,
    insets: resolveCanvasInsets(
      { left: 0, top: 0, right: width, bottom: height },
      [...document.querySelectorAll<HTMLElement>('[data-canvas-inset]')].map((panel) =>
        panel.getBoundingClientRect(),
      ),
    ),
  }
}
