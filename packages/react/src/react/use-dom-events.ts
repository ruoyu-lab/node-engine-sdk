import { useCallback, useRef, type RefCallback } from 'react'
import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect.js'

export type DomEventHandlers = {
  [Type in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[Type]) => void
}

/**
 * Binds native listeners to one element and returns its callback ref; the listeners always call
 * the handlers of the latest render. `DomNodeControls` and the DOM node API follow the DOM
 * listener model: `currentTarget` is the element the listener belongs to (the pointer is
 * captured there, keeping e.g. the resize cursor during the gesture) and `stopPropagation()`
 * stops native propagation. React dispatches synthetic events from its root container, which
 * provides neither, so the default DOM node binds its pointer and click events natively.
 * The event types bound to one element must stay the same across renders.
 */
export function useDomEvents<Target extends HTMLElement>(
  handlers: DomEventHandlers,
): RefCallback<Target> {
  const latest = useRef(handlers)
  const detach = useRef<(() => void) | null>(null)

  useIsomorphicLayoutEffect(() => {
    latest.current = handlers
  })

  return useCallback((element: Target | null) => {
    detach.current?.()
    detach.current = element ? listen(element, () => latest.current) : null
  }, [])
}

function listen(element: HTMLElement, read: () => DomEventHandlers): () => void {
  const types = Object.keys(read()) as Array<keyof HTMLElementEventMap>
  const removers = types.map((type) => bind(element, type, read))

  return () => {
    for (const remove of removers) {
      remove()
    }
  }
}

function bind<Type extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  type: Type,
  read: () => DomEventHandlers,
): () => void {
  const listener = (event: HTMLElementEventMap[Type]) => read()[type]?.(event)

  element.addEventListener(type, listener)
  return () => element.removeEventListener(type, listener)
}
