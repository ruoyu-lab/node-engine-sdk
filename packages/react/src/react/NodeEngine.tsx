import {
  NODE_ENGINE_DEFAULT_DOM_COMPONENT,
  resolveColorScheme,
  type NodeEngineEditorController,
  type NodeEngineViewSnapshot,
} from '@node-engine-sdk/core/view'
import {
  forwardRef,
  type ForwardRefExoticComponent,
  type ReactElement,
  type RefAttributes,
} from 'react'
import type { NodeEngineDomComponent, NodeEngineHandle, NodeEngineProps } from '../types.js'
import { DefaultDomNode } from './DefaultDomNode.js'
import { NodeEngineMinimap } from './NodeEngineMinimap.js'
import { toClassName } from './class-names.js'
import { NodeEngineApiContext } from './node-engine-context.js'
import { useNodeEngineEditor } from './use-node-engine-editor.js'

const DEFAULT_ARIA_LABEL = 'Node graph editor'
const HIDDEN = { display: 'none' } as const

/**
 * The node graph editor. Renders the controller snapshot, registers DOM node components through
 * `domComponents` and exposes `NodeEngineApi` through its ref. Until the controller exists (the
 * first commit, or while rendering on the server) only the root and its canvases render.
 */
export const NodeEngine: ForwardRefExoticComponent<
  NodeEngineProps & RefAttributes<NodeEngineHandle>
> = forwardRef<NodeEngineHandle, NodeEngineProps>(function NodeEngine(props, ref): ReactElement {
  const { controller, view, rootRef, canvasRef, gridCanvasRef } = useNodeEngineEditor(props, ref)
  const gridVisible = view ? view.gridState.visible : props.gridVisible !== false

  return (
    <div
      ref={rootRef}
      className={toClassName(['ne-root', props.className])}
      data-color-scheme={view ? view.colorScheme : resolveColorScheme(props.theme)}
      style={view ? { ...view.rootStyle, ...props.style } : props.style}
      role="application"
      aria-label={props.ariaLabel ?? DEFAULT_ARIA_LABEL}
      tabIndex={0}
    >
      <canvas
        ref={gridCanvasRef}
        className="ne-grid-surface"
        style={gridVisible ? undefined : HIDDEN}
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className="ne-canvas-surface"
        style={view ? { cursor: view.canvasCursor } : undefined}
        aria-hidden="true"
      />
      {controller && view ? (
        <NodeEngineLayers
          controller={controller}
          view={view}
          domComponents={props.domComponents}
          renderBackground={props.renderBackground}
          renderOverlay={props.renderOverlay}
        />
      ) : null}
    </div>
  )
})

function NodeEngineLayers(
  props: {
    controller: NodeEngineEditorController
    view: NodeEngineViewSnapshot
  } & Pick<NodeEngineProps, 'domComponents' | 'renderBackground' | 'renderOverlay'>,
): ReactElement {
  const { controller, view } = props
  const { api } = controller
  const { domLayer, performance } = view

  function resolveDomComponent(key: string): NodeEngineDomComponent {
    if (key === NODE_ENGINE_DEFAULT_DOM_COMPONENT) {
      return DefaultDomNode
    }

    const component = props.domComponents?.[key]

    if (!component) {
      throw new Error(`NodeEngine has no DOM node component registered as "${key}".`)
    }

    return component
  }

  return (
    <NodeEngineApiContext.Provider value={api}>
      {props.renderBackground?.({
        api,
        graph: view.graph,
        readonly: view.readonly,
        gridState: view.gridState,
        interactionState: view.interaction,
        nodeEditorState: view.nodeEditor,
        toggleGrid: api.view.grid.toggle,
        renderContext: view.renderContext,
      })}

      {domLayer.nodes.length > 0 ? (
        <div
          className={toClassName([
            'ne-dom-node-layer',
            { 'ne-dom-node-layer--composited': domLayer.composited },
          ])}
          style={domLayer.style}
        >
          {domLayer.nodes.map((entry) => {
            const Component = resolveDomComponent(entry.component)

            return (
              <div
                key={entry.id}
                className={toClassName(['ne-dom-node', entry.className])}
                style={entry.style}
              >
                <Component {...entry.props} />
              </div>
            )
          })}
        </div>
      ) : null}

      {view.accessibleNodes.length > 0 ? (
        <ul className="ne-accessible-nodes" aria-label="Canvas nodes">
          {view.accessibleNodes.map((node) => (
            <li key={node.id}>
              <button
                className="ne-accessible-node"
                type="button"
                aria-pressed={node.selected}
                onClick={() => controller.selectAccessibleNode(node.id)}
              >
                {node.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {view.marqueeStyle ? <div className="ne-marquee" style={view.marqueeStyle} /> : null}

      {performance.visible && performance.sample ? (
        <div className="ne-performance">
          {performance.dismissible ? (
            <button
              className="ne-performance__close"
              type="button"
              aria-label="Close performance monitor"
              onClick={() => controller.hidePerformanceOverlay()}
            >
              ×
            </button>
          ) : null}
          <div>
            {performance.sample.renderMode} / {performance.sample.mode}
          </div>
          <div>{performance.sample.fps.toFixed(0)} fps</div>
          <div>frame {performance.sample.frameMs.toFixed(2)} ms</div>
          <div>draw {performance.sample.drawMs.toFixed(2)} ms</div>
          <div>
            nodes {performance.sample.visibleNodes}/{performance.sample.totalNodes}
          </div>
          <div>
            edges {performance.sample.visibleEdges}/{performance.sample.totalEdges}
          </div>
          <div>
            groups {performance.sample.visibleGroups}/{performance.sample.totalGroups}
          </div>
        </div>
      ) : null}

      {view.minimap ? <NodeEngineMinimap controller={controller} state={view.minimap} /> : null}

      {props.renderOverlay?.({
        api,
        graph: view.graph,
        selection: view.selection,
        gridState: view.gridState,
        interactionState: view.interaction,
        nodeEditorState: view.nodeEditor,
        contextMenuState: view.contextMenu,
      })}
    </NodeEngineApiContext.Provider>
  )
}
