import { cloneValue, type GraphNode, type GraphSnapshot } from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import { computed, effect, signal, type ReadonlySignal } from '../reactive.js'
import type {
  NodeEngineBounds,
  NodeEngineEventSink,
  NodeEngineNodeEditorDefinition,
  NodeEngineNodeEditorFieldContext,
  NodeEngineNodeEditorInset,
  NodeEngineNodeEditorRegistry,
  NodeEngineNodeEditorState,
  NodeEngineRenderContext,
  NodeEngineResolvedNodeEditorField,
  NodeTypeRegistry,
  SelectionState,
} from '../types/index.js'
import {
  readParameterUiString,
  resolveParameterControlKind,
  resolveParameterLabel,
} from '../dom-model/parameter-display.js'
import type { EditorExtensions } from './extensions.js'
import type { ResolvedNodeEngineBehaviors } from './theme.js'
import { getNodeParams } from './values.js'

interface ResolvedNodeEditor {
  activateOn: NodeEngineNodeEditorState['activateOn']
  inset: NodeEngineNodeEditorInset
  fields: NodeEngineResolvedNodeEditorField[]
}

/**
 * Inline parameter editor of a node. It opens for the single selected node when its editor
 * activates on selection, or explicitly (double click, API) for editors with other triggers.
 */
export interface NodeEditorModel {
  readonly active: ReadonlySignal<NodeEngineNodeEditorState | null>
  readonly manualNodeId: ReadonlySignal<string | null>
  resolve: (node: GraphNode) => ResolvedNodeEditor | null
  open: (nodeId: string) => boolean
  close: () => void
  /** Closes the editor only when it currently edits `nodeId`. */
  closeFor: (nodeId: string) => void
  getState: () => NodeEngineNodeEditorState | null
  /** Emits open/close events and closes the editor when its node disappears. */
  start: () => () => void
}

export function createNodeEditorModel(options: {
  graph: ReadonlySignal<GraphSnapshot>
  getStore: () => GraphStore
  extensions: EditorExtensions
  behavior: ReadonlySignal<ResolvedNodeEngineBehaviors['editor']>
  readonly: () => boolean
  selection: ReadonlySignal<SelectionState>
  renderContext: ReadonlySignal<NodeEngineRenderContext>
  getScreenBounds: (nodeId: string) => NodeEngineBounds | null
  emit: NodeEngineEventSink
}): NodeEditorModel {
  const manualNodeId = signal<string | null>(null)

  function resolve(node: GraphNode): ResolvedNodeEditor | null {
    return resolveNodeEditor(node, {
      nodeEditors: options.extensions.nodeEditors.value,
      nodeTypes: options.extensions.nodeTypes.value,
      behavior: options.behavior.value,
      readonly: options.readonly(),
      context: options.renderContext.value,
    })
  }

  const active = computed<NodeEngineNodeEditorState | null>(() => {
    if (options.readonly() || !options.behavior.value.enabled) {
      return null
    }

    const store = options.getStore()
    const manualId = manualNodeId.value
    const manualNode = manualId ? store.getNode(manualId) : undefined
    const selection = options.selection.value
    const selectedNode =
      selection.nodes.length === 1 ? store.getNode(selection.nodes[0]!) : undefined
    const candidate = manualNode ?? selectedNode

    if (!candidate) {
      return null
    }

    const editor = resolve(candidate)

    if (!editor?.fields.length || (!manualNode && editor.activateOn !== 'selected')) {
      return null
    }

    const bounds = options.getScreenBounds(candidate.id)

    if (!bounds) {
      return null
    }

    return {
      nodeId: candidate.id,
      node: cloneValue(candidate),
      bounds,
      inset: editor.inset,
      activateOn: editor.activateOn,
      fields: editor.fields,
    }
  })

  function close(): void {
    manualNodeId.value = null
  }

  return {
    active,
    manualNodeId,
    resolve,
    open(nodeId) {
      const node = options.getStore().getNode(nodeId)

      if (!node || !resolve(node)) {
        return false
      }

      manualNodeId.value = nodeId
      return true
    },
    close,
    closeFor(nodeId) {
      if (active.peek()?.nodeId === nodeId || manualNodeId.peek() === nodeId) {
        close()
      }
    },
    getState: () => {
      const state = active.peek()
      return state ? cloneValue(state) : null
    },
    start() {
      let previous: NodeEngineNodeEditorState | null | undefined
      const stopEvents = effect(() => {
        const next = active.value

        if (previous === undefined) {
          previous = next
          return
        }

        if (previous && (!next || next.nodeId !== previous.nodeId)) {
          options.emit('node-editor-close', cloneValue(previous))
        }

        if (next && (!previous || next.nodeId !== previous.nodeId)) {
          options.emit('node-editor-open', cloneValue(next))
        }

        previous = next
      })
      const stopRemovalWatch = effect(() => {
        void options.graph.value
        const manualId = manualNodeId.peek()

        if (manualId && !options.getStore().getNode(manualId)) {
          close()
        }
      })

      return () => {
        stopEvents()
        stopRemovalWatch()
      }
    },
  }
}

