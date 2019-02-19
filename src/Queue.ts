// tslint:disable no-submodule-imports no-expression-statement no-if-statement
import { StoredEvent } from '@gtriggiano/grpc-eventstore'
import EventEmitter from 'eventemitter3'
import { Either } from 'fp-ts/lib/Either'
import StrictEventEmitter from 'strict-event-emitter-types'

export const Queue = ({
  highWaterMark,
  lowWaterMark,
  projectionHandler,
  ignoreProjectionErrorPredicate,
}: QueueConfiguration): Queue => {
  // tslint:disable-next-line:readonly-array
  const queuedEvents: StoredEvent[] = []

  const state: InternalState = {
    isProcessing: false,
    lastProcessedEvent: null,
  }

  const processNextEvent = async () => {
    if (!state.isProcessing) return

    const eventToProcess = queuedEvents[0]

    if (!eventToProcess) {
      // tslint:disable-next-line:no-object-mutation
      state.isProcessing = false
      return
    }

    const processingResult = await Promise.resolve(
      projectionHandler(eventToProcess)
    )

    if (processingResult.isLeft()) {
      const error = processingResult.value
      const ignoreError = await Promise.resolve(
        ignoreProjectionErrorPredicate(eventToProcess, error)
      )
      queue.emit('event-processing-error', {
        error,
        event: eventToProcess,
        ignored: ignoreError,
      })

      if (!ignoreError) {
        setTimeout(() => processNextEvent(), 1000)
        return
      }
    }

    const wasOverLWM = queuedEvents.length > lowWaterMark
    queuedEvents.shift()
    const isBelowLWM = queuedEvents.length <= lowWaterMark

    // tslint:disable-next-line:no-object-mutation
    state.lastProcessedEvent = eventToProcess
    queue.emit('processed-event', eventToProcess)

    if (wasOverLWM && isBelowLWM) queue.emit('LWM')
    if (!queuedEvents.length) queue.emit('drain')

    processNextEvent()
  }

  const queue: Queue = Object.assign(new EventEmitter(), {
    add: (event: StoredEvent) => {
      const wasBelowHWM = queuedEvents.length < highWaterMark
      queuedEvents.push(event)
      const isOverHWM = queuedEvents.length >= highWaterMark
      if (wasBelowHWM && isOverHWM) queue.emit('HWM')
      return queue.start()
    },
    getLastProcessedEvent: () => state.lastProcessedEvent,
    getSize: () => queuedEvents.length,
    start: () =>
      state.isProcessing
        ? queue
        : (() => {
            // tslint:disable-next-line:no-object-mutation
            state.isProcessing = true
            processNextEvent()
            return queue
          })(),
    stop: () => {
      // tslint:disable-next-line:no-object-mutation
      state.isProcessing = false
      return queue
    },
  })

  return queue
}

type Emitter = StrictEventEmitter<
  EventEmitter,
  {
    readonly HWM: void
    readonly LWM: void
    readonly drain: void
    readonly 'event-processing-error': {
      readonly error: Error
      readonly event: StoredEvent
      readonly ignored: boolean
    }
    readonly 'processed-event': StoredEvent
  }
>

interface Queue extends Emitter {
  readonly add: (event: StoredEvent) => Queue
  readonly getLastProcessedEvent: () => null | StoredEvent
  readonly getSize: () => number
  readonly start: () => Queue
  readonly stop: () => Queue
}

interface InternalState {
  // tslint:disable readonly-keyword
  isProcessing: boolean
  lastProcessedEvent: null | StoredEvent
  // tslint:enable readonly-keyword
}

export type EventProjectionHandler = (
  event: StoredEvent
) => EventProjectionResult | Promise<EventProjectionResult>
export type EventProjectionResult = Either<Error, void>

export type IngnoreEventProjectionHandlerErrorPredicate = (
  event: StoredEvent,
  error: Error
) => boolean | Promise<boolean>

interface QueueConfiguration {
  readonly highWaterMark: number
  readonly ignoreProjectionErrorPredicate: IngnoreEventProjectionHandlerErrorPredicate
  readonly lowWaterMark: number
  readonly projectionHandler: EventProjectionHandler
}
