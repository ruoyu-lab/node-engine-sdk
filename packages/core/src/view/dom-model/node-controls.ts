import type { GraphEndpoint, GraphValue } from '../../protocol/index.js'
import type {
  NodeEngineDomNodeApi,
  NodeEngineDomNodeRenderContext,
  NodeEngineDomNodeResizeHandle,
  NodeEngineNodeStatus,
  NodeEngineResolvedDomNodeField,
  NodeEngineResolvedDomNodeModel,
  NodeEngineStyleDeclaration,
} from '../types/index.js'
import {
  normalizeDomFieldNumber,
  normalizeDomTimeSegment,
  parseDomTimeValue,
  resolveDomFieldImageUrl,
  resolveDomFieldNumberValue,
  resolveDomFieldOptionValue,
  resolveDomFieldStep,
  resolveDomNumberDragValue,
  sanitizeDomNumberDraft,
  sanitizeDomTimeSegment,
  type DomTimeSegment,
} from './field-values.js'

/**
 * Interaction state machine behind the default DOM node: port connection gestures, field edits,
 * number drafts and drag-scrubbing, time segments and the select menu. Adapters render the
 * model with the current `getState()`, forward DOM events here and re-render on `subscribe`.
 * Window listeners exist only while a select menu is open or a number is being scrubbed.
 */

export interface DomNodeControlsSource {
  api: NodeEngineDomNodeApi
  model: NodeEngineResolvedDomNodeModel
  selected: boolean
  connectionSource?: GraphEndpoint
}

export interface DomNodeControlsState {
  openSelectKey: string | null
  numberDrafts: Readonly<Record<string, string>>
  timeDrafts: Readonly<Record<string, string>>
}

export interface DomNodeResizeHandleDescriptor {
  handle: NodeEngineDomNodeResizeHandle
  className: string
}

export const DOM_NODE_RESIZE_HANDLES: readonly DomNodeResizeHandleDescriptor[] = [
  { handle: 'nw', className: 'ne-default-dom-node__resize-corner--nw' },
  { handle: 'ne', className: 'ne-default-dom-node__resize-corner--ne' },
  { handle: 'sw', className: 'ne-default-dom-node__resize-corner--sw' },
  { handle: 'se', className: 'ne-default-dom-node__resize-corner--se' },
]

const FIELD_UPDATE_SOURCE = 'dom.default-node.field'
const SELECT_MENU_SELECTOR =
  '.ne-default-dom-node__field-select-trigger, .ne-default-dom-node__field-select-menu'

export function resolveDomNumberDraft(
  state: DomNodeControlsState,
  field: NodeEngineResolvedDomNodeField,
): string {
  const draft = field.driven ? undefined : state.numberDrafts[field.key]

  // Driven by what is no number, such as the name of what drives it, the field shows that.
  if (draft === undefined && field.driven && typeof field.resolvedValue !== 'number') {
    return field.resolvedTextValue
  }

  return draft ?? String(resolveDomFieldNumberValue(field))
}

export function resolveDomTimeSegment(
  state: DomNodeControlsState,
  field: NodeEngineResolvedDomNodeField,
  segment: DomTimeSegment,
): string {
  const draft = field.driven ? undefined : state.timeDrafts[timeDraftKey(field, segment)]

  return draft ?? parseDomTimeValue(field)[segment]
}

export function isDomSelectOpen(
  state: DomNodeControlsState,
  field: NodeEngineResolvedDomNodeField,
): boolean {
  return state.openSelectKey === field.key
}

export function resolveDomNodeHeaderStyle(
  model: NodeEngineResolvedDomNodeModel,
): NodeEngineStyleDeclaration {
  return { height: `${model.layout.headerHeight}px` }
}

/** Inline style of the default node: its accent colour as `--ne-node-accent`, when it has one. */
export function resolveDomNodeAccentStyle(
  model: NodeEngineResolvedDomNodeModel,
): NodeEngineStyleDeclaration {
  return model.accent ? { '--ne-node-accent': model.accent } : {}
}

