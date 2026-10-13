import { useEffect, useLayoutEffect } from 'react'

/**
 * `useLayoutEffect` in the browser and `useEffect` during server rendering. The adapter binds
 * rendered DOM elements in layout effects, which never run on the server, and React 18 reports
 * every `useLayoutEffect` it meets while rendering on the server.
 */
export const useIsomorphicLayoutEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect
