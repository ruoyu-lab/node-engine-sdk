import {
  createDomNodeControls,
  formatDomFieldValue,
  isDomSelectOpen,
  normalizeDomFieldNumber,
  resolveDomFieldDisplayValue,
  resolveDomFieldImageUrl,
  resolveDomFieldRangeProgress,
  resolveDomFieldsStyle,
  resolveDomNumberDraft,
  resolveDomFieldPortDotClass,
  resolveDomPortDotClass,
  resolveDomPortDotStyle,
  resolveDomPortLabelClass,
  resolveDomSelectedOptionLabel,
  resolveDomTimeSegment,
  sanitizeDomNumberDraft,
  type DomNodeControlsSource,
  type NodeWrightDomNodeApi,
  type NodeWrightResolvedDomNodeField,
  type NodeWrightResolvedDomNodeModel,
  type NodeWrightResolvedDomNodePort,
} from '@node-wright/core/view'
import { describe, expect, it, vi } from 'vitest'

function field(patch: Partial<NodeWrightResolvedDomNodeField>): NodeWrightResolvedDomNodeField {
  return {
    key: 'value',
    label: 'Value',
    kind: 'number',
    top: 0,
    height: 26,
    value: 4,
    textValue: '4',
    resolvedValue: 4,
    resolvedTextValue: '4',
    driven: false,
    highlighted: false,
    ...patch,
  }
}

function createApi() {
  return {
    select: vi.fn(),
    params: { update: vi.fn(), set: vi.fn() },
    ports: {
      get: vi.fn(),
      startConnection: vi.fn(),
      finishConnection: vi.fn(),
      previewConnection: vi.fn(),
    },
    resize: { get: vi.fn(), getConstraints: vi.fn(), start: vi.fn() },
    interaction: { pointerDown: vi.fn() },
  }
}

function createSource(fields: NodeWrightResolvedDomNodeField[], selected = true) {
  const api = createApi()
  const source: DomNodeControlsSource = {
    api: api as unknown as NodeWrightDomNodeApi,
    model: { fields } as NodeWrightResolvedDomNodeModel,
    selected,
  }

  return { api, source }
}

function pointer(type: string, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, { pointerId: 1, bubbles: true, cancelable: true, ...init })
}

