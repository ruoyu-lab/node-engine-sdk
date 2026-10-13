export interface PlaygroundShortcut {
  /** Keys or gestures, rendered as separate key caps. */
  keys: readonly string[]
  action: string
}

/** Editor input the shortcut panel lists: the built-in hotkeys and pointer gestures. */
export const playgroundShortcuts: readonly PlaygroundShortcut[] = [
  { keys: ['拖动空白处'], action: '平移画布' },
  { keys: ['滚轮'], action: '缩放画布' },
  { keys: ['Shift', '滚轮'], action: '平移画布' },
  { keys: ['空格', '拖动'], action: '框选' },
  { keys: ['Shift', '点击'], action: '多选节点' },
  { keys: ['端口拖到空白处'], action: '新建并连接节点' },
  { keys: ['右键连线'], action: '断开连线' },
  { keys: ['⌘/Ctrl', 'Z'], action: '撤销' },
  { keys: ['⌘/Ctrl', 'Shift', 'Z'], action: '重做' },
  { keys: ['⌘/Ctrl', 'C / V'], action: '复制 / 粘贴' },
  { keys: ['Delete'], action: '删除选中项' },
]
