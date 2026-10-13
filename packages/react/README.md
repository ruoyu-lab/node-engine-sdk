# @node-engine-sdk/react

The official React adapter of Node Engine SDK. All editor state and interaction are handled by `createEditorController` in the low-level SDK (`@node-engine-sdk/core/view`); this package renders the controller snapshot as the `NodeEngine` component, turns editor events into `on*` callback props, exposes `NodeEngineApi` through a ref and registers custom DOM node components through `domComponents`. Props, events and default DOM node behavior match `@node-engine-sdk/vue` (both packages run the same adapter contract test suite).

[Live demo](https://ruoyu-lab.github.io/node-engine-sdk/react/) · [Project README](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/README.md) · [Documentation](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/README.md)

## Installation

```bash
npm install @node-engine-sdk/react @node-engine-sdk/core react react-dom
```

- Version: `0.1.0-beta.2` (beta; APIs may still change).
- Dependencies: `@node-engine-sdk/core` (same version).
- Peer dependencies: `react` and `react-dom` `^18.3.0 || ^19.0.0`; `@types/react` is an optional peer.
- Styles: import `@node-engine-sdk/react/style.css` once (it already includes `@node-engine-sdk/core/view/style.css`).

## Exports

| Export                                                            | Description                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `NodeEngine`                                                      | The editor component (`forwardRef`; the ref value is a `NodeEngineHandle`)     |
| `DefaultDomNode`                                                  | The default DOM node component (`memo`)                                        |
| `useNodeEngineApi()`                                              | Returns the `NodeEngineApi` inside render-prop content and DOM node components |
| `NodeEngineProps`, `NodeEngineHandle`                             | Props and ref types (`NodeEngineHandle` is `NodeEngineApi`)                    |
| `NodeEngineEventHandlers`, `NodeEngineEventHandlerName`           | Event callback prop types                                                      |
| `NodeEngineDomComponent`                                          | `ComponentType<NodeEngineDomNodeProps>`                                        |
| `NodeEngineBackgroundRenderProps`, `NodeEngineOverlayRenderProps` | Argument types of the `renderBackground` / `renderOverlay` render props        |
| `./style.css`                                                     | Editor styles                                                                  |

## Example

```tsx
import { useRef, useState } from 'react'
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import { NodeEngine, type NodeEngineHandle } from '@node-engine-sdk/react'
import '@node-engine-sdk/react/style.css'

// Object and array props are compared by reference, so keep registries at module level.
const nodeDefinitions = [
  { type: 'note', label: 'Note', ports: [{ id: 'out', direction: 'output' as const }] },
]

const initialGraph: GraphSnapshot = {
  schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  nodes: [{ id: 'n1', type: 'note', x: 80, y: 80 }],
  edges: [],
  groups: [],
  meta: {},
}

export function Editor() {
  const [graph, setGraph] = useState(initialGraph)
  const editor = useRef<NodeEngineHandle>(null)

  return (
    <div style={{ height: 480 }}>
      <NodeEngine
        ref={editor}
        graph={graph}
        onGraphChange={setGraph}
        nodeDefinitions={nodeDefinitions}
        onNodeClick={({ node }) => editor.current?.view.center.node(node.id)}
        renderOverlay={({ api, selection }) => (
          <button
            type="button"
            disabled={!selection.nodes.length}
            onClick={() => api.selection.remove()}
          >
            Delete selected
          </button>
        )}
      />
    </div>
  )
}
```

Key points:

- `graph` plus `onGraphChange` is the React counterpart of Vue's `v-model:graph`. Passing back the same graph object the editor emitted does not replace the graph, so the undo history is kept.
- A new registry array (`nodeDefinitions`, `plugins` and so on) rebuilds the internal store and clears the history; event callbacks may be new functions on every render.
- Safe under StrictMode and SSR: the controller is created, mounted and destroyed in a layout effect, and the server renders only the root element and its canvases.
- When a custom DOM node calls the gesture methods of `domApi`, it must pass the event received by a native listener, not a React synthetic event.

## Documentation

The detailed documentation is currently written in Simplified Chinese.

- [React adapter](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/react-adapter.md)
- [Editor controller API (options, events and the full `NodeEngineApi` reference)](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/controller-api.md)
- [Getting started](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/getting-started.md)
- [Documentation index](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/docs/README.md) · [Project README](https://github.com/ruoyu-lab/node-engine-sdk/blob/main/README.md)

## License

MIT
