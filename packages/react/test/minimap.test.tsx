import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NodeEngine } from '../src/index'
import { render, type Rendered } from './harness'

const graph: GraphSnapshot = {
  schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  nodes: [{ id: 'sketch', type: 'sketch', x: 0, y: 0, width: 200, height: 100 }],
  edges: [],
  groups: [],
  meta: {},
}

const nodeTypes = { sketch: { dom: false as const } }

let rendered: Rendered | null = null

afterEach(async () => {
  await rendered?.unmount()
  rendered = null
  vi.restoreAllMocks()
})

describe('React NodeEngine minimap', () => {
  it('re-attaches the minimap across a StrictMode remount and detaches it on unmount', async () => {
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
    const balance = (target: Element) =>
      add.mock.contexts.filter((context) => context === target).length -
      remove.mock.contexts.filter((context) => context === target).length

    rendered = await render(
      <StrictMode>
        <NodeEngine graph={graph} nodeTypes={nodeTypes} minimap={{ width: 180, height: 120 }} />
      </StrictMode>,
    )

    const minimap = rendered.host.querySelector<HTMLElement>('.ne-minimap')!

    expect(minimap.style.width).toBe('180px')
    expect(remove.mock.contexts).toContain(minimap)
    expect(balance(minimap)).toBeGreaterThan(0)

    await rendered.unmount()
    rendered = null

    expect(balance(minimap)).toBe(0)
  })
})
