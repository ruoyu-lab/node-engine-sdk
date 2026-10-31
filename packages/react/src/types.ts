import type { GraphSnapshot } from '@node-wright/core/protocol'
import type {
  NodeWrightApi,
  NodeWrightContextMenuState,
  NodeWrightDomNodeProps,
  NodeWrightEditorOptions,
  NodeWrightEventMap,
  NodeWrightEventName,
  NodeWrightGridState,
  NodeWrightInteractionState,
  NodeWrightNodeEditorState,
  NodeWrightRenderContext,
  SelectionState,
} from '@node-wright/core/view'
import type { ComponentType, CSSProperties, ReactNode } from 'react'

type PascalCase<Name extends string> = Name extends `${infer Head}-${infer Tail}`
  ? `${Capitalize<Head>}${PascalCase<Tail>}`
  : Capitalize<Name>

/** React callback prop of an editor event: `graph-change` → `onGraphChange`. */
export type NodeWrightEventHandlerName<Name extends NodeWrightEventName> = `on${PascalCase<Name>}`

/**
 * Every editor event (`NodeWrightEventMap`) as an optional callback prop. `graph` together with
 * `onGraphChange` is the React counterpart of Vue's `v-model:graph`.
 */
export type NodeWrightEventHandlers = {
  [Name in NodeWrightEventName as NodeWrightEventHandlerName<Name>]?: (
    ...args: NodeWrightEventMap[Name]
  ) => void
}

/** Value of the `NodeWright` ref: the imperative editor API. */
export type NodeWrightHandle = NodeWrightApi

/** A DOM node component, registered in `domComponents` under the key a DOM renderer names. */
export type NodeWrightDomComponent = ComponentType<NodeWrightDomNodeProps>

/** Arguments of `renderBackground`; the props of the Vue `background` slot. */
export interface NodeWrightBackgroundRenderProps {
  api: NodeWrightApi
  graph: GraphSnapshot
  readonly: boolean
  gridState: NodeWrightGridState
  interactionState: NodeWrightInteractionState
  nodeEditorState: NodeWrightNodeEditorState | null
  toggleGrid: () => void
  renderContext: NodeWrightRenderContext
}

/** Arguments of `renderOverlay`; the props of the Vue `overlay` slot. */
export interface NodeWrightOverlayRenderProps {
  api: NodeWrightApi
  graph: GraphSnapshot
  selection: SelectionState
  gridState: NodeWrightGridState
  interactionState: NodeWrightInteractionState
  nodeEditorState: NodeWrightNodeEditorState | null
  contextMenuState: NodeWrightContextMenuState | null
}

/**
 * Props of the React `NodeWright` component: the editor options, every editor event as a
 * callback prop, and the React-only rendering concerns. Option objects and arrays are compared
 * by identity, so pass stable references (module constants, state or `useMemo`); a new registry
 * array (`nodeDefinitions`, `plugins`, ...) rebuilds the internal store and its history.
 */
export interface NodeWrightProps
  extends Omit<NodeWrightEditorOptions, 'onEvent'>, NodeWrightEventHandlers {
  ariaLabel?: string
  className?: string
  style?: CSSProperties
  /** DOM node components by the `component` key of their DOM renderers. */
  domComponents?: Readonly<Record<string, NodeWrightDomComponent>>
  /** Rendered between the canvases and the DOM node layer. */
  renderBackground?: (props: NodeWrightBackgroundRenderProps) => ReactNode
  /** Rendered above every editor layer, e.g. toolbars, context menus and node editors. */
  renderOverlay?: (props: NodeWrightOverlayRenderProps) => ReactNode
}
