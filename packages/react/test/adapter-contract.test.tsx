import type { NodeEngineDomNodeProps } from '@node-engine-sdk/core/view'
import { createRef, useState, type ReactElement } from 'react'
import {
  contractNodeDefinitions,
  describeAdapterContract,
  type AdapterContractEvent,
  type AdapterContractProps,
  type AdapterDriver,
} from '../../core/test/view/adapter-contract'
import { NodeEngine, type NodeEngineHandle } from '../src/index'
import { render } from './harness'

function ContractNode(props: NodeEngineDomNodeProps): ReactElement {
  return <span className="contract-node">{props.node.id}</span>
}

const domComponents = { 'contract-node': ContractNode }

const reactDriver: AdapterDriver = {
  async mount(initial) {
    const editor = createRef<NodeEngineHandle>()
    const events = new Map<AdapterContractEvent, unknown[][]>()
    const record = (name: AdapterContractEvent, args: unknown[]) => {
      events.set(name, [...(events.get(name) ?? []), args])
    }
    let current = initial
    let setHostProps: (props: AdapterContractProps) => void = () => undefined

    function Host(): ReactElement {
      const [props, setProps] = useState(initial)

      current = props
      setHostProps = setProps

      return (
        <NodeEngine
          ref={editor}
          {...props}
          nodeDefinitions={contractNodeDefinitions}
          domComponents={domComponents}
          onGraphChange={(graph) => {
            setProps((previous) => ({ ...previous, graph }))
            record('graph-change', [graph])
          }}
          onSelectionChange={(...args) => record('selection-change', args)}
          onConnect={(...args) => record('connect', args)}
          onMount={(...args) => record('mount', args)}
        />
      )
    }

    const rendered = await render(<Host />)

    return {
      host: rendered.host,
      api: () => {
        if (!editor.current) {
          throw new Error('The React NodeEngine ref is empty.')
        }

        return editor.current
      },
      graph: () => current.graph,
      events: (name) => events.get(name) ?? [],
      update: (patch) => rendered.act(() => setHostProps({ ...current, ...patch })),
      act: rendered.act,
      unmount: rendered.unmount,
    }
  },
}

describeAdapterContract('React', reactDriver)
