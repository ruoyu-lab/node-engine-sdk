import { createEditorController } from '@node-wright/core/view'
import { describe, expect, it } from 'vitest'
import { createGraph } from './editor-harness'

/** Every callable path of the editor API, in declaration order. */
function listMethodPaths(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, entry]: [string, unknown]) =>
    typeof entry === 'function'
      ? [`${prefix}${key}`]
      : listMethodPaths(entry as object, `${prefix}${key}.`),
  )
}

describe('editor API surface', () => {
  it('offers exactly one entry per capability', () => {
    const controller = createEditorController()

    expect(listMethodPaths(controller.api)).toEqual([
      'runtime.ids.create',
      'runtime.store.get',
      'runtime.performance.get',
      'graph.get',
      'graph.getLive',
      'graph.set',
      'graph.apply',
      'graph.export',
      'graph.import',
      'graph.validate',
      'graph.repair',
      'view.get',
      'view.getLive',
      'view.set',
      'view.fit.graph',
      'view.fit.selection',
      'view.fit.nodes',
      'view.center.node',
      'view.center.selection',
      'view.zoom.to',
      'view.grid.setVisible',
      'view.grid.toggle',
      'view.grid.state',
      'coordinates.screenToGraph',
      'coordinates.clientToGraph',
      'coordinates.graphToScreen',
      'coordinates.graphRectToScreenRect',
      'selection.get',
      'selection.set',
      'selection.clear',
      'selection.all',
      'selection.nodes',
      'selection.edges',
      'selection.rect',
      'selection.remove',
      'history.canUndo',
      'history.canRedo',
      'history.undo',
      'history.redo',
      'nodes.create',
      'nodes.add',
      'nodes.get',
      'nodes.getLive',
      'nodes.update',
      'nodes.move',
      'nodes.remove',
      'nodes.bounds',
      'nodes.params.update',
      'nodes.params.set',
      'nodes.editor.open',
      'nodes.editor.close',
      'nodes.editor.state',
      'edges.add',
      'edges.get',
      'edges.update',
      'edges.reconnect',
      'edges.disconnect',
      'edges.remove',
      'edges.connect',
      'edges.validate',
      'groups.add',
      'groups.get',
      'groups.getLive',
      'groups.update',
      'groups.move',
      'groups.resize',
      'groups.collapse',
      'groups.expand',
      'groups.toggleCollapsed',
      'groups.isCollapsed',
      'groups.remove',
      'groups.list',
      'groups.bounds',
      'ports.get',
      'ports.anchor',
      'clipboard.copy',
      'clipboard.paste',
      'clipboard.duplicate',
      'commands.dispatch',
      'commands.get',
      'commands.list',
      'definitions.nodes.get',
      'definitions.nodes.list',
      'definitions.edges.get',
      'definitions.edges.list',
      'diagnostics.list',
      'transactions.mutate',
      'transactions.run',
      'menu.open',
      'menu.close',
      'menu.state',
      'menu.resolve.toolbar',
      'menu.resolve.context',
      'interaction.state',
    ])
    controller.destroy()
  })

  it('reads history, grid visibility and parameter schemas through their single entries', () => {
    const controller = createEditorController({
      graph: createGraph({ nodes: [{ id: 'node', type: 'demo', x: 0, y: 0 }] }),
      nodeDefinitions: [
        { type: 'demo', parameters: [{ key: 'text', kind: 'string' }] },
        { type: 'bare' },
      ],
    })
    const { api } = controller

    expect([api.history.canUndo(), api.history.canRedo()]).toEqual([false, false])
    api.nodes.move(['node'], { x: 10, y: 0 })
    expect([api.history.canUndo(), api.history.canRedo()]).toEqual([true, false])
    api.history.undo()
    expect([api.history.canUndo(), api.history.canRedo()]).toEqual([false, true])

    expect(api.view.grid.state().visible).toBe(true)
    api.view.grid.toggle()
    expect(api.view.grid.state().visible).toBe(false)

    expect(api.definitions.nodes.get('demo')?.parameters?.map((entry) => entry.key)).toEqual([
      'text',
    ])
    expect(api.definitions.nodes.get('bare')?.parameters).toBeUndefined()
    controller.destroy()
  })
})