/**
 * The editable fields are exactly the node definition's `parameters`, the same rule the default
 * DOM node uses for its fields; editor `fields` are display hints matched by parameter key.
 */
function resolveNodeEditor(
  node: GraphNode,
  options: {
    nodeEditors: NodeEngineNodeEditorRegistry
    nodeTypes: NodeTypeRegistry
    behavior: ResolvedNodeEngineBehaviors['editor']
    readonly: boolean
    context: NodeEngineRenderContext
  },
): ResolvedNodeEditor | null {
  const explicit = options.nodeEditors[node.type] ?? options.nodeTypes[node.type]?.editor

  if (explicit?.enabled === false) {
    return null
  }

  const parameters = options.context.api.definitions.nodes.get(node.type)?.parameters ?? []
  const hints = new Map((explicit?.fields ?? []).map((hint) => [hint.key, hint]))
  const params = getNodeParams(node)
  const fields: NodeEngineResolvedNodeEditorField[] = []
  const maxFields = explicit?.maxFields ?? options.behavior.defaultMaxFields

  for (const parameter of parameters) {
    if (fields.length >= maxFields) {
      break
    }

    const hint = hints.get(parameter.key)
    const value = params[parameter.key]
    const fieldContext: NodeEngineNodeEditorFieldContext = {
      node,
      key: parameter.key,
      value,
      readonly: options.readonly,
      context: options.context,
    }

    if (hint?.visible && !hint.visible(fieldContext)) {
      continue
    }

    fields.push({
      key: parameter.key,
      label: hint?.label ?? resolveParameterLabel(parameter),
      type: hint?.type ?? resolveParameterControlKind(parameter.kind),
      placeholder: hint?.placeholder ?? readParameterUiString(parameter, 'placeholder'),
      rows: hint?.rows,
      step: hint?.step,
      min: hint?.min,
      max: hint?.max,
      parse: hint?.parse,
      disabled: Boolean(hint?.disabled?.(fieldContext)),
      options: parameter.options,
      value,
    })
  }

  if (!fields.length) {
    return null
  }

  return {
    activateOn: resolveNodeEditorActivateOn(explicit, options.behavior.defaultActivateOn),
    inset: resolveNodeEditorInset(explicit, options.behavior.defaultInset),
    fields,
  }
}

function resolveNodeEditorActivateOn(
  definition: NodeEngineNodeEditorDefinition | undefined,
  defaultActivateOn: NodeEngineNodeEditorState['activateOn'],
): NodeEngineNodeEditorState['activateOn'] {
  return definition?.activateOn ?? defaultActivateOn
}

function resolveNodeEditorInset(
  definition: NodeEngineNodeEditorDefinition | undefined,
  defaultInset: NodeEngineNodeEditorInset,
): NodeEngineNodeEditorInset {
  return {
    top: definition?.inset?.top ?? defaultInset.top,
    right: definition?.inset?.right ?? defaultInset.right,
    bottom: definition?.inset?.bottom ?? defaultInset.bottom,
    left: definition?.inset?.left ?? defaultInset.left,
  }
}
