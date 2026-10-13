import type { CanvasThemeId } from '@playground/shared/app/canvas-themes'
import type { HistoryAvailability } from '@playground/shared/app/editor-commands'
import { GRAPH_FILE_ACCEPT } from '@playground/shared/app/graph-file'
import { useRef, type ChangeEvent, type ReactElement } from 'react'
import { PlaygroundIcon } from './PlaygroundIcon'

export function EditorToolbar(props: {
  canRun: boolean
  running: boolean
  history: HistoryAvailability
  theme: CanvasThemeId
  onRun: () => void
  onLayout: () => void
  onFit: () => void
  onReset: () => void
  onUndo: () => void
  onRedo: () => void
  onImport: (file: File) => void
  onExport: () => void
  onToggleTheme: () => void
}): ReactElement {
  const importInput = useRef<HTMLInputElement>(null)
  const light = props.theme === 'light'

  function readImportFile(event: ChangeEvent<HTMLInputElement>): void {
    const input = event.currentTarget
    const file = input.files?.[0]

    input.value = ''

    if (file) {
      props.onImport(file)
    }
  }

  return (
    <div className="app-shell__toolbar" role="toolbar" aria-label="画布操作" data-canvas-inset="">
      <button
        type="button"
        className="pg-toolbar-button pg-toolbar-button--primary"
        disabled={!props.canRun || props.running}
        onClick={props.onRun}
      >
        <PlaygroundIcon name="play" />
        <span className="pg-toolbar-button__label">{props.running ? '运行中' : '运行'}</span>
      </button>
      <span className="pg-toolbar-separator" aria-hidden="true" />
      <button
        type="button"
        className="pg-icon-button"
        aria-label="自动布局"
        data-tooltip="自动布局"
        onClick={props.onLayout}
      >
        <PlaygroundIcon name="layout" />
      </button>
      <button
        type="button"
        className="pg-icon-button"
        aria-label="适配"
        data-tooltip="适配画布"
        onClick={props.onFit}
      >
        <PlaygroundIcon name="fit" />
      </button>
      <button
        type="button"
        className="pg-icon-button"
        aria-label="重置"
        data-tooltip="重置场景"
        onClick={props.onReset}
      >
        <PlaygroundIcon name="reset" />
      </button>
      <span className="pg-toolbar-separator" aria-hidden="true" />
      <button
        type="button"
        className="pg-icon-button"
        aria-label="撤销"
        data-tooltip="撤销 · ⌘Z"
        disabled={!props.history.canUndo}
        onClick={props.onUndo}
      >
        <PlaygroundIcon name="undo" />
      </button>
      <button
        type="button"
        className="pg-icon-button"
        aria-label="重做"
        data-tooltip="重做 · ⇧⌘Z"
        disabled={!props.history.canRedo}
        onClick={props.onRedo}
      >
        <PlaygroundIcon name="redo" />
      </button>
      <span className="pg-toolbar-separator" aria-hidden="true" />
      <button
        type="button"
        className="pg-icon-button"
        aria-label="导入"
        data-tooltip="导入 JSON"
        onClick={() => importInput.current?.click()}
      >
        <PlaygroundIcon name="import" />
      </button>
      <button
        type="button"
        className="pg-icon-button"
        aria-label="导出"
        data-tooltip="导出 JSON"
        onClick={props.onExport}
      >
        <PlaygroundIcon name="export" />
      </button>
      <input
        ref={importInput}
        className="app-shell__file-input"
        type="file"
        accept={GRAPH_FILE_ACCEPT}
        aria-label="导入图文件"
        onChange={readImportFile}
      />
      <span className="pg-toolbar-separator" aria-hidden="true" />
      <button
        type="button"
        className="pg-icon-button"
        aria-label="浅色主题"
        aria-pressed={light}
        data-tooltip={light ? '切换到深色主题' : '切换到浅色主题'}
        onClick={props.onToggleTheme}
      >
        <PlaygroundIcon name={light ? 'sun' : 'moon'} />
      </button>
    </div>
  )
}
