import { cloneValue } from '../protocol/index.js'
import type { GraphPlugin, GraphPluginContext } from '../protocol/index.js'

/**
 * Plugin lifecycle. A plugin's contributions and its setup cleanup are undone together, in reverse
 * order, when the plugin is disposed or when its setup throws. Names are unique per store.
 */
export class PluginHost {
  private readonly plugins = new Map<string, () => void>()

  constructor(
    private readonly createContext: () => GraphPluginContext,
    private readonly onRegistered: (pluginName: string) => void,
  ) {}

  use(plugin: GraphPlugin): () => void {
    const registeredPlugin = cloneValue(plugin)
    const pluginName = registeredPlugin.name.trim()

    if (!pluginName) {
      throw new Error('Plugin name must not be empty.')
    }

    if (this.plugins.has(pluginName)) {
      throw new Error(`Plugin "${pluginName}" is already registered.`)
    }

    const cleanups: Array<() => void> = []
    let disposed = false

    const cleanupRegisteredValues = () => {
      for (const cleanup of [...cleanups].reverse()) {
        cleanup()
      }
    }

    try {
      const context = this.createContext()
      const contributions = registeredPlugin.contributes

      for (const command of contributions?.commands ?? []) {
        cleanups.push(context.registerCommand(command))
      }

      for (const definition of contributions?.nodeDefinitions ?? []) {
        cleanups.push(context.registerNodeDefinition(definition))
      }

      for (const definition of contributions?.edgeDefinitions ?? []) {
        cleanups.push(context.registerEdgeDefinition(definition))
      }

      for (const provider of contributions?.diagnostics ?? []) {
        cleanups.push(context.registerDiagnosticProvider(provider))
      }

      const setupCleanup = registeredPlugin.setup?.(context)

      if (setupCleanup) {
        cleanups.push(setupCleanup)
      }
    } catch (error) {
      cleanupRegisteredValues()
      throw error
    }

    const dispose = () => {
      if (disposed) {
        return
      }

      disposed = true
      cleanupRegisteredValues()

      if (this.plugins.get(pluginName) === dispose) {
        this.plugins.delete(pluginName)
      }
    }

    this.plugins.set(pluginName, dispose)
    this.onRegistered(pluginName)

    return dispose
  }

  has(name: string): boolean {
    return this.plugins.has(name.trim())
  }

  /** Disposes every plugin in registration order. */
  dispose(): void {
    for (const dispose of [...this.plugins.values()]) {
      dispose()
    }

    this.plugins.clear()
  }
}
