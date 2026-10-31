# @node-wright/core

The low-level core of Node Wright: graph protocol, state store, semantic rules, execution runtime, auto layout, debug helpers and a framework-agnostic editor controller. The official Vue 3 and React adapters and the official presets are built on it. It depends on no UI framework and on no other `@node-wright/*` package. Everything except the `view` subpath works without a DOM, so it runs in Node.js, Workers and other headless environments.

[Live demo](https://ruoyu-lab.github.io/node-wright/) ([React build](https://ruoyu-lab.github.io/node-wright/react/)) · [Project README](https://github.com/ruoyu-lab/node-wright/blob/main/README.md) · [Documentation](https://github.com/ruoyu-lab/node-wright/blob/main/docs/README.md)

## Installation

```bash
npm install @node-wright/core
```

- Version: `0.1.0-beta.3` (beta; APIs may still change).
- Dependencies and peer dependencies: none.
- Requirements: Node.js `>=20.19.0`; ESM-only, ES2022.

## Exports

| Entry point                        | Contents                                                                                                                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@node-wright/core`                | Everything exported by `protocol` and `store`                                                                                                                                                            |
| `@node-wright/core/protocol`       | Graph types such as `GraphSnapshot`; `parseGraph` / `validateGraph` / `repairGraph`; diagnostics; parameter schemas; store and plugin contracts; extension manifests; execution plan types; `GraphIndex` |
| `@node-wright/core/store`          | `GraphStore`, `createGraphStore`, command helpers, transactions, history, plugin lifecycle                                                                                                               |
| `@node-wright/core/semantics`      | Data-flow / exec-flow / hybrid-flow plugins, connection rules, value types, function / subgraph / variable signatures                                                                                    |
| `@node-wright/core/runtime`        | `NodeWrightRuntime`, `compileGraph`, sequential and concurrent schedulers, variable API                                                                                                                  |
| `@node-wright/core/layout`         | `layoutGraph`, `applyGraphLayout`, `createDagLayout`                                                                                                                                                     |
| `@node-wright/core/debug`          | `summarizeRunDebugState` and other queries over run results                                                                                                                                              |
| `@node-wright/core/view`           | `createEditorController`, `NodeWrightApi`, editor option / event / render extension types, DOM node model                                                                                                |
| `@node-wright/core/view/style.css` | Shared editor styles                                                                                                                                                                                     |

Module dependencies flow one way, with no cycles: `store`, `semantics` and `layout` depend only on `protocol`; `runtime` depends on `protocol` and `semantics`; `debug` depends on `runtime`; `view` depends on `protocol` and `store`. Only `view` may use browser globals, and no module imports a UI framework.

## Examples

Headless editing and execution:

```ts
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION, parseGraph } from '@node-wright/core/protocol'
import { createGraphStore } from '@node-wright/core/store'
import { NodeWrightRuntime } from '@node-wright/core/runtime'
import type { SemanticNodeDefinition } from '@node-wright/core/semantics'

const definitions: SemanticNodeDefinition[] = [
  {
    type: 'number',
    capabilities: ['pure'],
    ports: [{ id: 'value', direction: 'output', kind: 'data', dataType: 'number' }],
  },
  {
    type: 'double',
    capabilities: ['pure'],
    ports: [
      { id: 'input', direction: 'input', kind: 'data', dataType: 'number', required: true },
      { id: 'output', direction: 'output', kind: 'data', dataType: 'number' },
    ],
  },
]

const graph = parseGraph(
  {
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes: [
      { id: 'a', type: 'number', x: 0, y: 0, data: { params: { value: 21 } } },
      { id: 'b', type: 'double', x: 240, y: 0 },
    ],
    edges: [
      {
        id: 'a-b',
        kind: 'data',
        source: { nodeId: 'a', portId: 'value' },
        target: { nodeId: 'b', portId: 'input' },
      },
    ],
    groups: [],
    meta: {},
  },
  { nodeDefinitions: definitions },
)

const store = createGraphStore(graph, { nodeDefinitions: definitions })
store.updateNode('a', { data: { params: { value: 50 } } })
store.undo()

const runtime = new NodeWrightRuntime({
  graph: store.getSnapshot(),
  definitions,
  handlers: {
    number: ({ params }) => ({ values: { value: Number(params.value) } }),
    double: ({ values }) => ({ values: { output: Number(values.input) * 2 } }),
  },
})
const compiled = runtime.compile('b')

if (compiled.plan) {
  const result = await runtime.run(compiled.plan)
  console.log(result.nodeStates.b?.outputValues) // { output: 42 }
}
```

The editor controller, which the official adapters are built on (Vue and React users should use `@node-wright/vue` / `@node-wright/react` directly):

```ts
import { createEditorController } from '@node-wright/core/view'

const controller = createEditorController({
  nodeDefinitions: [{ type: 'note', label: 'Note' }],
  onEvent: (name, ...args) => console.log(name, args),
})
const unsubscribe = controller.subscribe(() => console.log(controller.getSnapshot().graph))

controller.api.nodes.add({ type: 'note', x: 0, y: 0 })
unsubscribe()
controller.destroy()
```

## Documentation

The detailed documentation is currently written in Simplified Chinese.

- [Core API](https://github.com/ruoyu-lab/node-wright/blob/main/docs/core-api.md)
- [Protocol](https://github.com/ruoyu-lab/node-wright/blob/main/docs/protocol-api.md) · [Semantics](https://github.com/ruoyu-lab/node-wright/blob/main/docs/semantics-api.md) · [Runtime](https://github.com/ruoyu-lab/node-wright/blob/main/docs/runtime-api.md) · [Layout](https://github.com/ruoyu-lab/node-wright/blob/main/docs/layout-api.md) · [Debugging](https://github.com/ruoyu-lab/node-wright/blob/main/docs/runtime-debugging.md)
- [Editor controller API](https://github.com/ruoyu-lab/node-wright/blob/main/docs/controller-api.md)
- [Documentation index](https://github.com/ruoyu-lab/node-wright/blob/main/docs/README.md) · [Project README](https://github.com/ruoyu-lab/node-wright/blob/main/README.md)

## License

MIT
