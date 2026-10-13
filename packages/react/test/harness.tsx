import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

export interface Rendered {
  host: HTMLElement
  root: Root
  rerender: (node: ReactNode) => Promise<void>
  act: (interaction: () => void) => Promise<void>
  unmount: () => Promise<void>
}

/**
 * Renders into a fresh container inside `act` and throws the first render error. Errors are
 * collected by the root instead of a wrapping error boundary: React only double-invokes the
 * effects of a newly mounted `<StrictMode>` tree when no newly mounted non-strict component
 * wraps it.
 */
export async function render(node: ReactNode): Promise<Rendered> {
  const host = document.createElement('div')
  const errors: unknown[] = []
  const root = createRoot(host, { onUncaughtError: (error) => errors.push(error) })
  const unmount = async () => {
    await act(async () => root.unmount())
    host.remove()
  }

  document.body.append(host)
  await act(async () => root.render(node))

  if (errors.length) {
    await unmount()
    throw errors[0]
  }

  return {
    host,
    root,
    rerender: async (next) => {
      await act(async () => root.render(next))
    },
    act: async (interaction) => {
      await act(async () => interaction())
    },
    unmount,
  }
}
