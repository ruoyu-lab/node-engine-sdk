import type {
  NodeWrightRuntimeNodeDefinition,
  NodeWrightRuntimeNodeHandler,
} from '@node-wright/core/runtime'
import { SUBGRAPH_CALL_NODE_TYPE } from '@node-wright/core/semantics'
import { readCallTargetId } from '../params.js'

/**
 * Calls the subgraph named by the `subgraphId` parameter. Every data input of the node is a port
 * generated from the subgraph signature, so all input values are passed to the subgraph.
 */
export const subgraphCallRuntimeHandler: NodeWrightRuntimeNodeHandler = async ({
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

export const subgraphRuntimeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
  {
    type: SUBGRAPH_CALL_NODE_TYPE,
    handler: subgraphCallRuntimeHandler,
    cacheable: false,
  },
]