describe('default DOM field values', () => {
  it('clamps and snaps numbers to the field step grid', () => {
    const stepped = field({ min: 1, max: 9, step: 0.5 })

    expect(normalizeDomFieldNumber(stepped, 3.3)).toBe(3.5)
    expect(normalizeDomFieldNumber(stepped, 12)).toBe(9)
    expect(normalizeDomFieldNumber(stepped, -3)).toBe(1)
    expect(sanitizeDomNumberDraft('-1a2.3.4')).toBe('-12.34')
  })

  it('takes any number in a field without a step, clamped to its range', () => {
    const free = field({ min: 0, max: 1 })

    expect(normalizeDomFieldNumber(free, 0.333)).toBe(0.333)
    expect(normalizeDomFieldNumber(free, 0.001)).toBe(0.001)
    expect(normalizeDomFieldNumber(free, 4)).toBe(1)
    expect(normalizeDomFieldNumber(field({}), -2.5)).toBe(-2.5)
  })

  it('shows numbers with every digit they have, but the noise of binary fractions', () => {
    expect(formatDomFieldValue(0.001)).toBe('0.001')
    expect(formatDomFieldValue(0.33)).toBe('0.33')
    expect(formatDomFieldValue(0.1 + 0.2)).toBe('0.3')
    expect(formatDomFieldValue(-1.25)).toBe('-1.25')
    expect(formatDomFieldValue(12)).toBe('12')
  })

  it('formats display values, ranges, images, options and port tones', () => {
    expect(resolveDomFieldDisplayValue(field({ kind: 'boolean', resolvedValue: true }))).toBe('ON')
    expect(
      resolveDomFieldRangeProgress(field({ kind: 'range', min: 0, max: 8, resolvedValue: 2 })),
    ).toBe(25)
    expect(resolveDomFieldImageUrl(field({ kind: 'image', resolvedValue: '  ' }))).toBeNull()
    expect(
      resolveDomSelectedOptionLabel(
        field({
          kind: 'select',
          resolvedValue: 2,
          options: [
            { label: 'One', value: 1 },
            { label: 'Two', value: '2' },
          ],
        }),
      ),
    ).toBe('Two')
    const incompatible = {
      color: '#abc',
      connectable: false,
      port: { id: 'run', direction: 'input', kind: 'exec' },
      anchor: { connectionCount: 2 },
    } as NodeWrightResolvedDomNodePort

    expect(resolveDomPortDotStyle(incompatible)).toEqual({ '--nw-port-color': '#abc' })
    expect(resolveDomPortDotClass(incompatible)).toEqual({
      'nw-default-dom-node__port-dot--exec': true,
      'nw-default-dom-node__port-dot--connected': true,
      'nw-default-dom-node__port-dot--active': false,
      'nw-default-dom-node__port-dot--compatible': false,
      'nw-default-dom-node__port-dot--incompatible': true,
    })
    expect(
      resolveDomFieldPortDotClass({ ...incompatible, connectable: true, active: true }),
    ).toMatchObject({
      'nw-default-dom-node__field-port-dot--active': true,
      'nw-default-dom-node__field-port-dot--compatible': true,
      'nw-default-dom-node__field-port-dot--incompatible': false,
    })
    expect(resolveDomPortLabelClass(incompatible)).toEqual({
      'nw-default-dom-node__port-label--active': false,
      'nw-default-dom-node__port-label--incompatible': true,
    })
  })

  it('sizes the label column to the widest non-textarea label', () => {
    const style = resolveDomFieldsStyle(
      {
        fieldsTop: 80,
        layout: { portInset: 14, bottomPadding: 10, fieldRowGap: 8 },
        fields: [
          field({ label: 'Short' }),
          field({ label: 'Ignored long label', kind: 'textarea' }),
        ],
      } as NodeWrightResolvedDomNodeModel,
      (label) => label.length * 10,
    )

    expect(style).toMatchObject({
      top: '80px',
      left: '9px',
      '--nw-field-label-column-width': '76px',
    })
  })
})

