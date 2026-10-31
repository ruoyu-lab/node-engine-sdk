import { describe, expect, it } from 'vitest'
import type { NodeWrightApi, ViewportState } from '@node-wright/core/view'
import { resolveCanvasInsets } from '../src/app/canvas-insets'
import { fitGraph } from '../src/app/editor-commands'
import { playgroundIcons } from '../src/app/icons'
import { NO_NODE_STATUS, resolveRunNodeStatus } from '../src/app/run-result'
import { resolveInitialShellLayout } from '../src/app/shell-layout'
import { playgroundShortcuts } from '../src/app/shortcuts'
import type { NodeWrightRunResult } from '@node-wright/core/runtime'

const shell = { left: 0, top: 0, right: 1440, bottom: 900 }

describe('playground shell', () => {
  it('charges each floating panel to the side where it costs the least canvas', () => {
    expect(
      resolveCanvasInsets(shell, [
        // Scenario list (top left), toolbar (top centre), run panel (right), hidden element.
        { left: 12, top: 12, right: 248, bottom: 340 },
        { left: 520, top: 12, right: 920, bottom: 56 },
        { left: 1088, top: 12, right: 1428, bottom: 740 },
        { left: 0, top: 0, right: 0, bottom: 0 },
      ]),
    ).toEqual({ top: 80, right: 376, bottom: 48, left: 272 })

    // A collapsed run panel is a short bar, so it only lowers the top edge.
    expect(resolveCanvasInsets(shell, [{ left: 1176, top: 12, right: 1428, bottom: 70 }])).toEqual({
      top: 94,
      right: 48,
      bottom: 48,
      left: 48,
    })

    // A phone drawer at the bottom raises the bottom edge.
    expect(
      resolveCanvasInsets({ left: 0, top: 0, right: 390, bottom: 844 }, [
        { left: 0, top: 784, right: 390, bottom: 844 },
      ]),
    ).toEqual({ top: 48, right: 48, bottom: 84, left: 48 })
  })

  it('keeps a fitted graph readable by zooming in around the start of the graph', () => {
    let viewport: ViewportState = { x: 0, y: 0, zoom: 1 }
    const api = {
      view: {
        fit: { graph: () => (viewport = { x: 48, y: 300, zoom: 0.25 }) },
        get: () => viewport,
        set: (patch: Partial<ViewportState>) => (viewport = { ...viewport, ...patch }),
      },
    } as unknown as NodeWrightApi
    const area = { width: 390, height: 844, insets: { top: 160, right: 48, bottom: 84, left: 48 } }

    fitGraph(api, area)

    // The point at the middle of the free area's left edge (48, 460) keeps its graph position.
    expect(viewport).toEqual({ zoom: 0.5, x: 48, y: 460 - (460 - 300) * 2 })

    api.view.fit.graph = () => (viewport = { x: 20, y: 30, zoom: 0.8 })
    fitGraph(api, area)
    expect(viewport).toEqual({ x: 20, y: 30, zoom: 0.8 })
  })

  it('opens the panels on wide screens only', () => {
    expect(resolveInitialShellLayout({ innerWidth: 1440 })).toEqual({
      navExpanded: true,
      panelOpen: true,
    })
    expect(resolveInitialShellLayout({ innerWidth: 800 })).toEqual({
      navExpanded: false,
      panelOpen: false,
    })
    expect(resolveInitialShellLayout(undefined)).toEqual({ navExpanded: true, panelOpen: true })
  })

  it('maps a run onto the editor node status', () => {
    const result = {
      nodeStates: {
        prompt: { nodeId: 'prompt', status: 'success' },
        seed: { nodeId: 'seed', status: 'idle' },
        image: { nodeId: 'image', status: 'error' },
      },
    } as unknown as NodeWrightRunResult

    expect(resolveRunNodeStatus(null)).toBe(NO_NODE_STATUS)
    expect(resolveRunNodeStatus(result)).toEqual({ prompt: 'success', image: 'error' })
  })

  it('describes the chrome icons and shortcuts as data', () => {
    expect(Object.values(playgroundIcons).every((paths) => paths.length > 0)).toBe(true)
    expect(playgroundIcons.play[0]?.solid).toBe(true)
    expect(playgroundShortcuts.map((shortcut) => shortcut.action)).toContain('撤销')
  })
})