/** Selection, drag and execution status classes of the default node's root element. */
export function resolveDomNodeClass(
  context: Pick<NodeEngineDomNodeRenderContext, 'selected' | 'dragging' | 'status'>,
): Record<string, boolean> {
  const status = context.status && context.status !== 'idle' ? context.status : null

  return {
    'ne-default-dom-node--selected': context.selected,
    'ne-default-dom-node--dragging': context.dragging,
    [`ne-default-dom-node--${status ?? 'idle'}`]: status !== null,
  }
}

/** The status badge of the default node's header, or `null` for an idle node. */
export function resolveDomNodeStatusClass(
  status: NodeEngineNodeStatus | undefined,
): Record<string, boolean> | null {
  return status && status !== 'idle'
    ? {
        'ne-default-dom-node__status': true,
        [`ne-default-dom-node__status--${status}`]: true,
      }
    : null
}

interface NumberDrag {
  fieldKey: string
  pointerId: number
  startX: number
  startValue: number
  lastStepDelta: number
}

export interface DomNodeControls {
  getState: () => DomNodeControlsState
  subscribe: (listener: () => void) => () => void
  /** Binds the controls to the window of the rendered node. */
  mount: (view: Window) => void
  destroy: () => void
  nodePointerDown: (event: PointerEvent) => void
  resizePointerDown: (handle: NodeEngineDomNodeResizeHandle, event: PointerEvent) => void
  portPointerDown: (portId: string, event: PointerEvent) => void
  portPointerEnter: (portId: string) => void
  portPointerLeave: () => void
  portPointerUp: (portId: string, event: PointerEvent) => void
  fieldPortAreaPointerDown: (field: NodeEngineResolvedDomNodeField, event: PointerEvent) => void
  controlPointerDown: (event: Event) => void
  stopEvent: (event: Event) => void
  textInput: (field: NodeEngineResolvedDomNodeField, value: string) => void
  numberDraftInput: (field: NodeEngineResolvedDomNodeField, rawValue: string) => void
  numberDraftCommit: (field: NodeEngineResolvedDomNodeField, rawValue: string) => void
  numberStep: (
    field: NodeEngineResolvedDomNodeField,
    direction: -1 | 1,
    event: PointerEvent,
  ) => void
  numberPointerDown: (field: NodeEngineResolvedDomNodeField, event: PointerEvent) => void
  rangeInput: (field: NodeEngineResolvedDomNodeField, rawValue: string) => void
  timeSegmentInput: (
    field: NodeEngineResolvedDomNodeField,
    segment: DomTimeSegment,
    rawValue: string,
  ) => void
  timeSegmentCommit: (field: NodeEngineResolvedDomNodeField) => void
  toggleSelect: (field: NodeEngineResolvedDomNodeField, event: Event) => void
  selectOption: (field: NodeEngineResolvedDomNodeField, optionValue: string, event: Event) => void
  booleanChange: (field: NodeEngineResolvedDomNodeField, checked: boolean) => void
  downloadImage: (field: NodeEngineResolvedDomNodeField) => void
  openImage: (field: NodeEngineResolvedDomNodeField) => void
}

