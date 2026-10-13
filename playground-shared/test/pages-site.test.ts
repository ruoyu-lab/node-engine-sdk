import { describe, expect, it } from 'vitest'
import { resolvePlaygroundSite } from '../config/pages-site'

describe('playground site', () => {
  it('serves each app on its own from the root without a companion link', () => {
    expect(resolvePlaygroundSite('vue', undefined)).toEqual({ base: '/', companion: null })
    expect(resolvePlaygroundSite('react', undefined)).toEqual({ base: '/', companion: null })
  })

  it('places the Vue app at the Pages root and the React app under react/', () => {
    expect(resolvePlaygroundSite('vue', '/node-engine-sdk/')).toEqual({
      base: '/node-engine-sdk/',
      companion: { label: 'React 版', href: '/node-engine-sdk/react/' },
    })
    expect(resolvePlaygroundSite('react', '/node-engine-sdk/')).toEqual({
      base: '/node-engine-sdk/react/',
      companion: { label: 'Vue 版', href: '/node-engine-sdk/' },
    })
  })

  it('supports a site served from the domain root', () => {
    expect(resolvePlaygroundSite('react', '/')).toEqual({
      base: '/react/',
      companion: { label: 'Vue 版', href: '/' },
    })
  })

  it('rejects a base that is not an absolute directory path', () => {
    for (const base of ['', 'node-engine-sdk/', '/node-engine-sdk', '//', 'https://example.com/']) {
      expect(() => resolvePlaygroundSite('vue', base)).toThrow(/PAGES_BASE/u)
    }
  })
})
