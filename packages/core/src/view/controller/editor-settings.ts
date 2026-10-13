import { computed, signal, type ReadonlySignal, type Signal } from '../reactive.js'
import type { GraphCanvasTheme } from '../rendering/graph-canvas.js'
import type {
  NodeEngineCanvasEdgeTheme,
  NodeEngineCanvasGroupTheme,
  NodeEngineCanvasNodeTheme,
  NodeEngineColorScheme,
  NodeEngineEditorOptions,
  NodeEngineNodeStatus,
  NodeEngineStyleDeclaration,
} from '../types/index.js'
import type { GridSnapping } from './interactions/drag.js'
import { resolveEditorOptions, type ResolvedEditorOptions } from './options.js'
import {
  resolveBehaviorOptions,
  resolveCanvasEdgeTheme,
  resolveCanvasGroupTheme,
  resolveCanvasNodeTheme,
  resolveColorScheme,
  resolveGraphCanvasTheme,
  resolveGridColors,
  resolvePerformanceOptions,
  resolveRootStyle,
  type ResolvedNodeEngineBehaviors,
  type ResolvedNodeEngineGridColors,
  type ResolvedNodeEnginePerformanceOptions,
} from './theme.js'

/** The current editor options and every setting derived from them. */
export interface EditorSettings {
  readonly options: Signal<ResolvedEditorOptions>
  readonly readonly: ReadonlySignal<boolean>
  readonly nodeStatus: ReadonlySignal<Readonly<Record<string, NodeEngineNodeStatus>>>
  readonly colorScheme: ReadonlySignal<NodeEngineColorScheme>
  readonly behaviors: ReadonlySignal<ResolvedNodeEngineBehaviors>
  readonly groupBehaviors: ReadonlySignal<ResolvedNodeEngineBehaviors['group']>
  readonly editorBehavior: ReadonlySignal<ResolvedNodeEngineBehaviors['editor']>
  readonly performance: ReadonlySignal<ResolvedNodeEnginePerformanceOptions>
  readonly graphTheme: ReadonlySignal<GraphCanvasTheme>
  readonly nodeTheme: ReadonlySignal<NodeEngineCanvasNodeTheme>
  readonly edgeTheme: ReadonlySignal<NodeEngineCanvasEdgeTheme>
  readonly groupTheme: ReadonlySignal<NodeEngineCanvasGroupTheme>
  readonly gridColors: ReadonlySignal<ResolvedNodeEngineGridColors>
  readonly rootStyle: ReadonlySignal<NodeEngineStyleDeclaration>
  isReadonly: () => boolean
  getSnapping: () => GridSnapping
  getZoomRange: () => { minZoom: number; maxZoom: number }
  getGroupMinimumSize: () => { width: number; height: number }
}

export function createEditorSettings(input: NodeEngineEditorOptions): EditorSettings {
  const options = signal(resolveEditorOptions(input))
  const readonly = computed(() => options.value.readonly)
  const behaviors = computed(() => resolveBehaviorOptions(options.value.behaviors))
  const groupBehaviors = computed(() => behaviors.value.group)
  const graphTheme = computed(() => resolveGraphCanvasTheme(options.value.theme))

  return {
    options,
    readonly,
    nodeStatus: computed(() => options.value.nodeStatus),
    colorScheme: computed(() => resolveColorScheme(options.value.theme)),
    behaviors,
    groupBehaviors,
    editorBehavior: computed(() => behaviors.value.editor),
    performance: computed(() => resolvePerformanceOptions(options.value.performance)),
    graphTheme,
    nodeTheme: computed(() => resolveCanvasNodeTheme(options.value.theme)),
    edgeTheme: computed(() => resolveCanvasEdgeTheme(graphTheme.value)),
    groupTheme: computed(() => resolveCanvasGroupTheme(graphTheme.value)),
    gridColors: computed(() =>
      resolveGridColors({ gridColor: options.value.gridColor, theme: options.value.theme }),
    ),
    rootStyle: computed(() =>
      resolveRootStyle({
        canvasBackground: options.value.canvasBackground,
        theme: options.value.theme,
      }),
    ),
    isReadonly: () => readonly.value,
    getSnapping: () => ({ enabled: options.value.snapToGrid, size: options.value.gridSize }),
    getZoomRange: () => ({ minZoom: options.value.minZoom, maxZoom: options.value.maxZoom }),
    getGroupMinimumSize: () => ({
      width: groupBehaviors.value.minWidth,
      height: groupBehaviors.value.minHeight,
    }),
  }
}
