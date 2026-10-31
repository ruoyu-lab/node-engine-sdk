import { computed, type ReadonlySignal } from '../reactive.js'
import type {
  EdgeTypeRegistry,
  NodeWrightCanvasRenderers,
  NodeWrightContextMenuItem,
  NodeWrightEdgeRendererContribution,
  NodeWrightGroupRendererContribution,
  NodeWrightHotkey,
  NodeWrightNodeEditorRegistry,
  NodeWrightPlugin,
  NodeWrightToolbarItem,
  NodeTypeDefinition,
  NodeTypeRegistry,
} from '../types/index.js'
import { mergeNodeRenderer } from '../rendering/entries.js'
import type { ResolvedEditorOptions } from './options.js'

/**
 * Extension registries merged from plugin `components` contributions and direct options.
 * Direct options win over plugins; later entries with the same id replace earlier ones.
 */
export interface EditorExtensions {
  readonly nodeTypes: ReadonlySignal<NodeTypeRegistry>
  readonly nodeEditors: ReadonlySignal<NodeWrightNodeEditorRegistry>
  readonly edgeTypes: ReadonlySignal<EdgeTypeRegistry>
  readonly renderers: ReadonlySignal<NodeWrightCanvasRenderers>
  readonly groupRenderers: ReadonlySignal<NodeWrightGroupRendererContribution[]>
  readonly edgeRenderers: ReadonlySignal<NodeWrightEdgeRendererContribution[]>
  readonly toolbarItems: ReadonlySignal<NodeWrightToolbarItem[]>
  readonly contextMenuItems: ReadonlySignal<NodeWrightContextMenuItem[]>
  /** Built-in, plugin and direct hotkeys, highest priority first. */
  readonly hotkeys: ReadonlySignal<NodeWrightHotkey[]>
  /** Node type definition with the editor-wide canvas node renderer filled in. */
  resolveNodeType: (type: string) => NodeTypeDefinition | undefined
}

export function createEditorExtensions(options: {
  options: ReadonlySignal<ResolvedEditorOptions>
  builtInHotkeys: readonly NodeWrightHotkey[]
}): EditorExtensions {
  const plugins = computed(() => options.options.value.plugins)
  const contributions = <Value>(
    select: (plugin: NodeWrightPlugin) => readonly Value[] | undefined,
  ) => plugins.value.flatMap((plugin) => select(plugin) ?? [])

  const nodeTypes = computed<NodeTypeRegistry>(() => ({
    ...mergePluginRecords(plugins.value, (plugin) => plugin.components?.nodeTypes),
    ...options.options.value.nodeTypes,
  }))
  const renderers = computed<NodeWrightCanvasRenderers>(() => ({
    ...plugins.value.reduce<NodeWrightCanvasRenderers>(
      (merged, plugin) => ({ ...merged, ...plugin.components?.renderers }),
      {},
    ),
    ...options.options.value.renderers,
  }))

  /**
   * Node types merged with the global canvas node renderer, memoized until either registry
   * changes so every type resolves to one identity (DOM model caches compare it).
   */
  const nodeTypeResolver = computed(() => {
    const types = nodeTypes.value
    const renderer = renderers.value.node
    const resolved = new Map<string, NodeTypeDefinition | undefined>()

    return (type: string): NodeTypeDefinition | undefined => {
      if (!resolved.has(type)) {
        resolved.set(type, mergeNodeRenderer(types[type], renderer))
      }

      return resolved.get(type)
    }
  })

  return {
    nodeTypes,
    nodeEditors: computed(() => ({
      ...mergePluginRecords(plugins.value, (plugin) => plugin.components?.nodeEditors),
      ...options.options.value.nodeEditors,
    })),
    edgeTypes: computed(() => ({
      ...mergePluginRecords(plugins.value, (plugin) => plugin.components?.edgeTypes),
      ...options.options.value.edgeTypes,
    })),
    renderers,
    groupRenderers: computed(() =>
      mergeById([
        ...contributions((plugin) => plugin.components?.groupRenderers),
        ...options.options.value.groupRenderers,
      ]),
    ),
    edgeRenderers: computed(() =>
      mergeById([
        ...contributions((plugin) => plugin.components?.edgeRenderers),
        ...options.options.value.edgeRenderers,
      ]),
    ),
    toolbarItems: computed(() =>
      mergeById([
        ...contributions((plugin) => plugin.components?.toolbarItems),
        ...options.options.value.toolbarItems,
      ]),
    ),
    contextMenuItems: computed(() =>
      mergeById([
        ...contributions((plugin) => plugin.components?.contextMenuItems),
        ...options.options.value.contextMenuItems,
      ]),
    ),
    hotkeys: computed(() =>
      mergeHotkeys([
        ...options.builtInHotkeys,
        ...contributions((plugin) => plugin.components?.hotkeys),
        ...options.options.value.hotkeys,
      ]),
    ),
    resolveNodeType: (type) => nodeTypeResolver.value(type),
  }
}

/** Last entry per id wins and moves to the end; the result is ordered by `order`. */
function mergeById<T extends { id: string; order?: number }>(items: T[]): T[] {
  return [...dedupeById(items).values()].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0),
  )
}

function mergeHotkeys(items: NodeWrightHotkey[]): NodeWrightHotkey[] {
  return [...dedupeById(items).values()].sort(
    (left, right) => (right.priority ?? 0) - (left.priority ?? 0),
  )
}

function dedupeById<T extends { id: string }>(items: T[]): Map<string, T> {
  const registry = new Map<string, T>()

  for (const item of items) {
    registry.delete(item.id)
    registry.set(item.id, item)
  }

  return registry
}

function mergePluginRecords<Value>(
  plugins: readonly NodeWrightPlugin[],
  select: (plugin: NodeWrightPlugin) => Record<string, Value> | undefined,
): Record<string, Value> {
  return plugins.reduce<Record<string, Value>>(
    (registry, plugin) => ({ ...registry, ...select(plugin) }),
    {},
  )
}
