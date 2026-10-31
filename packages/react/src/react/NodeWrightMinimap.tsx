import type { NodeWrightEditorController, NodeWrightMinimapState } from '@node-wright/core/view'
import { useRef, type ReactElement } from 'react'
import { toClassName } from './class-names.js'
import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect.js'

/**
 * The minimap of `snapshot.minimap`. Its elements are attached to the controller in a layout
 * effect, so a StrictMode remount detaches and attaches them again.
 */
export function NodeWrightMinimap(props: {
  controller: NodeWrightEditorController
  state: NodeWrightMinimapState
}): ReactElement {
  const { controller, state } = props
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current

    if (!root || !canvas) {
      throw new Error('NodeWright minimap rendered without its root and canvas elements.')
    }

    return controller.mountMinimap({ root, canvas })
  }, [controller])

  return (
    <div
      ref={rootRef}
      className={toClassName(['nw-minimap', { 'nw-minimap--dragging': state.dragging }])}
      style={state.style}
      role="group"
      aria-label="Minimap"
      tabIndex={0}
    >
      <canvas ref={canvasRef} className="nw-minimap__canvas" aria-hidden="true" />
      {state.viewportStyle ? (
        <div className="nw-minimap__viewport" style={state.viewportStyle} />
      ) : null}
    </div>
  )
}
