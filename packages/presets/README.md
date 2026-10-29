# @node-engine-sdk/presets

The official preset nodes of Node Engine SDK. It combines the 15 primitive nodes (data flow, exec flow, functions, subgraphs) with their definitions, framework-agnostic DOM rendering config, semantic plugins, runtime definitions, layout strategies and initial viewports into presets you can pass straight to the editor and the runtime. It builds only on the low-level SDK `@node-engine-sdk/core`, depends on no UI framework and works with both official adapters; creating a preset never instantiates a runtime.

[Live demo](https://ruoyu-lab.github.io/node-engine-sdk/) ([React build](https://ruoyu-lab.github.io/node-engine-sdk/react/)) · [Project README](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/README.md) · [Documentation](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/README.md)

## Installation

```bash
npm install @node-engine-sdk/presets @node-engine-sdk/core
```

- Version: `0.1.0-beta.3` (beta; APIs may still change).
- Dependencies: `@node-engine-sdk/core` (same version). No peer dependencies.
- Requirements: Node.js `>=20.19.0`; ESM-only, ES2022. Works headless together with `@node-engine-sdk/core/runtime`.

## Exports

| Entry point                               | Contents                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@node-engine-sdk/presets`                | `createDataflowPreset`, `createExecflowPreset`, `createFunctionPreset`, `createSubgraphPreset`, `createHybridFlowPreset`, `createPresetLayout`; for each node family its type constants, definitions, runtime definitions and DOM config (`*NodeTypes`); port generators for function / subgraph call nodes and subgraph boundary nodes; `PRESET_NODE_ACCENTS`; `NodeEnginePreset` and the other preset types |
| `@node-engine-sdk/presets/nodes/dataflow` | Definitions, handlers and plugin factory for `data:source`, `data:transform`, `data:merge` and `data:preview`                                                                                                                                                                                                                                                                                                 |
| `@node-engine-sdk/presets/nodes/execflow` | Definitions, handlers and plugin factory for `exec:event`, `exec:sequence`, `exec:branch`, `exec:delay`, `exec:log`, `exec:set-variable` and `exec:get-variable`, plus the exec port ID constants                                                                                                                                                                                                             |
| `@node-engine-sdk/presets/nodes/function` | `function:call`, `createFunctionCallPorts`, its handler and plugin factory                                                                                                                                                                                                                                                                                                                                    |
| `@node-engine-sdk/presets/nodes/subgraph` | `subgraph:call` / `subgraph:input` / `subgraph:output`, their port generators, the call handler and plugin factory                                                                                                                                                                                                                                                                                            |

The built-in node labels, descriptions and default DOM titles are written in Simplified Chinese.

## Example

```ts
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import { NodeEngineRuntime } from '@node-engine-sdk/core/runtime'
import {
  DATA_PREVIEW_NODE_TYPE,
  DATA_SOURCE_NODE_TYPE,
  createDataflowPreset,
} from '@node-engine-sdk/presets'

const preset = createDataflowPreset()

const graph: GraphSnapshot = {
  schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  nodes: [
    { id: 'source', type: DATA_SOURCE_NODE_TYPE, x: 0, y: 0, data: { params: { value: 'hi' } } },
    { id: 'preview', type: DATA_PREVIEW_NODE_TYPE, x: 0, y: 0 },
  ],
  edges: [
    {
      id: 'e1',
      kind: 'data',
      source: { nodeId: 'source', portId: 'value' },
      target: { nodeId: 'preview', portId: 'value' },
    },
  ],
  groups: [],
  meta: {},
}

// Editor: pass the preset fields as same-named props to the Vue / React `NodeEngine`.
const editorProps = {
  nodeDefinitions: preset.nodeDefinitions,
  nodeTypes: preset.nodeTypes,
  plugins: preset.plugins,
  initialViewport: preset.initialViewport,
}

// Layout: returns a new graph with the computed positions written back.
const laidOut = preset.layout.apply(graph)

// Execution: your application creates the runtime.
const runtime = new NodeEngineRuntime({
  graph: laidOut,
  definitions: preset.nodeDefinitions,
  runtimeDefinitions: preset.runtimeDefinitions,
})
const compiled = runtime.compile('preview')

console.log(editorProps, compiled.valid)
```

## Documentation

The detailed documentation is currently written in Simplified Chinese.

- [Presets API](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/presets-api.md)
- [Primitive node systems](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/node-systems.md)
- [Node authoring guide](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/node-definition-guide.md)
- [Documentation index](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/README.md) · [Project README](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/README.md)

## License

MIT
