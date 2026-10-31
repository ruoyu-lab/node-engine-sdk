import { describe, expect, it } from 'vitest'
import * as runtime from '../../src/runtime/index'

const runtimeMethods = [
  'compile',
  'run',
  'pause',
  'resume',
  'step',
  'stepInto',
  'stepOver',
  'stepOut',
  'cancel',
  'setBreakpoint',
  'clearBreakpoint',
  'getRun',
] as const

describe('@node-wright/core/runtime API surface', () => {
  it('exports the runtime, compiler, schedulers, and variable helpers, and nothing internal', () => {
    expect(Object.keys(runtime).sort()).toEqual([
      'NodeWrightRuntime',
      'compileGraph',
      'createConcurrentScheduler',
      'createRuntimeVariableApi',
      'createRuntimeVariableSnapshot',
      'createSequentialScheduler',
    ])
  })

  it('keeps every public NodeWrightRuntime entry point', () => {
    const instance = new runtime.NodeWrightRuntime({})

    for (const method of runtimeMethods) {
      expect(typeof instance[method], method).toBe('function')
    }
  })
})
