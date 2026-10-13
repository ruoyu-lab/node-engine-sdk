import type { NodeEngineEventListener, NodeEngineEventSink } from '../types/index.js'

/** Routes every editor event to the `onEvent` listener of the current options. */
export function createEventEmitter(
  getListener: () => NodeEngineEventListener | undefined,
): NodeEngineEventSink {
  return (event, ...args) => {
    // Every listener accepts each event with its full payload.
    const listener: NodeEngineEventSink | undefined = getListener()

    listener?.(event, ...args)
  }
}
