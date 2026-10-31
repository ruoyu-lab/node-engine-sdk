import type {
  NodeWrightRuntimeNodeDefinition,
  NodeWrightRuntimeNodeHandler,
} from '@node-wright/core/runtime'
import {
  DATA_MERGE_NODE_TYPE,
  DATA_PREVIEW_NODE_TYPE,
  DATA_SOURCE_NODE_TYPE,
  DATA_TRANSFORM_NODE_TYPE,
} from './definitions.js'

export const dataflowRuntimeHandlers: Record<string, NodeWrightRuntimeNodeHandler> = {
  [DATA_SOURCE_NODE_TYPE]: ({ params }) => ({
    values: {
      value: params.value,
    },
  }),
  [DATA_TRANSFORM_NODE_TYPE]: ({ values, params }) => ({
    values: {
      output: transformValue(values.input, params.operation),
    },
  }),
  [DATA_MERGE_NODE_TYPE]: ({ values }) => ({
    values: {
      output: values.b === undefined ? values.a : [values.a, values.b],
    },
  }),
  [DATA_PREVIEW_NODE_TYPE]: ({ values }) => ({
    data: values.value,
  }),
}

export const dataflowRuntimeDefinitions: NodeWrightRuntimeNodeDefinition[] = Object.entries(
  dataflowRuntimeHandlers,
).map(([type, handler]) => ({
  type,
  handler,
}))

function transformValue(value: unknown, operation: unknown): unknown {
  switch (operation) {
    case 'json':
      return JSON.stringify(value)
    case 'boolean':
      return Boolean(value)
    case 'number':
      return typeof value === 'number' ? value : Number(value)
    case 'string':
      return value == null ? '' : String(value)
    case 'pass':
    default:
      return value
  }
}
