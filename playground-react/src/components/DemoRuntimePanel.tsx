import type { GraphNode, GraphSnapshot, NodeDefinition } from '@node-engine-sdk/core/protocol'
import type { NodeEngineRunResult } from '@node-engine-sdk/core/runtime'
import type { DemoRuntimeLogEntry } from '@playground/shared/demo/runtime'
import {
  countRunOutputs,
  formatRunStatus,
  formatRuntimeEventType,
  formatRuntimeVariables,
  listNodeParams,
  listRunOutputs,
  listTraceRows,
} from '@playground/shared/demo/runtime-labels'
import type { DemoScenario } from '@playground/shared/demo/scenarios'
import type { CSSProperties, ReactElement } from 'react'
import { PlaygroundIcon } from './PlaygroundIcon'

export function DemoRuntimePanel(props: {
  scenario: DemoScenario
  graph: GraphSnapshot
  selectedNode: GraphNode | null
  selectedDefinition: NodeDefinition | null
  result: NodeEngineRunResult | null
  events: DemoRuntimeLogEntry[]
  error: string | null
  running: boolean
  canRun: boolean
  open: boolean
  onToggle: () => void
}): ReactElement {
  const { scenario, graph, selectedNode, selectedDefinition, result, events, open } = props
  const status = props.running ? 'running' : (result?.status ?? 'idle')
  const selectedParams = listNodeParams(selectedNode?.data?.params)
  const outputs = listRunOutputs(scenario, result)
  const traceRows = listTraceRows(result)

  // Text is built into single text nodes, as the Vue panel renders it, so both apps shape alike.
  return (
    <aside
      className={`app-shell__panel runtime-panel${open ? '' : ' runtime-panel--collapsed'}`}
      aria-label="运行面板"
      data-canvas-inset=""
    >
      <header className="runtime-panel__header">
        <span
          className="runtime-panel__marker"
          style={{ '--scenario-accent': scenario.accent } as CSSProperties}
          aria-hidden="true"
        />
        <div className="runtime-panel__heading">
          <span className="runtime-panel__eyebrow">{scenario.eyebrow}</span>
          <h2>{scenario.title}</h2>
        </div>
        <span className={`runtime-panel__status runtime-panel__status--${status}`}>
          {formatRunStatus(status)}
        </span>
        <button
          type="button"
          className="pg-icon-button runtime-panel__toggle"
          aria-expanded={open}
          aria-controls="runtime-panel-body"
          aria-label={open ? '收起运行面板' : '展开运行面板'}
          onClick={props.onToggle}
        >
          <PlaygroundIcon name="chevronDown" />
        </button>
      </header>

      <div id="runtime-panel-body" className="runtime-panel__body">
        <p className="runtime-panel__summary">{scenario.summary}</p>

        <section className="runtime-panel__stats" aria-label="图统计">
          <span>{`${graph.nodes.length} 个节点`}</span>
          <span>{`${graph.edges.length} 条连线`}</span>
          <span>{`${graph.groups.length} 个分组`}</span>
        </section>

        {props.error ? (
          <section className="runtime-panel__message runtime-panel__message--error">
            {props.error}
          </section>
        ) : !props.canRun ? (
          <section className="runtime-panel__message">
            当前场景只演示编辑器，不需要运行时入口。
          </section>
        ) : null}

        <section className="runtime-panel__section">
          <div className="runtime-panel__section-header">
            <span className="runtime-panel__eyebrow">运行结果</span>
            <strong>{countRunOutputs(scenario, result)}</strong>
          </div>

          <ol className="runtime-panel__outputs">
            {outputs.map((output) => (
              <li key={output.key}>
                <strong>{output.label}</strong>
                <span>{output.value}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="runtime-panel__section">
          <div className="runtime-panel__section-header">
            <span className="runtime-panel__eyebrow">执行轨迹</span>
            <strong>{traceRows.length}</strong>
          </div>

          {traceRows.length > 0 ? (
            <ol className="runtime-panel__trace">
              {traceRows.map((row) => (
                <li key={row.key} className={`runtime-panel__trace-step--${row.status}`}>
                  <strong>{row.title}</strong>
                  <span>{row.detail}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="runtime-panel__empty">运行后按执行顺序列出每一步。</p>
          )}
        </section>

        <section className="runtime-panel__section">
          <div className="runtime-panel__section-header">
            <span className="runtime-panel__eyebrow">事件</span>
            <strong>{events.length}</strong>
          </div>

          {events.length > 0 ? (
            <ol className="runtime-panel__events">
              {events.slice(0, 8).map((event) => (
                <li key={event.id}>
                  <strong>{formatRuntimeEventType(event.type)}</strong>
                  <span>{event.detail}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="runtime-panel__empty">运行时事件会显示在这里。</p>
          )}
        </section>

        <section className="runtime-panel__section">
          <div className="runtime-panel__section-header">
            <span className="runtime-panel__eyebrow">选中项</span>
            <strong>{selectedNode?.id ?? '未选择'}</strong>
          </div>

          {selectedNode ? (
            <>
              <dl className="runtime-panel__definition">
                <dt>类型</dt>
                <dd>{selectedNode.type}</dd>
                <dt>标签</dt>
                <dd>{selectedDefinition?.label ?? '-'}</dd>
              </dl>

              {selectedParams.length > 0 ? (
                <div className="runtime-panel__params">
                  {selectedParams.map(([key, value]) => (
                    <span key={key}>{`${key}: ${value}`}</span>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        <section className="runtime-panel__section">
          <div className="runtime-panel__section-header">
            <span className="runtime-panel__eyebrow">运行时</span>
            <strong>{formatRunStatus(result?.status)}</strong>
          </div>

          <pre className="runtime-panel__variables">
            {formatRuntimeVariables(result?.variables ?? {})}
          </pre>
        </section>
      </div>
    </aside>
  )
}
