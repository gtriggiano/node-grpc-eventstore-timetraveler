// tslint:disable no-if-statement no-submodule-imports no-expression-statement
import EventEmitter from 'eventemitter3'
import { PathReporter } from 'io-ts/lib/PathReporter'
import { cloneDeep, pick } from 'lodash'
import StrictEventEmitter from 'strict-event-emitter-types'

import { StoredEvent } from '@gtriggiano/grpc-eventstore'
import { EventsExtractor } from './EventsExtractor'
import {
  DEFAULT_TIMETRAVELER_CONFIGURATION,
  TimetravelerSettings,
} from './ioCodecs'
import { Queue } from './Queue'

export const Timetraveler = (settings: TimetravelerSettings): Timetraveler => {
  const settingsValidation = TimetravelerSettings.decode({
    ...DEFAULT_TIMETRAVELER_CONFIGURATION,
    ...settings,
  })

  if (settingsValidation.isLeft()) {
    const error = new Error('Timetraveler configuration not valid')

      // tslint:disable-next-line:no-object-mutation
    ;(error as any).errors = PathReporter.report(settingsValidation)
    throw error
  }

  const {
    eventStore,
    extractionBatchSize,
    highWaterMark,
    ignoreProjectionErrorPredicate,
    lowWaterMark,
    name,
    projectionHandler,
    startFromEventId,
  } = settingsValidation.value

  const state: InternalState = {
    events: {
      lastExtracted: null,
      lastInStore: null,
      lastProcessed: null,
      totalIgnored: 0,
    },
    name,
    queue: {
      hwm: highWaterMark,
      lwm: lowWaterMark,
      size: 0,
    },
    stoppedOnProcessingError: null,
    subscribed: false,
    travelling: false,
  }

  const emitStateUpdate = () =>
    traveler.emit('state-update', traveler.getState())

  const eventsExtractor = EventsExtractor({
    eventStore,
    extractionBatchSize,
  })

  const queue = Queue({
    highWaterMark,
    ignoreProjectionErrorPredicate,
    lowWaterMark,
    projectionHandler,
  })

  eventsExtractor.on('event-extracted', event => {
    // tslint:disable-next-line:no-object-mutation
    state.events.lastExtracted = essentialEvent(event)
    queue.add(event)
    emitStateUpdate()
  })

  eventsExtractor.on('subscribed', () => {
    // tslint:disable-next-line:no-object-mutation
    state.subscribed = true
    emitStateUpdate()
  })

  eventsExtractor.on('unsubscribed', () => {
    // tslint:disable-next-line:no-object-mutation
    state.subscribed = false
    emitStateUpdate()
  })

  queue.on('processed-event', event => {
    // tslint:disable no-object-mutation
    state.events.lastProcessed = essentialEvent(event)
    state.stoppedOnProcessingError = null
    state.queue.size = queue.getSize()
    // tslint:enable no-object-mutation
    traveler.emit('processed-event', event)
    emitStateUpdate()
  })

  queue.on('event-processing-error', ({ error, event, ignored }) => {
    if (ignored) {
      // tslint:disable-next-line:no-object-mutation
      state.events.totalIgnored++
    } else {
      // tslint:disable-next-line:no-object-mutation
      state.stoppedOnProcessingError = {
        error,
        event: essentialEvent(event),
      }
    }
    traveler.emit('event-processing-error', { error, event, ignored })
  })

  queue.on('HWM', () => {
    if (!state.travelling) return
    eventsExtractor.stop()
  })

  queue.on('LWM', () => {
    if (!state.travelling) return
    eventsExtractor.start(
      (state.events.lastExtracted && state.events.lastExtracted.id) ||
        startFromEventId
    )
  })

  const traveler: Timetraveler = Object.assign(new EventEmitter(), {
    getState: () => cloneDeep(state),
    start: () =>
      state.travelling
        ? traveler
        : (() => {
            eventsExtractor.start(
              (state.events.lastExtracted && state.events.lastExtracted.id) ||
                startFromEventId
            )
            // tslint:disable-next-line:no-object-mutation
            state.travelling = true
            emitStateUpdate()
            return traveler
          })(),
    stop: () =>
      !state.travelling
        ? traveler
        : (() => {
            queue.stop()
            eventsExtractor.stop()
            // tslint:disable-next-line:no-object-mutation
            state.travelling = false
            emitStateUpdate()
            return traveler
          })(),
  })

  return traveler
}

const essentialEvent = (event: StoredEvent): EssentialEvent =>
  pick(event, ['id', 'storedOn', 'name', 'stream'])
type EssentialEvent = Pick<StoredEvent, 'id' | 'storedOn' | 'name' | 'stream'>

type Emitter = StrictEventEmitter<
  EventEmitter,
  {
    readonly 'event-processing-error': {
      readonly error: Error
      readonly event: StoredEvent
      readonly ignored: boolean
    }
    readonly 'processed-event': StoredEvent
    readonly 'state-update': InternalState
  }
>

export interface Timetraveler extends Emitter {
  readonly start: () => Timetraveler
  readonly stop: () => Timetraveler
  readonly getState: () => InternalState
}

interface InternalState {
  // tslint:disable readonly-keyword
  events: {
    lastExtracted: null | EssentialEvent
    lastInStore: null | EssentialEvent
    lastProcessed: null | EssentialEvent
    totalIgnored: number
  }
  name: string
  queue: {
    hwm: number
    lwm: number
    size: number
  }
  stoppedOnProcessingError: null | {
    error: Error
    event: EssentialEvent
  }
  subscribed: boolean
  travelling: boolean
  // tslint:enable readonly-keyword
}
