import { performance } from 'node:perf_hooks'
import {
  NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  validateGraph,
} from '../packages/core/dist/protocol/index.js'
import { GraphStore } from '../packages/core/dist/store/index.js'
import {
  createConnectionRulesDiagnosticProvider,
  createDataflowConnectionRules,
  hasCycleForKind,
} from '../packages/core/dist/semantics/index.js'
import { NodeWrightRuntime, compileGraph } from '../packages/core/dist/runtime/index.js'

const sizes = [100, 1_000, 5_000]
const assertPerformance = process.argv.includes('--assert')
const performanceBudgets = {
  protocolMs: 250,
  coreLookupMs: 250,
  semanticsMs: 250,
  semanticsDiagnosticsMs: 1_000,
  runtimeCompileMs: 1_000,
  runtimeRunMs: 5_000,
}
const definition = {
  type: 'benchmark-node',
  ports: [
    { id: 'input', direction: 'input', kind: 'data' },
    { id: 'output', direction: 'output', kind: 'data' },
  ],
  capabilities: ['event', 'pure'],
}
const runtimeDefinition = {
  type: definition.type,
  handler: ({ values }) => ({ values: { output: values.input } }),
}
const semanticDiagnostics = createConnectionRulesDiagnosticProvider(createDataflowConnectionRules())
const results = []

for (const size of sizes) {
  const graph = createLinearGraph(size)
  const validation = measure(() => validateGraph(graph, { nodeDefinitions: [definition] }))
  const store = new GraphStore(graph, { nodeDefinitions: [definition] })
  const storeQueries = measure(() => {
    for (let index = 0; index < size; index += 1) {
      if (!store.getNode(`node-${index}`)) {
        throw new Error(`Core lookup missed node-${index}.`)
      }
    }
  })
  const cycleCheck = measure(() =>
    hasCycleForKind(
      graph,
      {
        kind: 'data',
        source: { nodeId: `node-${size - 1}`, portId: 'output' },
        target: { nodeId: 'node-0', portId: 'input' },
      },
      'data',
    ),
  )
  const diagnostics = measure(() =>
    semanticDiagnostics({
      graph,
      nodeDefinitions: [definition],
    }),
  )
  const compilation = measure(() =>
    compileGraph({
      graph,
      entryNodeId: `node-${size - 1}`,
      definitions: [definition],
      runtimeDefinitions: [runtimeDefinition],
    }),
  )

  if (!validation.value.valid) {
    throw new Error(`Protocol validation failed for ${size.toLocaleString()} nodes.`)
  }

  if (!cycleCheck.value) {
    throw new Error(
      `Semantics did not detect the closing cycle for ${size.toLocaleString()} nodes.`,
    )
  }

  if (!Array.isArray(diagnostics.value) || diagnostics.value.length > 0) {
    throw new Error(`Semantics diagnostics failed for ${size.toLocaleString()} nodes.`)
  }

  if (!compilation.value.valid || compilation.value.plan?.nodeOrder.length !== size) {
    throw new Error(`Runtime compilation failed for ${size.toLocaleString()} nodes.`)
  }

  const runtime = new NodeWrightRuntime({
    definitions: [definition],
    runtimeDefinitions: [runtimeDefinition],
    debug: {
      captureInputs: false,
      captureOutputs: false,
      captureCallStack: false,
    },
  })
  const execution = await measureAsync(() => runtime.run(compilation.value.plan))

  if (execution.value.status !== 'success') {
    throw new Error(`Runtime execution failed for ${size.toLocaleString()} nodes.`)
  }

  results.push({
    nodes: size,
    edges: graph.edges.length,
    protocolMs: formatDuration(validation.durationMs),
    coreLookupMs: formatDuration(storeQueries.durationMs),
    semanticsMs: formatDuration(cycleCheck.durationMs),
    semanticsDiagnosticsMs: formatDuration(diagnostics.durationMs),
    runtimeCompileMs: formatDuration(compilation.durationMs),
    runtimeRunMs: formatDuration(execution.durationMs),
  })
}

console.table(results)

if (assertPerformance) {
  assertPerformanceBudgets(results)
}

function createLinearGraph(size) {
  return {
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes: Array.from({ length: size }, (_, index) => ({
      id: `node-${index}`,
      type: definition.type,
      x: index * 20,
      y: 0,
    })),
    edges: Array.from({ length: Math.max(0, size - 1) }, (_, index) => ({
      id: `edge-${index}`,
      kind: 'data',
      source: { nodeId: `node-${index}`, portId: 'output' },
      target: { nodeId: `node-${index + 1}`, portId: 'input' },
    })),
    groups: [],
    meta: {},
  }
}

function measure(operation) {
  const startedAt = performance.now()
  const value = operation()

  return {
    value,
    durationMs: performance.now() - startedAt,
  }
}

async function measureAsync(operation) {
  const startedAt = performance.now()
  const value = await operation()

  return {
    value,
    durationMs: performance.now() - startedAt,
  }
}

function formatDuration(value) {
  return Number(value.toFixed(2))
}

function assertPerformanceBudgets(entries) {
  const largest = entries.at(-1)

  if (!largest || largest.nodes !== 5_000) {
    throw new Error('Performance sanity check requires the 5,000-node result.')
  }

  for (const [metric, budgetMs] of Object.entries(performanceBudgets)) {
    const durationMs = largest[metric]

    if (typeof durationMs !== 'number' || durationMs > budgetMs) {
      throw new Error(
        `Performance budget exceeded for ${metric}: ${String(durationMs)}ms > ${budgetMs}ms.`,
      )
    }
  }

  console.log('5,000-node performance sanity budgets passed.')
}
