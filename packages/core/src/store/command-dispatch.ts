import type {
  GraphChangeOptions,
  GraphCommand,
  GraphCommandDefinition,
  GraphCommandDispatchResult,
  GraphCommandRegistryEntry,
  GraphSnapshot,
  GraphStoreLike,
} from '../protocol/index.js'
import { createValidationErrorMessage } from './diagnostics.js'

export interface CommandDispatcherDependencies {
  getCommand: (commandId: string) => GraphCommandRegistryEntry | undefined
  execute: (command: GraphCommand, options: GraphChangeOptions) => GraphSnapshot
  getSnapshot: () => GraphSnapshot
  storeApi: () => GraphStoreLike
  /** Called with the reason of every rejected dispatch, to fail an active transaction. */
  onReject: (reason: string) => void
}

/**
 * Runs registered commands by id. A command that is missing, refuses its payload, fails
 * validation, or throws is reported in the result instead of thrown.
 */
export class CommandDispatcher {
  constructor(private readonly dependencies: CommandDispatcherDependencies) {}

  dispatch(
    commandId: string,
    payload: unknown,
    options: GraphChangeOptions,
  ): GraphCommandDispatchResult {
    const registeredDefinition = this.dependencies.getCommand(commandId)

    if (!registeredDefinition) {
      const reason = `Command "${commandId}" is not registered.`
      return this.reject(reason, { reason })
    }

    const definition = registeredDefinition as GraphCommandDefinition
    const validation = definition.validate?.(payload, this.dependencies.storeApi())

    if (validation === false) {
      const reason = `Command "${commandId}" refused to execute.`
      return this.reject(reason, { reason })
    }

    if (validation && typeof validation === 'object' && !validation.valid) {
      if ('diagnostics' in validation) {
        const reason = createValidationErrorMessage(validation)
        return this.reject(reason, { diagnostics: validation.diagnostics, reason })
      }

      return this.reject(validation.reason ?? `Command "${commandId}" failed validation.`, {
        validation,
        reason: validation.reason,
      })
    }

    try {
      const graphCommand: GraphCommand = {
        id: definition.id,
        label:
          typeof definition.label === 'function' ? definition.label(payload) : definition.label,
        category: definition.category,
        shortcut: definition.shortcut,
        icon: definition.icon,
        when: definition.when,
        execute: (draft, api) =>
          definition.execute(payload, draft, api, this.dependencies.storeApi()),
      }

      return {
        applied: true,
        snapshot: this.dependencies.execute(graphCommand, options),
      }
    } catch (error) {
      const reason = getErrorMessage(error, commandId)
      return this.reject(reason, { reason })
    }
  }

  /** `failure` fails an active transaction; `details` complete the rejected result. */
  private reject(
    failure: string,
    details: Omit<GraphCommandDispatchResult, 'applied' | 'snapshot'>,
  ): GraphCommandDispatchResult {
    this.dependencies.onReject(failure)

    return {
      applied: false,
      snapshot: this.dependencies.getSnapshot(),
      ...details,
    }
  }
}

function getErrorMessage(error: unknown, commandId: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return `Command "${commandId}" failed to execute.`
}
