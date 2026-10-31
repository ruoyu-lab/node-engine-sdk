// @vitest-environment node
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION } from '@node-wright/core/protocol'
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { NodeWright } from '../src/index'

const graph = {
  schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  nodes: [{ id: 'prompt', type: 'prompt', x: 0, y: 0 }],
  edges: [],
  groups: [],
  meta: {},
}

describe('React NodeWright server rendering', () => {
  it('renders the editor shell without a DOM and without warnings', () => {
    const error = vi.spyOn(console, 'error')
    const warn = vi.spyOn(console, 'warn')
    const renderOverlay = vi.fn(() => null)

    expect(typeof document).toBe('undefined')

    const html = renderToString(
      <StrictMode>
        <NodeWright
          graph={graph}
          ariaLabel="Server graph"
          className="app-graph"
          gridVisible={false}
          renderOverlay={renderOverlay}
        />
      </StrictMode>,
    )

    expect(html).toContain('class="nw-root app-graph"')
    expect(html).toContain('aria-label="Server graph"')
    expect(html).toContain('class="nw-grid-surface" style="display:none"')
    expect(html).toContain('class="nw-canvas-surface"')
    expect(html).not.toContain('nw-dom-node')
    expect(renderOverlay).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
})
