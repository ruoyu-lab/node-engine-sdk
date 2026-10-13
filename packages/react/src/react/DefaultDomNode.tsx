import type { GraphEndpoint } from '@node-engine-sdk/core/protocol'
import {
  endpointMatches,
  resolveDomNodeAccentStyle,
  resolveDomNodeClass,
  resolveDomNodeHeaderStyle,
  resolveDomNodeStatusClass,
  type NodeEngineDomNodeProps,
} from '@node-engine-sdk/core/view'
import { memo, type ReactElement } from 'react'
import { DefaultDomNodeFields } from './DefaultDomNodeFields.js'
import { DefaultDomNodePort } from './DefaultDomNodePort.js'
import { DefaultDomNodeResizeHandles } from './DefaultDomNodeResizeHandles.js'
import { toClassName } from './class-names.js'
import { useDomEvents } from './use-dom-events.js'
import { useDomNodeControls } from './use-dom-node-controls.js'

function DefaultDomNodeView(props: NodeEngineDomNodeProps): ReactElement {
  const { domModel } = props
  const { controls, state } = useDomNodeControls(props)
  const articleRef = useDomEvents<HTMLElement>({ pointerdown: controls.nodePointerDown })
  const statusClass = resolveDomNodeStatusClass(props.status)

  return (
    <article
      ref={articleRef}
      className={toClassName(['ne-default-dom-node', resolveDomNodeClass(props)])}
      style={resolveDomNodeAccentStyle(domModel)}
    >
      <header className="ne-default-dom-node__header" style={resolveDomNodeHeaderStyle(domModel)}>
        <span className="ne-default-dom-node__accent" aria-hidden="true" />
        <div className="ne-default-dom-node__title-container">
          <strong className="ne-default-dom-node__title">{domModel.title}</strong>
          {domModel.subtitle ? (
            <span className="ne-default-dom-node__subtitle">{domModel.subtitle}</span>
          ) : null}
        </div>
        {statusClass ? <span className={toClassName([statusClass])} aria-hidden="true" /> : null}
      </header>

      <div className="ne-default-dom-node__ports">
        {domModel.inputs.map((port) => (
          <DefaultDomNodePort key={port.key} port={port} side="left" controls={controls} />
        ))}
        {domModel.outputs.map((port) => (
          <DefaultDomNodePort key={port.key} port={port} side="right" controls={controls} />
        ))}
      </div>

      {domModel.fields.length > 0 ? (
        <DefaultDomNodeFields domModel={domModel} controls={controls} state={state} />
      ) : null}

      <DefaultDomNodeResizeHandles controls={controls} />
    </article>
  )
}

/**
 * Compares only the props the default node renders or hands to its controls. The render
 * context, screen bounds, zoom, theme and anchors are rebuilt for every viewport frame, while the
 * DOM model and node API keep their identity until the node itself changes.
 */
function areDefaultDomNodePropsEqual(
  previous: NodeEngineDomNodeProps,
  next: NodeEngineDomNodeProps,
): boolean {
  return (
    previous.domModel === next.domModel &&
    previous.domApi === next.domApi &&
    previous.selected === next.selected &&
    previous.dragging === next.dragging &&
    previous.status === next.status &&
    sameEndpoint(previous.connectionSource, next.connectionSource)
  )
}

function sameEndpoint(left?: GraphEndpoint, right?: GraphEndpoint): boolean {
  return left === right || endpointMatches(left, right)
}

/** The built-in DOM node: header, ports, parameter fields and resize handles. */
export const DefaultDomNode = memo(DefaultDomNodeView, areDefaultDomNodePropsEqual)
