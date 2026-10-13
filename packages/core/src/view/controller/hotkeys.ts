import type { Signal, ReadonlySignal } from '../reactive.js'
import type { NodeEngineHotkey, NodeEngineRenderContext } from '../types/index.js'
import { hasSelection } from './selection.js'

const HOTKEY_REMOVE_SELECTION_DELETE_ID = 'builtin.selection.remove.delete'
const HOTKEY_REMOVE_SELECTION_BACKSPACE_ID = 'builtin.selection.remove.backspace'

/** Lower-cases a key and maps aliases; the Space key reports `' '`, which maps to `space`. */
export function normalizeKey(key: string): string {
  if (key === ' ') {
    return 'space'
  }

  const normalized = key.trim().toLowerCase()

  if (normalized === 'del') {
    return 'delete'
  }

  return normalized === 'spacebar' ? 'space' : normalized
}

export function hotkeyMatches(
  hotkey: NodeEngineHotkey,
  event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
  normalizedKey: string,
): boolean {
  return (
    normalizeKey(hotkey.key) === normalizedKey &&
    Boolean(hotkey.ctrl) === event.ctrlKey &&
    Boolean(hotkey.meta) === event.metaKey &&
    Boolean(hotkey.shift) === event.shiftKey &&
    Boolean(hotkey.alt) === event.altKey
  )
}

/** Undo/redo, copy/paste and delete, below every contributed hotkey in priority. */
export function createBuiltInHotkeys(hasClipboardContent: () => boolean): NodeEngineHotkey[] {
  const canUndo = ({ readonly, history }: NodeEngineRenderContext) => !readonly && history.canUndo
  const canRedo = ({ readonly, history }: NodeEngineRenderContext) => !readonly && history.canRedo
  const undo = ({ api }: NodeEngineRenderContext) => {
    api.history.undo()
  }
  const redo = ({ api }: NodeEngineRenderContext) => {
    api.history.redo()
  }
  const canCopy = ({ selection }: NodeEngineRenderContext) => hasSelection(selection)
  const copy = ({ api }: NodeEngineRenderContext) => {
    api.clipboard.copy()
  }
  const canPaste = ({ readonly }: NodeEngineRenderContext) => !readonly && hasClipboardContent()
  const paste = ({ api }: NodeEngineRenderContext) => {
    api.clipboard.paste()
  }
  const canRemove = ({ readonly, selection }: NodeEngineRenderContext) =>
    !readonly && hasSelection(selection)
  const remove = ({ api }: NodeEngineRenderContext) => {
    api.selection.remove()
  }

  return [
    {
      id: 'builtin.history.undo.meta',
      key: 'z',
      meta: true,
      priority: -110,
      visible: canUndo,
      run: undo,
    },
    {
      id: 'builtin.history.undo.ctrl',
      key: 'z',
      ctrl: true,
      priority: -110,
      visible: canUndo,
      run: undo,
    },
    {
      id: 'builtin.history.redo.meta',
      key: 'z',
      meta: true,
      shift: true,
      priority: -110,
      visible: canRedo,
      run: redo,
    },
    {
      id: 'builtin.history.redo.ctrl-y',
      key: 'y',
      ctrl: true,
      priority: -110,
      visible: canRedo,
      run: redo,
    },
    {
      id: 'builtin.history.redo.ctrl-shift-z',
      key: 'z',
      ctrl: true,
      shift: true,
      priority: -110,
      visible: canRedo,
      run: redo,
    },
    {
      id: 'builtin.clipboard.copy.meta',
      key: 'c',
      meta: true,
      priority: -110,
      visible: canCopy,
      run: copy,
    },
    {
      id: 'builtin.clipboard.copy.ctrl',
      key: 'c',
      ctrl: true,
      priority: -110,
      visible: canCopy,
      run: copy,
    },
    {
      id: 'builtin.clipboard.paste.meta',
      key: 'v',
      meta: true,
      priority: -110,
      visible: canPaste,
      run: paste,
    },
    {
      id: 'builtin.clipboard.paste.ctrl',
      key: 'v',
      ctrl: true,
      priority: -110,
      visible: canPaste,
      run: paste,
    },
    {
      id: HOTKEY_REMOVE_SELECTION_DELETE_ID,
      key: 'delete',
      priority: -100,
      visible: canRemove,
      run: remove,
    },
    {
      id: HOTKEY_REMOVE_SELECTION_BACKSPACE_ID,
      key: 'backspace',
      priority: -100,
      visible: canRemove,
      run: remove,
    },
  ]
}

/**
 * Keyboard input of the editor root. Keys typed into inputs, textareas and content-editable
 * elements belong to those elements; Space is tracked for the space-drag marquee gesture.
 */
export interface KeyboardController {
  keydown: (event: KeyboardEvent) => void
  keyup: (event: KeyboardEvent) => void
  blur: () => void
}

export function createKeyboardController(options: {
  spacePressed: Signal<boolean>
  hotkeys: ReadonlySignal<NodeEngineHotkey[]>
  renderContext: ReadonlySignal<NodeEngineRenderContext>
}): KeyboardController {
  function isEditingText(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null

    return Boolean(
      element &&
      (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable),
    )
  }

  return {
    keydown(event) {
      if (isEditingText(event.target)) {
        return
      }

      const key = normalizeKey(event.key)

      if (key === 'space') {
        options.spacePressed.value = true
        event.preventDefault()
        return
      }

      const context = options.renderContext.peek()

      for (const hotkey of options.hotkeys.peek()) {
        if (!hotkeyMatches(hotkey, event, key) || (hotkey.visible && !hotkey.visible(context))) {
          continue
        }

        if (hotkey.preventDefault !== false) {
          event.preventDefault()
        }

        hotkey.run(context, event)
        return
      }
    },
    keyup(event) {
      if (normalizeKey(event.key) === 'space') {
        options.spacePressed.value = false
      }
    },
    blur() {
      options.spacePressed.value = false
    },
  }
}
