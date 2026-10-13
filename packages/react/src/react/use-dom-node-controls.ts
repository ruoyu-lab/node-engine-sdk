import {
  createDomNodeControls,
  type DomNodeControls,
  type DomNodeControlsSource,
  type DomNodeControlsState,
  type NodeEngineDomNodeProps,
} from '@node-engine-sdk/core/view'
import { useRef, useState, useSyncExternalStore } from 'react'
import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect.js'

/**
 * Creates the default node's interaction controls (a pure state machine until mounted) and
 * subscribes to their state. Mounting is a layout effect, so StrictMode's simulated remount
 * destroys and mounts the same controls again.
 */
export function useDomNodeControls(props: NodeEngineDomNodeProps): {
  controls: DomNodeControls
  state: DomNodeControlsState
} {
  const source = useRef(toControlsSource(props))
  const [controls] = useState(() => createDomNodeControls(() => source.current))

  useIsomorphicLayoutEffect(() => {
    source.current = toControlsSource(props)
  })

  useIsomorphicLayoutEffect(() => {
    controls.mount(window)
    return () => controls.destroy()
  }, [controls])

  const state = useSyncExternalStore(controls.subscribe, controls.getState, controls.getState)

  return { controls, state }
}

function toControlsSource(props: NodeEngineDomNodeProps): DomNodeControlsSource {
  return {
    api: props.domApi,
    model: props.domModel,
    selected: props.selected,
    connectionSource: props.connectionSource,
  }
}
