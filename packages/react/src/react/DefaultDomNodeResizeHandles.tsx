import {
  DOM_NODE_RESIZE_HANDLES,
  type DomNodeControls,
  type DomNodeResizeHandleDescriptor,
} from '@node-wright/core/view'
import type { ReactElement } from 'react'
import { toClassName } from './class-names.js'
import { useDomEvents } from './use-dom-events.js'

export function DefaultDomNodeResizeHandles(props: { controls: DomNodeControls }): ReactElement {
  return (
    <>
      {DOM_NODE_RESIZE_HANDLES.map((item) => (
        <ResizeHandle key={item.handle} item={item} controls={props.controls} />
      ))}
    </>
  )
}

function ResizeHandle(props: {
  item: DomNodeResizeHandleDescriptor
  controls: DomNodeControls
}): ReactElement {
  const { item, controls } = props
  const handleRef = useDomEvents<HTMLDivElement>({
    pointerdown: (event) => controls.resizePointerDown(item.handle, event),
  })

  return (
    <div
      ref={handleRef}
      className={toClassName(['nw-default-dom-node__resize-corner', item.className])}
    />
  )
}
