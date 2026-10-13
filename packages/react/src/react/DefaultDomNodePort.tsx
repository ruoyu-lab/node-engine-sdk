import {
  resolveDomFieldPortDotClass,
  resolveDomPortDotClass,
  resolveDomPortDotStyle,
  resolveDomPortLabelClass,
  type DomNodeControls,
  type NodeEngineResolvedDomNodePort,
} from '@node-engine-sdk/core/view'
import type { ReactElement, RefCallback } from 'react'
import { toClassName } from './class-names.js'
import { useDomEvents } from './use-dom-events.js'

/** Connection gestures of one port element: start, preview while hovered, and finish. */
export function usePortEvents<Target extends HTMLElement>(
  controls: DomNodeControls,
  portId: string,
): RefCallback<Target> {
  return useDomEvents<Target>({
    pointerdown: (event) => controls.portPointerDown(portId, event),
    pointerenter: () => controls.portPointerEnter(portId),
    pointerleave: () => controls.portPointerLeave(),
    pointerup: (event) => controls.portPointerUp(portId, event),
  })
}

export function DefaultDomNodePort(props: {
  port: NodeEngineResolvedDomNodePort
  side: 'left' | 'right'
  controls: DomNodeControls
}): ReactElement {
  const { port, side } = props
  const dotRef = usePortEvents<HTMLSpanElement>(props.controls, port.id)
  const dot = (
    <span
      ref={dotRef}
      className={toClassName(['ne-default-dom-node__port-dot', resolveDomPortDotClass(port)])}
      style={resolveDomPortDotStyle(port)}
    />
  )

  return (
    <div
      className={toClassName([
        'ne-default-dom-node__port',
        {
          'ne-default-dom-node__port--left': side === 'left',
          'ne-default-dom-node__port--right': side === 'right',
        },
      ])}
      style={{ top: `${port.top}px` }}
    >
      {side === 'left' ? dot : null}
      <span
        className={toClassName(['ne-default-dom-node__port-label', resolveDomPortLabelClass(port)])}
      >
        {port.label}
      </span>
      {side === 'right' ? dot : null}
    </div>
  )
}

/** Hit area and dot of a parameter field's input port. */
export function DefaultDomNodeFieldPort(props: {
  port: NodeEngineResolvedDomNodePort
  controls: DomNodeControls
}): ReactElement {
  const hitRef = usePortEvents<HTMLSpanElement>(props.controls, props.port.id)

  return (
    <span ref={hitRef} className="ne-default-dom-node__field-port-hit">
      <span
        className={toClassName([
          'ne-default-dom-node__field-port-dot',
          resolveDomFieldPortDotClass(props.port),
        ])}
        style={resolveDomPortDotStyle(props.port)}
      />
    </span>
  )
}
