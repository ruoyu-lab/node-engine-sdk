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

describe('@node-engine-sdk/core/runtime API surface', () => {
  it('exports the runtime, compiler, schedulers, and variable helpers, and nothing internal', () => {
    expect(Object.keys(runtime).sort()).toEqual([
      'NodeEngineRuntime',
      'compileGraph',
      'createConcurrentScheduler',
      'createRuntimeVariableApi',
      'createRuntimeVariableSnapshot',
      'createSequentialScheduler',
    ])
  })

  it('keeps every public NodeEngineRuntime entry point', () => {
    const instance = new runtime.NodeEngineRuntime({})

    for (const method of runtimeMethods) {
      expect(typeof instance[method], method).toBe('function')
    }
  })
})
