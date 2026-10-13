/** One path of a 16 × 16 icon; outlined paths are stroked with the text colour, solid ones filled. */
export interface PlaygroundIconPath {
  d: string
  solid?: boolean
}

const iconPaths = {
  play: [
    {
      d: 'M5 3.6c0-.7.8-1.1 1.4-.7l6 4.2c.5.4.5 1.1 0 1.5l-6 4.2c-.6.4-1.4 0-1.4-.7z',
      solid: true,
    },
  ],
  layout: [
    { d: 'M2.5 3.5a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1z' },
    { d: 'M9 10a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1v2.5a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1z' },
    { d: 'M7 4.75h2.25a2 2 0 0 1 2 2V9' },
  ],
  fit: [
    { d: 'M2.5 5.5v-2a1 1 0 0 1 1-1h2' },
    { d: 'M10.5 2.5h2a1 1 0 0 1 1 1v2' },
    { d: 'M13.5 10.5v2a1 1 0 0 1-1 1h-2' },
    { d: 'M5.5 13.5h-2a1 1 0 0 1-1-1v-2' },
    { d: 'M6 6.5h4v3H6z' },
  ],
  reset: [{ d: 'M2.75 8.25A5.25 5.25 0 1 0 4.4 4.2' }, { d: 'M2.5 2.25v3h3' }],
  undo: [{ d: 'M5.75 9.25 2.5 6l3.25-3.25' }, { d: 'M2.5 6h6.75a3.5 3.5 0 0 1 0 7H7' }],
  redo: [{ d: 'm10.25 9.25 3.25-3.25-3.25-3.25' }, { d: 'M13.5 6H6.75a3.5 3.5 0 0 0 0 7H9' }],
  import: [
    { d: 'M13.5 10v2.25a1.25 1.25 0 0 1-1.25 1.25h-8.5a1.25 1.25 0 0 1-1.25-1.25V10' },
    { d: 'M8 2.5v7.25' },
    { d: 'M5 6.75 8 9.75l3-3' },
  ],
  export: [
    { d: 'M13.5 10v2.25a1.25 1.25 0 0 1-1.25 1.25h-8.5a1.25 1.25 0 0 1-1.25-1.25V10' },
    { d: 'M8 9.75V2.5' },
    { d: 'M5 5.5 8 2.5l3 3' },
  ],
  sun: [
    { d: 'M8 5.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5z' },
    {
      d: 'M8 1.75v1.25M8 13v1.25M1.75 8H3M13 8h1.25M3.6 3.6l.9.9M11.5 11.5l.9.9M3.6 12.4l.9-.9M11.5 4.5l.9-.9',
    },
  ],
  moon: [{ d: 'M13.25 9.6A5.5 5.5 0 1 1 6.4 2.75a4.5 4.5 0 0 0 6.85 6.85z' }],
  plus: [{ d: 'M8 3.5v9M3.5 8h9' }],
  minus: [{ d: 'M3.5 8h9' }],
  chevronLeft: [{ d: 'M9.75 3.75 5.5 8l4.25 4.25' }],
  chevronRight: [{ d: 'M6.25 3.75 10.5 8l-4.25 4.25' }],
  chevronUp: [{ d: 'M3.75 9.75 8 5.5l4.25 4.25' }],
  chevronDown: [{ d: 'M3.75 6.25 8 10.5l4.25-4.25' }],
  keyboard: [
    { d: 'M2.5 4h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z' },
    { d: 'M4.5 6.75h.5M7.25 6.75h.5M10 6.75h.5M5.5 9.25h5' },
  ],
  activity: [{ d: 'M1.75 8.5h2.5l1.75-4.5 3.5 8.5 1.75-4h3' }],
  external: [{ d: 'M6 10 10.75 5.25' }, { d: 'M6.5 5h4.5v4.5' }],
  panel: [
    { d: 'M3 2.5h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z' },
    { d: 'M10 2.5v11' },
  ],
  close: [{ d: 'M4.25 4.25l7.5 7.5M11.75 4.25l-7.5 7.5' }],
} satisfies Record<string, readonly PlaygroundIconPath[]>

export type PlaygroundIconName = keyof typeof iconPaths

/** Inline icons of the playground chrome; both apps render them with their `PlaygroundIcon`. */
export const playgroundIcons: Readonly<Record<PlaygroundIconName, readonly PlaygroundIconPath[]>> =
  iconPaths
