import type {
  NodeWrightRuntimeScheduledTask,
  NodeWrightRuntimeScheduler,
  NodeWrightRuntimeSchedulerContext,
} from './types.js'

export interface ConcurrentSchedulerOptions {
  maxConcurrency?: number
  timeoutMs?: number
  retries?: number
}

export function createSequentialScheduler(): NodeWrightRuntimeScheduler {
  return {
    async schedule(context, tasks) {
      const results = []

      for (const task of tasks) {
        results.push(await runTaskWithPolicy(context, task, {}))
      }

      return results
    },
  }
}

export function createConcurrentScheduler(
  options: ConcurrentSchedulerOptions = {},
): NodeWrightRuntimeScheduler {
  const maxConcurrency = Math.max(1, options.maxConcurrency ?? Number.POSITIVE_INFINITY)

  return {
    async schedule(context, tasks) {
      if (!tasks.length) {
        return []
      }

      const results: unknown[] = new Array(tasks.length)
      let nextIndex = 0

      async function worker(): Promise<void> {
        while (nextIndex < tasks.length) {
          const index = nextIndex
          nextIndex += 1
          const task = tasks[index]

          if (!task) {
            throw new Error(`Runtime scheduler task ${index} is missing.`)
          }

          results[index] = await runTaskWithPolicy(context, task, options)
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(maxConcurrency, tasks.length) }, () => worker()),
      )

      return results as Awaited<ReturnType<(typeof tasks)[number]['run']>>[]
    },
  }
}

async function runTaskWithPolicy<T>(
  context: NodeWrightRuntimeSchedulerContext,
  task: NodeWrightRuntimeScheduledTask<T>,
  options: ConcurrentSchedulerOptions,
): Promise<T> {
  const retries = task.retryable ? Math.max(0, options.retries ?? 0) : 0
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    assertTaskActive(task.id, context.signal)

    try {
      return await runTaskAttempt(context, task, attempt + 1, options.timeoutMs)
    } catch (error) {
      lastError = error
      assertTaskActive(task.id, context.signal)
    }
  }

  throw lastError
}

function assertTaskActive(taskId: string, signal: AbortSignal): void {
  if (signal.aborted) {
    throw createCancellationError(taskId, signal.reason)
  }
}

async function runTaskAttempt<T>(
  context: NodeWrightRuntimeSchedulerContext,
  task: NodeWrightRuntimeScheduledTask<T>,
  attempt: number,
  timeoutMs: number | undefined,
): Promise<T> {
  const controller = new AbortController()
  const abortFromContext = () => {
    controller.abort(createCancellationError(task.id, context.signal.reason))
  }

  if (context.signal.aborted) {
    abortFromContext()
  } else {
    context.signal.addEventListener('abort', abortFromContext, { once: true })
  }

  const timeout =
    timeoutMs && timeoutMs > 0
      ? setTimeout(() => {
          controller.abort(new Error(`Scheduled task "${task.id}" exceeded ${timeoutMs}ms.`))
        }, timeoutMs)
      : undefined

  let rejectOnAbort: (() => void) | undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectOnAbort = () => {
      reject(
        controller.signal.reason instanceof Error
          ? controller.signal.reason
          : createCancellationError(task.id, controller.signal.reason),
      )
    }

    if (controller.signal.aborted) {
      rejectOnAbort()
    } else {
      controller.signal.addEventListener('abort', rejectOnAbort, { once: true })
    }
  })
  const execution = Promise.resolve().then(() =>
    task.run({
      attempt,
      signal: controller.signal,
    }),
  )

  try {
    return await Promise.race([execution, aborted])
  } finally {
    context.signal.removeEventListener('abort', abortFromContext)
    if (rejectOnAbort) {
      controller.signal.removeEventListener('abort', rejectOnAbort)
    }
    if (timeout !== undefined) {
      clearTimeout(timeout)
    }
  }
}

function createCancellationError(taskId: string, reason: unknown): Error {
  if (reason instanceof Error) {
    return reason
  }

  return new Error(
    reason === undefined
      ? `Scheduled task "${taskId}" was cancelled.`
      : `Scheduled task "${taskId}" was cancelled: ${String(reason)}`,
  )
}
