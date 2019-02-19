// tslint:disable no-submodule-imports no-expression-statement no-if-statement
import {
  EventStoreClient,
  Messages,
  StoredEvent,
} from '@gtriggiano/grpc-eventstore'
import EventEmitter from 'eventemitter3'
import StrictEventEmitter from 'strict-event-emitter-types'

import { EventID, EventStoreConfig } from './IOCodecs'

export const EventsExtractor = ({
  eventStore,
  extractionBatchSize,
}: EventsExtractorConfiguration) => {
  const state: InternalState = {
    eventstoreClient: null,
    isExtracting: false,
    isStarted: false,
    lastExtractedEventId: '0',
  }

  const getClient = () => {
    // tslint:disable-next-line:no-object-mutation
    state.eventstoreClient = new EventStoreClient(
      eventStore.address,
      eventStore.credentials
    )
    return state.eventstoreClient
  }

  const closeClient = () => {
    if (state.eventstoreClient) {
      state.eventstoreClient.close()
      // tslint:disable-next-line:no-object-mutation
      state.eventstoreClient = null
      extractor.emit('unsubscribed')
    }
  }

  const onEventExtracted = (event: StoredEvent) => {
    if (!state.isStarted) return
    // tslint:disable-next-line:no-object-mutation
    state.lastExtractedEventId = event.id
    extractor.emit('event-extracted', event)
  }

  const extractEvents = () => {
    if (!state.isStarted || state.isExtracting) return

    // tslint:disable-next-line:no-object-mutation
    state.isExtracting = true

    const eventStoreClient = getClient()

    eventStoreClient.waitForReady(Date.now() + 3000, error => {
      if (error) {
        closeClient()
        // tslint:disable-next-line:no-object-mutation
        state.isExtracting = false
        setTimeout(() => extractEvents(), 1000)
        return
      }

      const request = new Messages.ReadStoreForwardRequest()
      request.setFromEventId(state.lastExtractedEventId)
      request.setLimit(extractionBatchSize)

      const call = eventStoreClient.readStoreForward(request)

      // tslint:disable-next-line:no-let
      let numberOfExtractedEvents = 0

      call.on('data', (eventMessage: Messages.StoredEvent) => {
        const event = eventMessage.toObject()
        numberOfExtractedEvents++
        onEventExtracted(event as StoredEvent)
      })

      call.on('end', () => {
        closeClient()
        // tslint:disable-next-line:no-object-mutation
        state.isExtracting = false
        if (numberOfExtractedEvents < extractionBatchSize) {
          subscribe()
        } else {
          extractEvents()
        }
      })

      call.on('error', () => {
        closeClient() // tslint:disable-next-line:no-object-mutation
        state.isExtracting = false
        setTimeout(() => extractEvents(), 1000)
      })
    })
  }

  const subscribe = () => {
    if (!state.isStarted) return

    const eventstoreClient = getClient()

    eventstoreClient.waitForReady(Date.now() + 3000, error => {
      if (error) {
        closeClient()
        setTimeout(() => extractEvents(), 1000)
        return
      }

      const request = new Messages.CatchUpWithStoreRequest()
      request.setFromEventId(state.lastExtractedEventId)

      const call = eventstoreClient.catchUpWithStore()
      call.write(request)

      call.on('data', (eventMessage: Messages.StoredEvent) => {
        const event = eventMessage.toObject()
        onEventExtracted(event as StoredEvent)
      })

      call.on('error', () => {
        closeClient()
        extractor.emit('unsubscribed')
        setTimeout(() => extractEvents(), 1000)
      })

      call.on('end', () => {
        closeClient()
        extractor.emit('unsubscribed')
        setTimeout(() => extractEvents(), 1000)
      })

      extractor.emit('subscribed')
    })
  }

  const extractor: EventsExtractor = Object.assign(new EventEmitter(), {
    start: (fromEventId: EventID) =>
      state.isStarted
        ? extractor
        : (() => {
            // tslint:disable-next-line:no-object-mutation
            state.isStarted = true
            // tslint:disable-next-line:no-object-mutation
            state.lastExtractedEventId = fromEventId
            extractEvents()
            return extractor
          })(),
    stop: () =>
      !state.isStarted
        ? extractor
        : (() => {
            // tslint:disable-next-line:no-object-mutation
            state.isStarted = false
            closeClient()
            return extractor
          })(),
  })

  return extractor
}

type Emitter = StrictEventEmitter<
  EventEmitter,
  {
    readonly 'event-extracted': StoredEvent
    readonly subscribed: void
    readonly unsubscribed: void
  }
>

interface EventsExtractor extends Emitter {
  readonly start: (fromEventId: EventID) => EventsExtractor
  readonly stop: () => EventsExtractor
}

interface InternalState {
  // tslint:disable readonly-keyword
  eventstoreClient: null | EventStoreClient
  isExtracting: boolean
  isStarted: boolean
  lastExtractedEventId: EventID
  // tslint:enable readonly-keyword
}

interface EventsExtractorConfiguration {
  readonly eventStore: EventStoreConfig
  readonly extractionBatchSize: number
}
