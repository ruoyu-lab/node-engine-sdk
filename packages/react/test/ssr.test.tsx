// @vitest-environment node
import { NODE_ENGINE_GRAPH_SCHEMA_VERSION } from '@node-engine-sdk/core/protocol'
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { NodeEngine } from '../src/index'

const graph = {
  schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  nodes: [{ id: 'prompt', type: 'prompt', x: 0, y: 0 }],
  edges: [],
  groups: [],
  meta: {},
}

describe('React NodeEngine server rendering', () => {
  it('renders the editor shell without a DOM and without warnings', () => {
    const error = vi.spyOn(console, 'error')
    const warn = vi.spyOn(console, 'warn')
    const renderOverlay = vi.fn(() => null)

    expect(typeof document).toBe('undefined')

    const html = renderToString(
      <StrictMode>
        <NodeEngine
          graph={graph}
          ariaLabel="Server graph"
          className="app-graph"
          gridVisible={false}
          renderOverlay={renderOverlay}
        />
      </StrictMode>,
    )

    expect(html).toContain('class="ne-root app-graph"')
    expect(html).toContain('aria-label="Server graph"')
    expect(html).toContain('class="ne-grid-surface" style="display:none"')
    expect(html).toContain('class="ne-canvas-surface"')
    expect(html).not.toContain('ne-dom-node')
    expect(renderOverlay).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
})
