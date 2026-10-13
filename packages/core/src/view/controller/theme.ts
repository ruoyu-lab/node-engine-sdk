import type {
  NodeEngineBehaviors,
  NodeEngineCanvasEdgeTheme,
  NodeEngineCanvasGroupTheme,
  NodeEngineCanvasNodeTheme,
  NodeEngineColorScheme,
  NodeEngineEdgeRightClickAction,
  NodeEngineGridState,
  NodeEngineMarqueeGesture,
  NodeEngineNodeEditorActivateOn,
  NodeEngineNodeEditorInset,
  NodeEnginePerformanceOptions,
  NodeEngineSelectionMode,
  NodeEngineStyleDeclaration,
  NodeEngineTheme,
  ViewportState,
} from '../types/index.js'
import type { GraphCanvasTheme } from '../rendering/graph-canvas.js'
import { withAlpha } from '../rendering/color.js'

/** Built-in palettes and the resolution of theme, behavior, grid and performance options. */

/**
 * Every colour of one built-in palette. `theme.colorScheme` picks the palette and every other
 * `NodeEngineTheme` key overrides one entry. The DOM side of the editor (default node, minimap,
 * marquee) reads the matching CSS custom properties from `style.css`, selected by the root's
 * `data-color-scheme` attribute.
 */
interface NodeEnginePalette {
  background: string
  grid: string
  gridMajor: string
  edge: string
  edgeActive: string
  execEdge: string
  draftEdge: string
  draftEdgeGlow: string
  selection: string
  marquee: string
  marqueeBorder: string
  groupBackground: string
  groupBorder: string
  groupLabel: string
  minimapNode: string
  nodeBackground: string
  nodeBorder: string
  nodeSelectedBorder: string
  nodeShadow: string
  nodeTitle: string
  nodeSubtitle: string
  nodeMeta: string
  portFill: string
  portStroke: string
  portLabel: string
  portActive: string
  portActiveFill: string
  portConnected: string
  portConnectedDot: string
}

const DARK_PALETTE: Readonly<NodeEnginePalette> = {
  background: '#111214',
  grid: '#1f2126',
  gridMajor: '#2b2e35',
  edge: '#5d626d',
  edgeActive: '#2fa66a',
  execEdge: '#d4d7dd',
  draftEdge: '#8b93ff',
  draftEdgeGlow: 'rgba(139, 147, 255, 0.28)',
  selection: '#8b93ff',
  marquee: 'rgba(139, 147, 255, 0.08)',
  marqueeBorder: 'rgba(139, 147, 255, 0.7)',
  groupBackground: 'rgba(255, 255, 255, 0.022)',
  groupBorder: '#2d3037',
  groupLabel: '#a3a7b1',
  minimapNode: '#4a4e58',
  nodeBackground: '#1a1b1f',
  nodeBorder: '#2c2e35',
  nodeSelectedBorder: '#8b93ff',
  nodeShadow: '#000000',
  nodeTitle: '#ecedf0',
  nodeSubtitle: '#a3a7b1',
  nodeMeta: '#737884',
  portFill: '#111214',
  portStroke: '#5d626d',
  portLabel: '#c2c5cc',
  portActive: '#8b93ff',
  portActiveFill: '#ffffff',
  portConnected: '#8b93ff',
  portConnectedDot: '#ffffff',
}

const LIGHT_PALETTE: Readonly<NodeEnginePalette> = {
  background: '#f5f6f8',
  grid: '#dcdfe5',
  gridMajor: '#c9cdd5',
  edge: '#9097a3',
  edgeActive: '#1f8a55',
  execEdge: '#424854',
  draftEdge: '#4b53d6',
  draftEdgeGlow: 'rgba(75, 83, 214, 0.22)',
  selection: '#4b53d6',
  marquee: 'rgba(75, 83, 214, 0.07)',
  marqueeBorder: 'rgba(75, 83, 214, 0.6)',
  groupBackground: 'rgba(17, 24, 39, 0.025)',
  groupBorder: '#d3d7de',
  groupLabel: '#596070',
  minimapNode: '#b4bac5',
  nodeBackground: '#ffffff',
  nodeBorder: '#dfe2e8',
  nodeSelectedBorder: '#4b53d6',
  nodeShadow: '#1a2233',
  nodeTitle: '#16181d',
  nodeSubtitle: '#596070',
  nodeMeta: '#8a909c',
  portFill: '#ffffff',
  portStroke: '#9097a3',
  portLabel: '#3b404b',
  portActive: '#4b53d6',
  portActiveFill: '#ffffff',
  portConnected: '#4b53d6',
  portConnectedDot: '#ffffff',
}

export function resolveColorScheme(
  theme: Partial<NodeEngineTheme> | undefined,
): NodeEngineColorScheme {
  return theme?.colorScheme === 'light' ? 'light' : 'dark'
}

