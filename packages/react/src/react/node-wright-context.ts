import type { NodeWrightApi } from '@node-wright/core/view'
import { createContext, useContext } from 'react'

export const NodeWrightApiContext = createContext<NodeWrightApi | null>(null)

/**
 * The API of the enclosing `NodeWright`, for components it renders: `renderBackground` and
 * `renderOverlay` content and DOM node components.
 */
export function useNodeWrightApi(): NodeWrightApi {
  const api = useContext(NodeWrightApiContext)

  if (!api) {
    throw new Error(
      'useNodeWrightApi must be called inside NodeWright render props or DOM node components.',
    )
  }

  return api
}
