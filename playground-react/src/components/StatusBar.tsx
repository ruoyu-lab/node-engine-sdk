import { playgroundShortcuts } from '@playground/shared/app/shortcuts'
import type { ReactElement } from 'react'
import { PlaygroundIcon } from './PlaygroundIcon'

export function StatusBar(props: {
  shortcutsOpen: boolean
  performanceOverlay: boolean
  onToggleShortcuts: () => void
  onTogglePerformance: () => void
}): ReactElement {
  return (
    <div className="app-shell__status">
      <div
        id="shortcut-hints"
        className="shortcut-hints"
        hidden={!props.shortcutsOpen}
        aria-label="快捷键"
      >
        <div className="shortcut-hints__header">
          <strong>快捷键与手势</strong>
          <button
            type="button"
            className="pg-icon-button pg-icon-button--small"
            aria-label="关闭快捷键"
            onClick={props.onToggleShortcuts}
          >
            <PlaygroundIcon name="close" />
          </button>
        </div>
        <dl className="shortcut-hints__list">
          {playgroundShortcuts.map((shortcut) => (
            <div key={shortcut.action + shortcut.keys.join('+')} className="shortcut-hints__row">
              <dt>
                {shortcut.keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </dt>
              <dd>{shortcut.action}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="app-shell__status-actions">
        <button
          type="button"
          className="pg-chip-button"
          aria-expanded={props.shortcutsOpen}
          aria-controls="shortcut-hints"
          onClick={props.onToggleShortcuts}
        >
          <PlaygroundIcon name="keyboard" />
          <span>快捷键</span>
        </button>
        <button
          type="button"
          className="pg-chip-button"
          aria-pressed={props.performanceOverlay}
          onClick={props.onTogglePerformance}
        >
          <PlaygroundIcon name="activity" />
          <span>性能</span>
        </button>
      </div>
    </div>
  )
}
