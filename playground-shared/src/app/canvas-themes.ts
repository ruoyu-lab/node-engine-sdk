import type { NodeEngineTheme } from '@node-engine-sdk/core/view'

export type CanvasThemeId = 'dark' | 'light'

export interface CanvasThemeOption {
  id: CanvasThemeId
  theme: Partial<NodeEngineTheme>
}

/**
 * The two themes of the playground. Each selects the editor's built-in palette of the same name,
 * and the app shell renders the matching `data-theme` tokens. Both options are module constants,
 * so the editor only repaints when the chosen theme changes.
 */
export const canvasThemes: Readonly<Record<CanvasThemeId, CanvasThemeOption>> = {
  dark: { id: 'dark', theme: { colorScheme: 'dark' } },
  light: { id: 'light', theme: { colorScheme: 'light' } },
}

export function toggleCanvasTheme(id: CanvasThemeId): CanvasThemeId {
  return id === 'dark' ? 'light' : 'dark'
}

/** The theme the system prefers; dark when it states no preference. */
export function resolveInitialTheme(view: Pick<Window, 'matchMedia'> | undefined): CanvasThemeId {
  return view?.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** Mirrors the theme on `<html>`, so the page background and native controls follow it. */
export function applyDocumentTheme(document: Document, id: CanvasThemeId): void {
  document.documentElement.dataset.theme = id
}
