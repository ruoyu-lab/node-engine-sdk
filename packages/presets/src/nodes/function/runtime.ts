import type {
  NodeWrightRuntimeNodeDefinition,
  NodeWrightRuntimeNodeHandler,
} from '@node-wright/core/runtime'
import { EXEC_THEN_PORT_ID } from '@node-wright/core/semantics'
import { readCallTargetId } from '../params.js'
import { FUNCTION_CALL_NODE_TYPE } from './definitions.js'

/**
 * Calls the function named by the `functionId` parameter. Every data input of the node is a port
 * generated from the function signature, so all input values are passed to the function.
 */
export const functionCallRuntimeHandler: NodeWrightRuntimeNodeHandler = async ({
  node,
  params,
  values,
  callFunction,
}) => {
  const functionId = readCallTargetId(params, 'functionId', `Function call node "${node.id}"`)
  const result = await callFunction(functionId, values)

  return {
    output: EXEC_THEN_PORT_ID,
    values: result.values ?? {},
    data: result.data,
  }
}

export const functionCallRuntimeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
  {
    type: FUNCTION_CALL_NODE_TYPE,
    handler: functionCallRuntimeHandler,
    cacheable: false,
  },
]
