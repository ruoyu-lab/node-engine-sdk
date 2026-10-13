import type { NodeEngineDomNodeClassValue } from '@node-engine-sdk/core/view'

type ClassNameValue = NodeEngineDomNodeClassValue | null | undefined | false

/** Joins class values like a Vue `:class` binding: strings, string arrays and `{ name: on }` maps. */
export function toClassName(values: readonly ClassNameValue[]): string {
  const names: string[] = []

  for (const value of values) {
    if (!value) {
      continue
    }

    if (typeof value === 'string') {
      names.push(value)
    } else if (Array.isArray(value)) {
      names.push(...value.filter(Boolean))
    } else {
      names.push(...Object.keys(value).filter((name) => value[name]))
    }
  }

  return names.join(' ')
}
