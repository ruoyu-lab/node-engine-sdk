import { describe, expect, it } from 'vitest'
import { LayeredRegistry } from '../../src/store/registry'

interface Entry {
  type: string
  label: string
  options?: { color: string }
}

function createRegistry() {
  const events: string[] = []
  const registry = new LayeredRegistry<Entry>('node-definition', (type, key) =>
    events.push(`${type.replace('registry:node-definition-', '')} ${key}`),
  )

  return { registry, events }
}

describe('@node-engine-sdk/core/store LayeredRegistry', () => {
  it('shadows earlier registrations and reveals them again when the top one is removed', () => {
    const { registry, events } = createRegistry()
    const removeFirst = registry.register('demo', { type: 'demo', label: 'First' })
    const removeSecond = registry.register('demo', { type: 'demo', label: 'Second' })

    expect(registry.get('demo')?.label).toBe('Second')

    removeSecond()
    expect(registry.get('demo')?.label).toBe('First')

    removeFirst()
    expect(registry.get('demo')).toBeUndefined()
    expect(events).toEqual([
      'registered demo',
      'registered demo',
      'registered demo',
      'unregistered demo',
    ])
  })

  it('removes exactly one registration, once', () => {
    const { registry, events } = createRegistry()
    const removeFirst = registry.register('demo', { type: 'demo', label: 'First' })
    registry.register('demo', { type: 'demo', label: 'Second' })

    removeFirst()
    removeFirst()

    expect(registry.get('demo')?.label).toBe('Second')
    expect(events).toEqual(['registered demo', 'registered demo', 'registered demo'])
  })

  it('registers silently on request but always reports removal', () => {
    const { registry, events } = createRegistry()
    const remove = registry.register('demo', { type: 'demo', label: 'Built in' }, { silent: true })

    expect(events).toEqual([])

    remove()
    expect(events).toEqual(['unregistered demo'])
  })

  it('lists the top registration of every key in registration order', () => {
    const { registry } = createRegistry()

    registry.register('a', { type: 'a', label: 'A1' })
    registry.register('b', { type: 'b', label: 'B' })
    registry.register('a', { type: 'a', label: 'A2' })

    expect(registry.list().map((entry) => entry.label)).toEqual(['A2', 'B'])

    registry.clear()
    expect(registry.list()).toEqual([])
  })

  it('isolates stored values from registration inputs and query results', () => {
    const { registry } = createRegistry()
    const input: Entry = { type: 'demo', label: 'Demo', options: { color: 'red' } }

    registry.register('demo', input)
    input.options!.color = 'blue'
    registry.get('demo')!.options!.color = 'green'
    registry.list()[0]!.options!.color = 'green'

    expect(registry.get('demo')?.options?.color).toBe('red')
  })
})
