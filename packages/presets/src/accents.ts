/**
 * Accent colours of the preset node families: the header marker of the default DOM node, the
 * minimap fill and the colour of edges from untyped ports. Each keeps at least 3:1 contrast
 * against both built-in node backgrounds, so it reads on the dark and the light palette.
 */
export const PRESET_NODE_ACCENTS = {
  dataflow: '#2f8fef',
  execflow: '#e0703a',
  function: '#9d6bf0',
  subgraph: '#14a38b',
} as const satisfies Record<string, string>