function resolvePalette(theme: Partial<NodeEngineTheme> | undefined): Readonly<NodeEnginePalette> {
  return resolveColorScheme(theme) === 'light' ? LIGHT_PALETTE : DARK_PALETTE
}

export interface ResolvedNodeEngineBehaviors {
  marquee: {
    gestures: NodeEngineMarqueeGesture[]
    selectionMode: NodeEngineSelectionMode
  }
  edge: {
    rightClickAction: NodeEngineEdgeRightClickAction
  }
  group: {
    dragHandle: 'header' | 'body'
    headerHeight: number
    moveNodesOnDrag: boolean
    resizable: boolean
    minWidth: number
    minHeight: number
    showCloseButton: boolean
    showCollapseButton: boolean
  }
  grid: {
    adaptive: boolean
    minPixelStep: number
    maxPixelStep: number
    majorEvery: number
    style: 'line' | 'dash' | 'dot'
  }
  editor: {
    enabled: boolean
    defaultActivateOn: NodeEngineNodeEditorActivateOn
    defaultInset: NodeEngineNodeEditorInset
    defaultMaxFields: number
  }
}

export interface ResolvedNodeEnginePerformanceOptions {
  enabled: boolean
  overlay: boolean
  overlayMinWidth: number
  overlayDismissible: boolean
  sampleWindow: number
  cullPadding: number
}

export interface ResolvedNodeEngineGridColors {
  minor: string
  major: string
}

export function resolveGraphCanvasTheme(
  theme: Partial<NodeEngineTheme> | undefined,
): GraphCanvasTheme {
  const palette = resolvePalette(theme)

  return {
    edgeColor: theme?.edgeColor || palette.edge,
    edgeActiveColor: theme?.edgeActiveColor || palette.edgeActive,
    execEdgeColor: theme?.execEdgeColor || palette.execEdge,
    draftEdgeColor: theme?.draftEdgeColor || palette.draftEdge,
    draftEdgeGlowColor: theme?.draftEdgeGlowColor || palette.draftEdgeGlow,
    selectionColor: theme?.selectionColor || palette.selection,
    groupBackground: theme?.groupBackground || palette.groupBackground,
    groupBorderColor: theme?.groupBorderColor || palette.groupBorder,
    groupLabelColor: theme?.groupLabelColor || palette.groupLabel,
    minimapNodeColor: theme?.minimapNodeColor || palette.minimapNode,
  }
}

export function resolveCanvasNodeTheme(
  theme: Partial<NodeEngineTheme> | undefined,
): NodeEngineCanvasNodeTheme {
  const palette = resolvePalette(theme)

  return {
    background: theme?.nodeBackground || palette.nodeBackground,
    border: theme?.nodeBorderColor || palette.nodeBorder,
    borderSelected: theme?.nodeSelectedBorderColor || palette.nodeSelectedBorder,
    shadow: theme?.nodeShadowColor || palette.nodeShadow,
    title: theme?.nodeTitleColor || palette.nodeTitle,
    subtitle: theme?.nodeSubtitleColor || palette.nodeSubtitle,
    meta: theme?.nodeMetaColor || palette.nodeMeta,
    portFill: theme?.portFillColor || palette.portFill,
    portStroke: theme?.portStrokeColor || palette.portStroke,
    portLabel: theme?.portLabelColor || palette.portLabel,
    portActive: theme?.portActiveColor || palette.portActive,
    portActiveFill: theme?.portActiveFillColor || palette.portActiveFill,
    portConnected: theme?.portConnectedColor || palette.portConnected,
    portConnectedDot: theme?.portConnectedDotColor || palette.portConnectedDot,
    exec: theme?.execEdgeColor || palette.execEdge,
  }
}

export function resolveCanvasEdgeTheme(theme: GraphCanvasTheme): NodeEngineCanvasEdgeTheme {
  return {
    stroke: theme.edgeColor,
    activeStroke: theme.edgeActiveColor,
    execStroke: theme.execEdgeColor,
    draftStroke: theme.draftEdgeColor,
    draftGlow: theme.draftEdgeGlowColor,
    selection: theme.selectionColor,
  }
}

export function resolveCanvasGroupTheme(theme: GraphCanvasTheme): NodeEngineCanvasGroupTheme {
  return {
    background: theme.groupBackground,
    border: theme.groupBorderColor,
    label: theme.groupLabelColor,
  }
}

