import type { GraphSnapshot } from '@node-engine-sdk/core/protocol'
import type { NodeEngineApi, NodeEngineDomNodeProps } from '@node-engine-sdk/core/view'
import { createApp, defineComponent, h, nextTick, shallowRef } from 'vue'
import {
  contractNodeDefinitions,
  describeAdapterContract,
  type AdapterContractEvent,
  type AdapterContractProps,
  type AdapterDriver,
} from '../../core/test/view/adapter-contract'
import { NodeEngine } from '../src/index'

const ContractNode = defineComponent({
  props: { node: { type: Object, required: true } },
  setup: (props) => () =>
    h('span', { class: 'contract-node' }, (props.node as NodeEngineDomNodeProps['node']).id),
})

async function rendered(): Promise<void> {
  await nextTick()
  await nextTick()
}

const vueDriver: AdapterDriver = {
  async mount(initial) {
    const props = shallowRef<AdapterContractProps>(initial)
    const api = shallowRef<NodeEngineApi | null>(null)
    const events = new Map<AdapterContractEvent, unknown[][]>()
    const record =
      (name: AdapterContractEvent) =>
      (...args: unknown[]) => {
        events.set(name, [...(events.get(name) ?? []), args])
      }
    const Host = defineComponent({
      setup: () => () =>
        h(NodeEngine, {
          ref: api,
          ...props.value,
          nodeDefinitions: contractNodeDefinitions,
          domComponents: { 'contract-node': ContractNode },
          'onUpdate:graph': (graph: GraphSnapshot) => {
            props.value = { ...props.value, graph }
            record('graph-change')(graph)
          },
          onSelectionChange: record('selection-change'),
          onConnect: record('connect'),
          onMount: record('mount'),
        }),
    })
    const host = document.createElement('div')
    const app = createApp(Host)

    document.body.append(host)

    try {
      app.mount(host)
    } catch (error) {
      host.remove()
      throw error
    }

    return {
      host,
      api: () => {
        if (!api.value) {
          throw new Error('The Vue NodeEngine ref is empty.')
        }

        return api.value
      },
      graph: () => props.value.graph,
      events: (name) => events.get(name) ?? [],
      async update(patch) {
        props.value = { ...props.value, ...patch }
        await rendered()
      },
      async act(interaction) {
        interaction()
        await rendered()
      },
      async unmount() {
        app.unmount()
        host.remove()
      },
    }
  },
}

describeAdapterContract('Vue', vueDriver)
