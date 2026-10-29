# @node-engine-sdk/vue

The official Vue 3 adapter of Node Engine SDK. All editor state and interaction are handled by `createEditorController` in the low-level SDK (`@node-engine-sdk/core/view`); this package renders the controller snapshot as the `NodeEngine` component, forwards editor events as component events, exposes `NodeEngineApi` through the component ref and registers custom DOM node components through `domComponents`. It behaves the same as `@node-engine-sdk/react` (both packages run the same adapter contract test suite).

[Live demo](https://ruoyu-lab.github.io/node-engine-sdk/) · [Project README](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/README.md) · [Documentation](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/README.md)

## Installation

```bash
npm install @node-engine-sdk/vue @node-engine-sdk/core vue
```

- Version: `0.1.0-beta.3` (beta; APIs may still change).
- Dependencies: `@node-engine-sdk/core` (same version).
- Peer dependency: `vue ^3.5.13`, provided by the host application; Vue is not bundled into this package.
- Styles: import `@node-engine-sdk/vue/style.css` once (it already includes `@node-engine-sdk/core/view/style.css`).

## Exports

| Export              | Description                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `NodeEngine`        | The editor component: its props are the editor options plus `ariaLabel` and `domComponents`; it also provides `background` and `overlay` slots |
| `DefaultDomNode`    | The default DOM node component (props: `NodeEngineDomNodeProps`)                                                                               |
| `NodeEngineProps`   | Component props type                                                                                                                           |
| `NodeEngineEmitMap` | Component event types (graph changes are emitted as `update:graph`; every other event keeps its name from the core event map)                  |
| `./style.css`       | Editor styles                                                                                                                                  |

Import the editor API, event payloads and extension types from `@node-engine-sdk/core/view`.

## Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import type { NodeEngineApi } from '@node-engine-sdk/core/view'
import { NodeEngine } from '@node-engine-sdk/vue'
import '@node-engine-sdk/vue/style.css'

const nodeDefinitions = [
  { type: 'note', label: 'Note', ports: [{ id: 'out', direction: 'output' as const }] },
]
const editor = ref<NodeEngineApi | null>(null)
const graph = ref<GraphSnapshot>({
  schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  nodes: [{ id: 'n1', type: 'note', x: 80, y: 80 }],
  edges: [],
  groups: [],
  meta: {},
})
</script>

<template>
  <div style="height: 480px">
    <NodeEngine
      ref="editor"
      v-model:graph="graph"
      :node-definitions="nodeDefinitions"
      @node-click="({ node }) => editor?.view.center.node(node.id)"
    />
  </div>
</template>
```

## Documentation

The detailed documentation is currently written in Simplified Chinese.

- [Vue adapter](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/vue-adapter.md)
- [Editor controller API (options, events and the full `NodeEngineApi` reference)](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/controller-api.md)
- [Getting started](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/getting-started.md)
- [Documentation index](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/README.md) · [Project README](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/README.md)

## License

MIT
