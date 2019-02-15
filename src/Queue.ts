// tslint:disable no-submodule-imports no-expression-statement no-if-statement
import { DbStoredEvent } from '@gtriggiano/grpc-eventstore'
import EventEmitter from 'eventemitter3'
import { Either } from 'fp-ts/lib/Either'
import StrictEventEmitter from 'strict-event-emitter-types'

export const Queue = ({
  highWaterMark,
  lowWaterMark,
  eventProjection,
}: QueueConfiguration): Queue => {
  // tslint:disable-next-line:readonly-array
  const queuedEvents: DbStoredEvent[] = []

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
      eventProjection(eventToProcess)
    )

    if (processingResult.isLeft()) {
      const error = processingResult.value
      queue.emit('event-processing-error', { error, event: eventToProcess })
      setTimeout(() => processNextEvent(), 1000)
      return
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
    add: (event: DbStoredEvent) => {
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
      readonly event: DbStoredEvent
    }
    readonly 'processed-event': DbStoredEvent
  }
>

interface Queue extends Emitter {
  readonly add: (event: DbStoredEvent) => Queue
  readonly getLastProcessedEvent: () => null | DbStoredEvent
  readonly getSize: () => number
  readonly start: () => Queue
  readonly stop: () => Queue
}

interface InternalState {
  // tslint:disable readonly-keyword
  isProcessing: boolean
  lastProcessedEvent: null | DbStoredEvent
  // tslint:enable readonly-keyword
}

export type EventProjectionHandler = (
  event: DbStoredEvent
) => EventProjectionResult | Promise<EventProjectionResult>
export type EventProjectionResult = Either<Error, void>

interface QueueConfiguration {
  readonly eventProjection: EventProjectionHandler
  readonly highWaterMark: number
  readonly lowWaterMark: number
}
