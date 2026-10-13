import { formatZoom } from '@playground/shared/app/editor-commands'
import type { ReactElement } from 'react'
import { PlaygroundIcon } from './PlaygroundIcon'

export function ZoomControls(props: {
  zoom: number
  onZoomOut: () => void
  onZoomIn: () => void
}): ReactElement {
  return (
    <div className="app-shell__zoom-controls" role="group" aria-label="缩放">
      <button
        type="button"
        className="pg-icon-button"
        aria-label="缩小"
        data-tooltip="缩小"
        data-tooltip-side="top"
        onClick={props.onZoomOut}
      >
        <PlaygroundIcon name="minus" />
      </button>
      <output className="app-shell__zoom" aria-label="缩放比例">
        {formatZoom(props.zoom)}
      </output>
      <button
        type="button"
        className="pg-icon-button"
        aria-label="放大"
        data-tooltip="放大"
        data-tooltip-side="top"
        onClick={props.onZoomIn}
      >
        <PlaygroundIcon name="plus" />
      </button>
    </div>
  )
}
