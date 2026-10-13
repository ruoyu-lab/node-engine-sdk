import type { GraphSnapshot } from '@node-engine-sdk/core/protocol'
import type {
  NodeEngineApi,
  NodeEngineContextMenuState,
  NodeEngineDomNodeProps,
  NodeEngineEditorOptions,
  NodeEngineEventMap,
  NodeEngineEventName,
  NodeEngineGridState,
  NodeEngineInteractionState,
  NodeEngineNodeEditorState,
  NodeEngineRenderContext,
  SelectionState,
} from '@node-engine-sdk/core/view'
import type { ComponentType, CSSProperties, ReactNode } from 'react'

type PascalCase<Name extends string> = Name extends `${infer Head}-${infer Tail}`
  ? `${Capitalize<Head>}${PascalCase<Tail>}`
  : Capitalize<Name>

/** React callback prop of an editor event: `graph-change` → `onGraphChange`. */
export type NodeEngineEventHandlerName<Name extends NodeEngineEventName> = `on${PascalCase<Name>}`

/**
 * Every editor event (`NodeEngineEventMap`) as an optional callback prop. `graph` together with
 * `onGraphChange` is the React counterpart of Vue's `v-model:graph`.
 */
export type NodeEngineEventHandlers = {
  [Name in NodeEngineEventName as NodeEngineEventHandlerName<Name>]?: (
    ...args: NodeEngineEventMap[Name]
  ) => void
}

/** Value of the `NodeEngine` ref: the imperative editor API. */
export type NodeEngineHandle = NodeEngineApi

/** A DOM node component, registered in `domComponents` under the key a DOM renderer names. */
export type NodeEngineDomComponent = ComponentType<NodeEngineDomNodeProps>

/** Arguments of `renderBackground`; the props of the Vue `background` slot. */
export interface NodeEngineBackgroundRenderProps {
  api: NodeEngineApi
  graph: GraphSnapshot
  readonly: boolean
  gridState: NodeEngineGridState
  interactionState: NodeEngineInteractionState
  nodeEditorState: NodeEngineNodeEditorState | null
  toggleGrid: () => void
  renderContext: NodeEngineRenderContext
}

/** Arguments of `renderOverlay`; the props of the Vue `overlay` slot. */
export interface NodeEngineOverlayRenderProps {
  api: NodeEngineApi
  graph: GraphSnapshot
  selection: SelectionState
  gridState: NodeEngineGridState
  interactionState: NodeEngineInteractionState
  nodeEditorState: NodeEngineNodeEditorState | null
  contextMenuState: NodeEngineContextMenuState | null
}

/**
 * Props of the React `NodeEngine` component: the editor options, every editor event as a
 * callback prop, and the React-only rendering concerns. Option objects and arrays are compared
 * by identity, so pass stable references (module constants, state or `useMemo`); a new registry
 * array (`nodeDefinitions`, `plugins`, ...) rebuilds the internal store and its history.
 */
export interface NodeEngineProps
  extends Omit<NodeEngineEditorOptions, 'onEvent'>, NodeEngineEventHandlers {
  ariaLabel?: string
  className?: string
  style?: CSSProperties
  /** DOM node components by the `component` key of their DOM renderers. */
  domComponents?: Readonly<Record<string, NodeEngineDomComponent>>
  /** Rendered between the canvases and the DOM node layer. */
  renderBackground?: (props: NodeEngineBackgroundRenderProps) => ReactNode
  /** Rendered above every editor layer, e.g. toolbars, context menus and node editors. */
  renderOverlay?: (props: NodeEngineOverlayRenderProps) => ReactNode
}
