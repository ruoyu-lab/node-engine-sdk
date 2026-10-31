# @node-wright/vue

The official Vue 3 adapter of Node Wright. All editor state and interaction are handled by `createEditorController` in the low-level core (`@node-wright/core/view`); this package renders the controller snapshot as the `NodeWright` component, forwards editor events as component events, exposes `NodeWrightApi` through the component ref and registers custom DOM node components through `domComponents`. It behaves the same as `@node-wright/react` (both packages run the same adapter contract test suite).

[Live demo](https://ruoyu-lab.github.io/node-wright/) · [Project README](https://github.com/ruoyu-lab/node-wright/blob/main/README.md) · [Documentation](https://github.com/ruoyu-lab/node-wright/blob/main/docs/README.md)

## Installation

```bash
npm install @node-wright/vue @node-wright/core vue
```

- Version: `0.1.0-beta.3` (beta; APIs may still change).
- Dependencies: `@node-wright/core` (same version).
- Peer dependency: `vue ^3.5.13`, provided by the host application; Vue is not bundled into this package.
- Styles: import `@node-wright/vue/style.css` once (it already includes `@node-wright/core/view/style.css`).

## Exports

| Export              | Description                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `NodeWright`        | The editor component: its props are the editor options plus `ariaLabel` and `domComponents`; it also provides `background` and `overlay` slots |
| `DefaultDomNode`    | The default DOM node component (props: `NodeWrightDomNodeProps`)                                                                               |
| `NodeWrightProps`   | Component props type                                                                                                                           |
| `NodeWrightEmitMap` | Component event types (graph changes are emitted as `update:graph`; every other event keeps its name from the core event map)                  |
| `./style.css`       | Editor styles                                                                                                                                  |

Import the editor API, event payloads and extension types from `@node-wright/core/view`.

## Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION, type GraphSnapshot } from '@node-wright/core/protocol'
import type { NodeWrightApi } from '@node-wright/core/view'
import { NodeWright } from '@node-wright/vue'
import '@node-wright/vue/style.css'

const nodeDefinitions = [
  { type: 'note', label: 'Note', ports: [{ id: 'out', direction: 'output' as const }] },
]
const editor = ref<NodeWrightApi | null>(null)
const graph = ref<GraphSnapshot>({
  schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  nodes: [{ id: 'n1', type: 'note', x: 80, y: 80 }],
  edges: [],
  groups: [],
  meta: {},
})
</script>

<template>
  <div style="height: 480px">
    <NodeWright
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

- [Vue adapter](https://github.com/ruoyu-lab/node-wright/blob/main/docs/vue-adapter.md)
- [Editor controller API (options, events and the full `NodeWrightApi` reference)](https://github.com/ruoyu-lab/node-wright/blob/main/docs/controller-api.md)
- [Getting started](https://github.com/ruoyu-lab/node-wright/blob/main/docs/getting-started.md)
- [Documentation index](https://github.com/ruoyu-lab/node-wright/blob/main/docs/README.md) · [Project README](https://github.com/ruoyu-lab/node-wright/blob/main/README.md)

## License

MIT
