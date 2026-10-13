import type { NodeEngineApi } from '@node-engine-sdk/core/view'
import { createContext, useContext } from 'react'

export const NodeEngineApiContext = createContext<NodeEngineApi | null>(null)

/**
 * The API of the enclosing `NodeEngine`, for components it renders: `renderBackground` and
 * `renderOverlay` content and DOM node components.
 */
export function useNodeEngineApi(): NodeEngineApi {
  const api = useContext(NodeEngineApiContext)

  if (!api) {
    throw new Error(
      'useNodeEngineApi must be called inside NodeEngine render props or DOM node components.',
    )
  }

  return api
}