describe('default DOM node controls', () => {
  it('keeps number drafts until commit and writes normalized values', () => {
    const number = field({ min: 0, max: 10, step: 2 })
    const { api, source } = createSource([number])
    const controls = createDomNodeControls(() => source)
    const listener = vi.fn()

    controls.subscribe(listener)
    controls.numberDraftInput(number, '7x')
    expect(resolveDomNumberDraft(controls.getState(), number)).toBe('7')
    expect(listener).toHaveBeenCalledOnce()

    controls.numberDraftCommit(number, '7')
    expect(api.params.update).toHaveBeenCalledWith('value', 8, { source: 'dom.default-node.field' })
    expect(resolveDomNumberDraft(controls.getState(), number)).toBe('4')

    controls.numberStep(number, -1, pointer('pointerdown'))
    expect(api.params.update).toHaveBeenLastCalledWith('value', 2, expect.any(Object))
  })

  it('never writes driven fields', () => {
    const driven = field({ driven: true })
    const { api, source } = createSource([driven])
    const controls = createDomNodeControls(() => source)

    controls.textInput(driven, 'x')
    controls.numberDraftCommit(driven, '3')
    controls.booleanChange(driven, true)
    controls.numberDraftInput(driven, '5')

    expect(api.params.update).not.toHaveBeenCalled()
    expect(resolveDomNumberDraft(controls.getState(), driven)).toBe('4')
  })

  it('shows what drives a number field where that is no number', () => {
    const { source } = createSource([])
    const controls = createDomNodeControls(() => source)
    const byName = field({ driven: true, resolvedValue: 'Result', resolvedTextValue: 'Result' })
    const unknown = field({ driven: true, resolvedValue: undefined, resolvedTextValue: '' })

    expect(resolveDomNumberDraft(controls.getState(), byName)).toBe('Result')
    expect(resolveDomNumberDraft(controls.getState(), unknown)).toBe('')
  })

  it('edits time segments and commits a normalized time', () => {
    const time = field({ key: 'at', kind: 'time', resolvedValue: '9:5' })
    const { api, source } = createSource([time])
    const controls = createDomNodeControls(() => source)

    expect(resolveDomTimeSegment(controls.getState(), time, 'hours')).toBe('9')
    controls.timeSegmentInput(time, 'hours', '7a8')
    expect(resolveDomTimeSegment(controls.getState(), time, 'hours')).toBe('78')

    controls.timeSegmentCommit(time)
    expect(api.params.update).toHaveBeenCalledWith('at', '23:05', expect.any(Object))
  })

  it('opens the select menu, selects the node and closes on outside pointer down', () => {
    const select = field({
      key: 'mode',
      kind: 'select',
      options: [
        { label: 'Fast', value: 'fast' },
        { label: 'Slow', value: 'slow' },
      ],
    })
    const { api, source } = createSource([select], false)
    const controls = createDomNodeControls(() => source)
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')

    controls.mount(window)
    controls.toggleSelect(select, pointer('click'))

    expect(api.select).toHaveBeenCalledOnce()
    expect(isDomSelectOpen(controls.getState(), select)).toBe(true)
    expect(add).toHaveBeenCalledWith('pointerdown', expect.any(Function), true)

    controls.selectOption(select, 'slow', pointer('click'))
    expect(api.params.update).toHaveBeenCalledWith('mode', 'slow', expect.any(Object))
    expect(isDomSelectOpen(controls.getState(), select)).toBe(false)

    controls.toggleSelect(select, pointer('click'))
    document.body.dispatchEvent(pointer('pointerdown'))
    expect(isDomSelectOpen(controls.getState(), select)).toBe(false)
    expect(remove.mock.calls.filter(([type]) => type === 'pointerdown')).toHaveLength(2)

    controls.destroy()
    add.mockRestore()
    remove.mockRestore()
  })

  it('scrubs numbers by dragging and only listens on the window during the drag', () => {
    const number = field({ step: 1 })
    const { api, source } = createSource([number])
    const controls = createDomNodeControls(() => source)
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')

    controls.mount(window)
    expect(add).not.toHaveBeenCalled()

    controls.numberPointerDown(number, pointer('pointerdown', { clientX: 100 }))
    window.dispatchEvent(pointer('pointermove', { clientX: 130 }))

    expect(api.params.update).toHaveBeenCalledWith('value', 6, expect.any(Object))
    expect(resolveDomNumberDraft(controls.getState(), number)).toBe('6')
    expect(document.body.style.cursor).toBe('ew-resize')

    window.dispatchEvent(pointer('pointerup'))

    expect(resolveDomNumberDraft(controls.getState(), number)).toBe('4')
    expect(document.body.style.cursor).toBe('')
    expect(remove.mock.calls).toHaveLength(add.mock.calls.length)

    controls.destroy()
    add.mockRestore()
    remove.mockRestore()
  })

  it('forwards port and resize gestures to the node API', () => {
    const { api, source } = createSource([])
    const controls = createDomNodeControls(() => source)
    const down = pointer('pointerdown')

    controls.portPointerDown('in', down)
    controls.portPointerEnter('in')
    expect(api.ports.startConnection).toHaveBeenCalledWith('in', down)
    expect(api.ports.previewConnection).not.toHaveBeenCalled()
    expect(down.defaultPrevented).toBe(true)

    source.connectionSource = { nodeId: 'other', portId: 'out' }
    controls.portPointerEnter('in')
    controls.portPointerLeave()
    controls.portPointerUp('in', pointer('pointerup'))
    expect(api.ports.previewConnection.mock.calls).toEqual([['in'], [null]])
    expect(api.ports.finishConnection).toHaveBeenCalledOnce()

    controls.resizePointerDown('nw', down)
    controls.nodePointerDown(down)
    expect(api.resize.start).toHaveBeenCalledWith(down, 'nw')
    expect(api.interaction.pointerDown).toHaveBeenCalledWith(down)
  })
})