export function resolveBehaviorOptions(
  behaviors: Partial<NodeEngineBehaviors> | undefined,
): ResolvedNodeEngineBehaviors {
  return {
    marquee: {
      gestures: behaviors?.marquee?.gestures ?? ['space-left', 'middle'],
      selectionMode: behaviors?.marquee?.selectionMode ?? 'replace',
    },
    edge: {
      rightClickAction: behaviors?.edge?.rightClickAction ?? 'disconnect',
    },
    group: {
      dragHandle: behaviors?.group?.dragHandle ?? 'header',
      headerHeight: Math.max(behaviors?.group?.headerHeight ?? 40, 20),
      moveNodesOnDrag: behaviors?.group?.moveNodesOnDrag !== false,
      resizable: behaviors?.group?.resizable !== false,
      minWidth: Math.max(behaviors?.group?.minWidth ?? 180, 48),
      minHeight: Math.max(behaviors?.group?.minHeight ?? 120, 40),
      showCloseButton: behaviors?.group?.showCloseButton !== false,
      showCollapseButton: behaviors?.group?.showCollapseButton !== false,
    },
    grid: {
      adaptive: behaviors?.grid?.adaptive !== false,
      minPixelStep: Math.max(behaviors?.grid?.minPixelStep ?? 16, 4),
      maxPixelStep: Math.max(behaviors?.grid?.maxPixelStep ?? 48, 8),
      majorEvery: Math.max(behaviors?.grid?.majorEvery ?? 4, 1),
      style: behaviors?.grid?.style ?? 'dot',
    },
    editor: {
      enabled: behaviors?.editor?.enabled !== false,
      defaultActivateOn: behaviors?.editor?.defaultActivateOn ?? 'selected',
      defaultInset: {
        top: behaviors?.editor?.defaultInset?.top ?? 78,
        right: behaviors?.editor?.defaultInset?.right ?? 14,
        bottom: behaviors?.editor?.defaultInset?.bottom ?? 14,
        left: behaviors?.editor?.defaultInset?.left ?? 14,
      },
      defaultMaxFields: Math.max(behaviors?.editor?.defaultMaxFields ?? 6, 1),
    },
  }
}

export function resolvePerformanceOptions(
  performance: Partial<NodeEnginePerformanceOptions> | undefined,
): ResolvedNodeEnginePerformanceOptions {
  return {
    enabled: Boolean(performance?.enabled),
    overlay: Boolean(performance?.overlay),
    overlayMinWidth: Math.max(performance?.overlayMinWidth ?? 0, 0),
    overlayDismissible: Boolean(performance?.overlayDismissible),
    sampleWindow: Math.max(performance?.sampleWindow ?? 30, 1),
    cullPadding: Math.max(performance?.cullPadding ?? 240, 0),
  }
}

export function resolveGridColors(options: {
  gridColor: string
  theme: Partial<NodeEngineTheme> | undefined
}): ResolvedNodeEngineGridColors {
  const palette = resolvePalette(options.theme)
  const customMinor = options.gridColor || options.theme?.gridColor

  return {
    minor: customMinor || palette.grid,
    major:
      options.theme?.gridMajorColor ||
      (customMinor ? resolveDefaultMajorGridColor(customMinor, palette) : palette.gridMajor),
  }
}

export function resolveGridState(options: {
  viewport: ViewportState
  gridVisible: boolean
  gridSize: number
  behavior: ResolvedNodeEngineBehaviors['grid']
}): NodeEngineGridState {
  const zoom = options.viewport.zoom
  const baseStep = Math.max(options.gridSize, 1)
  let step = baseStep

  if (options.behavior.adaptive) {
    while (step * zoom < options.behavior.minPixelStep) {
      step *= 2
    }

    while (step * zoom > options.behavior.maxPixelStep && step > baseStep / 32) {
      step /= 2
    }
  }

  const majorEvery = options.behavior.majorEvery

  return {
    visible: options.gridVisible,
    adaptive: options.behavior.adaptive,
    baseStep,
    step,
    pixelStep: step * zoom,
    majorEvery,
    majorStep: step * majorEvery,
    majorPixelStep: step * majorEvery * zoom,
    style: options.behavior.style,
  }
}

export function resolveRootStyle(options: {
  canvasBackground: string
  theme: Partial<NodeEngineTheme> | undefined
}): NodeEngineStyleDeclaration {
  const palette = resolvePalette(options.theme)

  return {
    '--ne-background': options.canvasBackground || options.theme?.background || palette.background,
    '--ne-marquee': options.theme?.marqueeColor || palette.marquee,
    '--ne-marquee-border': options.theme?.marqueeBorderColor || palette.marqueeBorder,
  }
}

/** Hex minor grid colours derive a translucent major colour; other syntaxes use the palette's. */
function resolveDefaultMajorGridColor(minor: string, palette: NodeEnginePalette): string {
  return /^#(?:[\da-f]{3}|[\da-f]{6})$/iu.test(minor) ? withAlpha(minor, 0.12) : palette.gridMajor
}
