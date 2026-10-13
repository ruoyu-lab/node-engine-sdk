import type {
  NodeEngineRuntimeNodeDefinition,
  NodeEngineRuntimeNodeHandler,
} from '@node-engine-sdk/core/runtime'
import { SUBGRAPH_CALL_NODE_TYPE } from '@node-engine-sdk/core/semantics'
import { readCallTargetId } from '../params.js'

/**
 * Calls the subgraph named by the `subgraphId` parameter. Every data input of the node is a port
 * generated from the subgraph signature, so all input values are passed to the subgraph.
 */
export const subgraphCallRuntimeHandler: NodeEngineRuntimeNodeHandler = async ({
  node,
  params,
  values,
  callSubgraph,
}) => {
  const subgraphId = readCallTargetId(params, 'subgraphId', `Subgraph call node "${node.id}"`)
  const result = await callSubgraph(subgraphId, values)

  return {
    values: result.values ?? {},
    data: result.data,
  }
}

export const subgraphRuntimeDefinitions: NodeEngineRuntimeNodeDefinition[] = [
  {
    type: SUBGRAPH_CALL_NODE_TYPE,
    handler: subgraphCallRuntimeHandler,
    cacheable: false,
  },
]
