import {
  NODE_WRIGHT_DEFAULT_DOM_COMPONENT,
  resolveColorScheme,
  type NodeWrightEditorController,
  type NodeWrightViewSnapshot,
} from '@node-wright/core/view'
import {
  forwardRef,
  type ForwardRefExoticComponent,
  type ReactElement,
  type RefAttributes,
} from 'react'
import type { NodeWrightDomComponent, NodeWrightHandle, NodeWrightProps } from '../types.js'
import { DefaultDomNode } from './DefaultDomNode.js'
import { NodeWrightMinimap } from './NodeWrightMinimap.js'
import { toClassName } from './class-names.js'
import { NodeWrightApiContext } from './node-wright-context.js'
import { useNodeWrightEditor } from './use-node-wright-editor.js'

const DEFAULT_ARIA_LABEL = 'Node graph editor'
const HIDDEN = { display: 'none' } as const

/**
 * The node graph editor. Renders the controller snapshot, registers DOM node components through
 * `domComponents` and exposes `NodeWrightApi` through its ref. Until the controller exists (the
 * first commit, or while rendering on the server) only the root and its canvases render.
 */
export const NodeWright: ForwardRefExoticComponent<
  NodeWrightProps & RefAttributes<NodeWrightHandle>
> = forwardRef<NodeWrightHandle, NodeWrightProps>(function NodeWright(props, ref): ReactElement {
  const { controller, view, rootRef, canvasRef, gridCanvasRef } = useNodeWrightEditor(props, ref)
  const gridVisible = view ? view.gridState.visible : props.gridVisible !== false

  return (
    <div
      ref={rootRef}
      className={toClassName(['nw-root', props.className])}
      data-color-scheme={view ? view.colorScheme : resolveColorScheme(props.theme)}
      style={view ? { ...view.rootStyle, ...props.style } : props.style}
      role="application"
      aria-label={props.ariaLabel ?? DEFAULT_ARIA_LABEL}
      tabIndex={0}
    >
      <canvas
        ref={gridCanvasRef}
        className="nw-grid-surface"
        style={gridVisible ? undefined : HIDDEN}
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className="nw-canvas-surface"
        style={view ? { cursor: view.canvasCursor } : undefined}
        aria-hidden="true"
      />
      {controller && view ? (
        <NodeWrightLayers
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

function NodeWrightLayers(
  props: {
    controller: NodeWrightEditorController
    view: NodeWrightViewSnapshot
  } & Pick<NodeWrightProps, 'domComponents' | 'renderBackground' | 'renderOverlay'>,
): ReactElement {
  const { controller, view } = props
  const { api } = controller
  const { domLayer, performance } = view

  function resolveDomComponent(key: string): NodeWrightDomComponent {
    if (key === NODE_WRIGHT_DEFAULT_DOM_COMPONENT) {
      return DefaultDomNode
    }

    const component = props.domComponents?.[key]

    if (!component) {
      throw new Error(`NodeWright has no DOM node component registered as "${key}".`)
    }

    return component
  }

  return (
    <NodeWrightApiContext.Provider value={api}>
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
            'nw-dom-node-layer',
            { 'nw-dom-node-layer--composited': domLayer.composited },
          ])}
          style={domLayer.style}
        >
          {domLayer.nodes.map((entry) => {
            const Component = resolveDomComponent(entry.component)

            return (
              <div
                key={entry.id}
                className={toClassName(['nw-dom-node', entry.className])}
                style={entry.style}
              >
                <Component {...entry.props} />
              </div>
            )
          })}
        </div>
      ) : null}

      {view.accessibleNodes.length > 0 ? (
        <ul className="nw-accessible-nodes" aria-label="Canvas nodes">
          {view.accessibleNodes.map((node) => (
            <li key={node.id}>
              <button
                className="nw-accessible-node"
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

      {view.marqueeStyle ? <div className="nw-marquee" style={view.marqueeStyle} /> : null}

      {performance.visible && performance.sample ? (
        <div className="nw-performance">
          {performance.dismissible ? (
            <button
              className="nw-performance__close"
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

      {view.minimap ? <NodeWrightMinimap controller={controller} state={view.minimap} /> : null}

      {props.renderOverlay?.({
        api,
        graph: view.graph,
        selection: view.selection,
        gridState: view.gridState,
        interactionState: view.interaction,
        nodeEditorState: view.nodeEditor,
        contextMenuState: view.contextMenu,
      })}
    </NodeWrightApiContext.Provider>
  )
}
