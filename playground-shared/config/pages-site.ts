/** The two playground apps. The GitHub Pages site serves both builds side by side. */
export type PlaygroundApp = 'vue' | 'react'

/** The other framework's build of the playground on the same site, linked from the sidebar. */
export interface PlaygroundCompanion {
  label: string
  href: string
}

/** Where one app build is served. */
export interface PlaygroundSite {
  /** Vite `base` of the build. */
  base: string
  /** `null` when the app is served on its own (local dev, builds and E2E). */
  companion: PlaygroundCompanion | null
}

/** Directory of each app inside the site: the Vue app at the site root, the React app below it. */
const siteDirectories: Readonly<Record<PlaygroundApp, string>> = {
  vue: '',
  react: 'react/',
}

const appLabels: Readonly<Record<PlaygroundApp, string>> = {
  vue: 'Vue 版',
  react: 'React 版',
}

/**
 * Resolves the build base and the companion link of an app. `pagesBase` is the root path of the
 * GitHub Pages site, for example `/node-wright/` (the `PAGES_BASE` environment variable of the
 * Pages workflow); without it the app is served from `/` on its own.
 */
export function resolvePlaygroundSite(
  app: PlaygroundApp,
  pagesBase: string | undefined,
): PlaygroundSite {
  if (pagesBase === undefined) {
    return { base: '/', companion: null }
  }

  if (!/^\/(?:[^/]+\/)*$/u.test(pagesBase)) {
    throw new Error(
      `PAGES_BASE must be an absolute path that starts and ends with "/", received "${pagesBase}".`,
    )
  }

  const other: PlaygroundApp = app === 'vue' ? 'react' : 'vue'

  return {
    base: `${pagesBase}${siteDirectories[app]}`,
    companion: { label: appLabels[other], href: `${pagesBase}${siteDirectories[other]}` },
  }
}
