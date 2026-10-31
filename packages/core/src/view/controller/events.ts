import type { NodeWrightEventListener, NodeWrightEventSink } from '../types/index.js'

/** Routes every editor event to the `onEvent` listener of the current options. */
export function createEventEmitter(
  getListener: () => NodeWrightEventListener | undefined,
): NodeWrightEventSink {
  return (event, ...args) => {
    // Every listener accepts each event with its full payload.
    const listener: NodeWrightEventSink | undefined = getListener()

    listener?.(event, ...args)
  }
}
