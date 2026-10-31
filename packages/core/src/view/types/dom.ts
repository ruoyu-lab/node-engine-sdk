/** Declarative description of a DOM node: how its parameter fields look and how rows are laid out. */

export type NodeWrightDomNodeFieldSource = 'auto' | 'params' | 'data' | 'none'

export type NodeWrightDomFieldKind =
  'value' | 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'range' | 'time' | 'image'

export type NodeWrightDomImageFieldFit = 'cover' | 'contain'

/**
 * Display hint for the field of the node parameter with the same `key`. Hints never declare
 * fields: a hint without a matching `NodeDefinition.parameters` entry is ignored, and the value
 * domain (`options`) always comes from the parameter itself.
 */
export interface NodeWrightDomFieldDefinition {
  key: string
  label?: string
  description?: string
  kind?: NodeWrightDomFieldKind
  order?: number
  highlighted?: boolean
  placeholder?: string
  min?: number
  max?: number
  step?: number
  /**
   * Image field: aspect ratio (width / height). If omitted the image stretches
   * to fill the available row height.
   */
  aspectRatio?: number
  /** Image field: how the image fits its container. Defaults to 'cover'. */
  fit?: NodeWrightDomImageFieldFit
  /** Image field: render a download button. */
  downloadable?: boolean
  /** Image field: render an "open in new tab" button. */
  openable?: boolean
  /** Image field: text shown when the field has no image yet. */
  emptyHint?: string
}

export interface NodeWrightDomNodeLayoutDefinition {
  headerHeight?: number
  portTop?: number
  portGap?: number
  portInset?: number
  portBottomPadding?: number
  fieldPortGap?: number
  minFieldsTop?: number
  bottomPadding?: number
  fieldRowHeight?: number
  fieldRowGap?: number
  minWidth?: number
  minHeight?: number
}

export interface NodeWrightDomNodeDefinition {
  title?: string
  subtitle?: string
  fieldSource?: NodeWrightDomNodeFieldSource
  fields?: NodeWrightDomFieldDefinition[]
  maxVisibleFields?: number
  layout?: NodeWrightDomNodeLayoutDefinition
}
