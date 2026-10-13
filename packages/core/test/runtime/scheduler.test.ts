import { describe, expect, it } from 'vitest'
import { createConcurrentScheduler, createSequentialScheduler } from '../../src/runtime/index'
import type {
  NodeEngineRuntimeScheduledTask,
  NodeEngineRuntimeSchedulerContext,
  NodeEngineRuntimeTaskAttempt,
} from '../../src/runtime/index'

function makeContext(): NodeEngineRuntimeSchedulerContext {
  return {
    runId: 'test-run',
    graph: { schemaVersion: '1.0.0', nodes: [], edges: [], groups: [], meta: {} },
    signal: new AbortController().signal,
    phase: 'exec',
  }
}

function task<T>(
  id: string,
  run: (attempt: NodeEngineRuntimeTaskAttempt) => Promise<T>,
  retryable = false,
): NodeEngineRuntimeScheduledTask<T> {
  return { id, retryable, run }
}

describe('createSequentialScheduler', () => {
  it('runs tasks in order and preserves task result positions', async () => {
    const order: string[] = []
    const scheduler = createSequentialScheduler()

    const result = await scheduler.schedule(makeContext(), [
      task('a', async () => {
        await delay(20)
        order.push('a')
        return 'A'
      }),
      task('b', async () => {
        order.push('b')
        return 'B'
      }),
    ])

    expect(order).toEqual(['a', 'b'])
    expect(result).toEqual(['A', 'B'])
  })
})

describe('createConcurrentScheduler', () => {
  it('runs tasks in parallel up to maxConcurrency', async () => {
    const scheduler = createConcurrentScheduler({ maxConcurrency: 2 })
    let inflight = 0
    let peak = 0

    const tasks = Array.from({ length: 5 }, (_, index) =>
      task(`t${index}`, async () => {
        inflight += 1
        peak = Math.max(peak, inflight)
        await delay(15)
        inflight -= 1
        return index
      }),
    )

    const result = await scheduler.schedule(makeContext(), tasks)

    expect(result).toEqual([0, 1, 2, 3, 4])
    expect(peak).toBeLessThanOrEqual(2)
    expect(peak).toBeGreaterThan(1)
  })

  it('retries a flaky task and ultimately succeeds', async () => {
    const scheduler = createConcurrentScheduler({ retries: 2 })
    let attempts = 0

    const result = await scheduler.schedule(makeContext(), [
      task(
        'flaky',
        async ({ attempt }) => {
          attempts += 1
          expect(attempt).toBe(attempts)
          if (attempts < 3) {
            throw new Error('boom')
          }
          return 'ok'
        },
        true,
      ),
    ])

    expect(attempts).toBe(3)
    expect(result).toEqual(['ok'])
  })

  it('rejects with the last error once retries are exhausted', async () => {
    const scheduler = createConcurrentScheduler({ retries: 1 })
    let attempts = 0

    await expect(
      scheduler.schedule(makeContext(), [
        task(
          'always-fail',
          async () => {
            attempts += 1
            throw new Error(`fail-${attempts}`)
          },
          true,
        ),
      ]),
    ).rejects.toThrow('fail-2')

    expect(attempts).toBe(2)
  })

  it('aborts the active attempt when timeoutMs is exceeded', async () => {
    const scheduler = createConcurrentScheduler({ timeoutMs: 25 })
    let attemptWasAborted = false

    await expect(
      scheduler.schedule(makeContext(), [
        task('slow', async ({ signal }) => {
          await new Promise<void>((_resolve, reject) => {
            signal.addEventListener(
              'abort',
              () => {
                attemptWasAborted = true
                reject(signal.reason)
              },
              { once: true },
            )
          })
          return 'unreachable'
        }),
      ]),
    ).rejects.toThrow(/exceeded 25ms/)

    expect(attemptWasAborted).toBe(true)
  })

  it('aborts active work when the context signal is aborted', async () => {
    const controller = new AbortController()
    const ctx: NodeEngineRuntimeSchedulerContext = { ...makeContext(), signal: controller.signal }
    const scheduler = createConcurrentScheduler({ retries: 5 })
    let attemptWasAborted = false

    const promise = scheduler.schedule(ctx, [
      task('cancelled', async ({ signal }) => {
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              attemptWasAborted = true
              reject(signal.reason)
            },
            { once: true },
          )
        })
        return 'unreachable'
      }),
    ])

    setTimeout(() => controller.abort(), 5)

    await expect(promise).rejects.toThrow()
    expect(attemptWasAborted).toBe(true)
  })

  it('never retries a task unless retry safety is explicit', async () => {
    const scheduler = createConcurrentScheduler({ retries: 5 })
    let attempts = 0

    await expect(
      scheduler.schedule(makeContext(), [
        task('effect', async () => {
          attempts += 1
          throw new Error('effect-failed')
        }),
      ]),
    ).rejects.toThrow('effect-failed')

    expect(attempts).toBe(1)
  })
})

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