export function createDomNodeControls(getSource: () => DomNodeControlsSource): DomNodeControls {
  let state: DomNodeControlsState = { openSelectKey: null, numberDrafts: {}, timeDrafts: {} }
  let numberDrag: NumberDrag | null = null
  let view: Window | null = null
  const listeners = new Set<() => void>()

  function setState(patch: Partial<DomNodeControlsState>): void {
    const wasSelectOpen = state.openSelectKey !== null
    state = { ...state, ...patch }

    if (view && wasSelectOpen !== (state.openSelectKey !== null)) {
      if (state.openSelectKey !== null) {
        view.addEventListener('pointerdown', onWindowPointerDown, true)
      } else {
        view.removeEventListener('pointerdown', onWindowPointerDown, true)
      }
    }

    for (const listener of [...listeners]) {
      listener()
    }
  }

  function ensureSelected(): void {
    const source = getSource()

    if (!source.selected) {
      source.api.select()
    }
  }

  function updateValue(field: NodeEngineResolvedDomNodeField, value: GraphValue): void {
    if (!field.driven) {
      getSource().api.params.update(field.key, value, { source: FIELD_UPDATE_SOURCE })
    }
  }

  function startPortConnection(portId: string, event: PointerEvent): void {
    event.preventDefault()
    event.stopPropagation()
    getSource().api.ports.startConnection(portId, event)
  }

  function onWindowPointerDown(event: PointerEvent): void {
    const target = event.target

    if (!(target instanceof Element && target.closest(SELECT_MENU_SELECTOR))) {
      setState({ openSelectKey: null })
    }
  }

  function onWindowPointerMove(event: PointerEvent): void {
    const drag = numberDrag

    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    const field = getSource().model.fields.find((entry) => entry.key === drag.fieldKey)

    if (!field) {
      return
    }

    const next = resolveDomNumberDragValue(field, drag.startValue, event.clientX - drag.startX)

    if (next.stepDelta === drag.lastStepDelta) {
      return
    }

    numberDrag = { ...drag, lastStepDelta: next.stepDelta }
    setState({ numberDrafts: { ...state.numberDrafts, [field.key]: String(next.value) } })
    setDragCursor(true)
    updateValue(field, next.value)
  }

  function onWindowPointerUp(event: PointerEvent): void {
    if (numberDrag?.pointerId === event.pointerId) {
      const fieldKey = numberDrag.fieldKey

      stopNumberDrag()
      setState({ numberDrafts: withoutKeys(state.numberDrafts, [fieldKey]) })
    }
  }

  function startNumberDrag(drag: NumberDrag): void {
    stopNumberDrag()
    numberDrag = drag
    view?.addEventListener('pointermove', onWindowPointerMove, true)
    view?.addEventListener('pointerup', onWindowPointerUp, true)
    view?.addEventListener('pointercancel', onWindowPointerUp, true)
  }

  function stopNumberDrag(): void {
    if (!numberDrag) {
      return
    }

    numberDrag = null
    view?.removeEventListener('pointermove', onWindowPointerMove, true)
    view?.removeEventListener('pointerup', onWindowPointerUp, true)
    view?.removeEventListener('pointercancel', onWindowPointerUp, true)
    setDragCursor(false)
  }

  function setDragCursor(active: boolean): void {
    const body = view?.document.body

    if (body) {
      body.style.cursor = active ? 'ew-resize' : ''
      body.style.userSelect = active ? 'none' : ''
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    mount(target) {
      view = target
    },
    destroy() {
      stopNumberDrag()
      view?.removeEventListener('pointerdown', onWindowPointerDown, true)
      view = null
      listeners.clear()
    },
    nodePointerDown(event) {
      getSource().api.interaction.pointerDown(event)
    },
    resizePointerDown(handle, event) {
      event.preventDefault()
      event.stopPropagation()
      getSource().api.resize.start(event, handle)
    },
    portPointerDown: startPortConnection,
    portPointerEnter(portId) {
      const source = getSource()

      if (source.connectionSource) {
        source.api.ports.previewConnection(portId)
      }
    },
    portPointerLeave() {
      const source = getSource()

      if (source.connectionSource) {
        source.api.ports.previewConnection(null)
      }
    },
    portPointerUp(portId, event) {
      const source = getSource()

      if (!source.connectionSource) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      source.api.ports.finishConnection(portId, event)
    },
    fieldPortAreaPointerDown(field, event) {
      if (field.inputPort) {
        startPortConnection(field.inputPort.id, event)
      }
    },
    controlPointerDown(event) {
      ensureSelected()
      event.stopPropagation()
    },
    stopEvent(event) {
      event.stopPropagation()
    },
    textInput: updateValue,
    numberDraftInput(field, rawValue) {
      if (!field.driven) {
        setState({
          numberDrafts: { ...state.numberDrafts, [field.key]: sanitizeDomNumberDraft(rawValue) },
        })
      }
    },
    numberDraftCommit(field, rawValue) {
      if (field.driven) {
        return
      }

      const nextValue = Number(rawValue)
      setState({ numberDrafts: withoutKeys(state.numberDrafts, [field.key]) })

      if (rawValue && Number.isFinite(nextValue)) {
        updateValue(field, normalizeDomFieldNumber(field, nextValue))
      }
    },
    numberStep(field, direction, event) {
      ensureSelected()
      event.preventDefault()
      event.stopPropagation()

      if (field.driven) {
        return
      }

      const nextValue = normalizeDomFieldNumber(
        field,
        resolveDomFieldNumberValue(field) + resolveDomFieldStep(field) * direction,
      )
      setState({ numberDrafts: withoutKeys(state.numberDrafts, [field.key]) })
      updateValue(field, nextValue)
    },
    numberPointerDown(field, event) {
      ensureSelected()
      event.stopPropagation()

      if (!field.driven) {
        startNumberDrag({
          fieldKey: field.key,
          pointerId: event.pointerId,
          startX: event.clientX,
          startValue: resolveDomFieldNumberValue(field),
          lastStepDelta: 0,
        })
      }
    },
    rangeInput(field, rawValue) {
      const nextValue = Number(rawValue)

      if (Number.isFinite(nextValue)) {
        updateValue(field, nextValue)
      }
    },
    timeSegmentInput(field, segment, rawValue) {
      if (!field.driven) {
        setState({
          timeDrafts: {
            ...state.timeDrafts,
            [timeDraftKey(field, segment)]: sanitizeDomTimeSegment(rawValue),
          },
        })
      }
    },
    timeSegmentCommit(field) {
      if (field.driven) {
        return
      }

      const hoursKey = timeDraftKey(field, 'hours')
      const minutesKey = timeDraftKey(field, 'minutes')
      const current = parseDomTimeValue(field)
      const hours = normalizeDomTimeSegment(state.timeDrafts[hoursKey] ?? current.hours, 23)
      const minutes = normalizeDomTimeSegment(state.timeDrafts[minutesKey] ?? current.minutes, 59)

      setState({ timeDrafts: withoutKeys(state.timeDrafts, [hoursKey, minutesKey]) })
      updateValue(field, `${hours}:${minutes}`)
    },
    toggleSelect(field, event) {
      ensureSelected()
      event.preventDefault()
      event.stopPropagation()

      if (!field.driven) {
        setState({ openSelectKey: state.openSelectKey === field.key ? null : field.key })
      }
    },
    selectOption(field, optionValue, event) {
      event.preventDefault()
      event.stopPropagation()

      if (!field.driven) {
        updateValue(field, resolveDomFieldOptionValue(field, optionValue))
        setState({ openSelectKey: null })
      }
    },
    booleanChange(field, checked) {
      updateValue(field, checked)
    },
    downloadImage(field) {
      const url = resolveDomFieldImageUrl(field)
      const document = view?.document

      if (!url || !document) {
        return
      }

      const link = document.createElement('a')
      link.href = url
      link.download = `${field.key}-${Date.now()}.png`
      link.target = '_blank'
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
    },
    openImage(field) {
      const url = resolveDomFieldImageUrl(field)

      if (url) {
        view?.open(url, '_blank', 'noopener')
      }
    },
  }
}

function timeDraftKey(field: NodeEngineResolvedDomNodeField, segment: DomTimeSegment): string {
  return `${field.key}:${segment}`
}

function withoutKeys(
  record: Readonly<Record<string, string>>,
  keys: string[],
): Record<string, string> {
  const next = { ...record }

  for (const key of keys) {
    delete next[key]
  }

  return next
}
