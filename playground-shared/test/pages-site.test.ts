import { describe, expect, it } from 'vitest'
import { resolvePlaygroundSite } from '../config/pages-site'

describe('playground site', () => {
  it('serves each app on its own from the root without a companion link', () => {
    expect(resolvePlaygroundSite('vue', undefined)).toEqual({ base: '/', companion: null })
    expect(resolvePlaygroundSite('react', undefined)).toEqual({ base: '/', companion: null })
  })

  it('places the Vue app at the Pages root and the React app under react/', () => {
    expect(resolvePlaygroundSite('vue', '/node-wright/')).toEqual({
      base: '/node-wright/',
      companion: { label: 'React 版', href: '/node-wright/react/' },
    })
    expect(resolvePlaygroundSite('react', '/node-wright/')).toEqual({
      base: '/node-wright/react/',
      companion: { label: 'Vue 版', href: '/node-wright/' },
    })
  })

  it('supports a site served from the domain root', () => {
    expect(resolvePlaygroundSite('react', '/')).toEqual({
      base: '/react/',
      companion: { label: 'Vue 版', href: '/' },
    })
  })

  it('rejects a base that is not an absolute directory path', () => {
    for (const base of ['', 'node-wright/', '/node-wright', '//', 'https://example.com/']) {
      expect(() => resolvePlaygroundSite('vue', base)).toThrow(/PAGES_BASE/u)
    }
  })
})
