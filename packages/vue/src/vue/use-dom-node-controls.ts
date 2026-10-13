import {
  createDomNodeControls,
  type DomNodeControls,
  type DomNodeControlsState,
  type NodeEngineDomNodeProps,
} from '@node-engine-sdk/core/view'
import { onBeforeUnmount, onMounted, shallowRef, type ShallowRef } from 'vue'

/** Creates the default node's interaction controls and mirrors their state into a shallow ref. */
export function useDomNodeControls(props: NodeEngineDomNodeProps): {
  controls: DomNodeControls
  state: ShallowRef<DomNodeControlsState>
} {
  const controls = createDomNodeControls(() => ({
    api: props.domApi,
    model: props.domModel,
    selected: props.selected,
    connectionSource: props.connectionSource,
  }))
  const state = shallowRef(controls.getState())

  controls.subscribe(() => {
    state.value = controls.getState()
  })

  onMounted(() => controls.mount(window))
  onBeforeUnmount(() => controls.destroy())

  return { controls, state }
}
