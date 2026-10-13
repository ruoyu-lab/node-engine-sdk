import type { PlaygroundCompanion } from '../../config/pages-site'

export type { PlaygroundCompanion }

/** Defined by the Vite config of each app from `resolvePlaygroundSite`. */
declare const __PLAYGROUND_COMPANION__: PlaygroundCompanion | null

/** The other framework's build on the same Pages site, or `null` when the app runs on its own. */
export const playgroundCompanion: PlaygroundCompanion | null = __PLAYGROUND_COMPANION__
