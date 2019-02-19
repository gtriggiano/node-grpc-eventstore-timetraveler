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
    state.eventstoreClient =
      state.eventstoreClient ||
      new EventStoreClient(eventStore.address, eventStore.credentials)
    return state.eventstoreClient
  }

  const closeClient = () => {
    if (state.eventstoreClient) {
      state.eventstoreClient.close()
      // tslint:disable-next-line:no-object-mutation
      state.eventstoreClient = null
    }
  }

  const onEventExtracted = (event: StoredEvent) => {
    if (!state.isStarted) return
    // tslint:disable-next-line:no-object-mutation
    state.lastExtractedEventId = event.id
    extractor.emit('event-extracted', event)
  }

  const getReadStoreForwardCall = (
    client: EventStoreClient,
    fromEventId: EventID
  ) => {
    const request = new Messages.ReadStoreForwardRequest()
    request.setFromEventId(fromEventId)
    request.setLimit(extractionBatchSize)
    return client.readStoreForward(request)
  }

  const fetchLastStoredEvent = () => {
    if (!state.eventstoreClient) return
    state.eventstoreClient.getLastEvent(
      new Messages.Empty(),
      (error, resultMessage) => {
        const event = error ? undefined : resultMessage.toObject().event
        if (event) {
          extractor.emit('last-stored-event-fetched', event as StoredEvent)
        }
      }
    )
  }

  const extractEvents = () => {
    if (!state.isStarted || state.isExtracting) return

    // tslint:disable-next-line:no-object-mutation
    state.isExtracting = true

    const eventStoreClient = getClient()

    eventStoreClient.waitForReady(Date.now() + 3000, error => {
      if (error) {
        extractor.emit('eventstore-connection-timeout', error)
        closeClient()
        // tslint:disable-next-line:no-object-mutation
        state.isExtracting = false
        setTimeout(() => extractEvents(), 1000)
        return
      }

      fetchLastStoredEvent()

      const readStoreForwardCall = getReadStoreForwardCall(
        eventStoreClient,
        state.lastExtractedEventId
      )

      // tslint:disable-next-line:no-let
      let numberOfExtractedEvents = 0

      readStoreForwardCall.on('data', (eventMessage: Messages.StoredEvent) => {
        const event = eventMessage.toObject()
        numberOfExtractedEvents++
        onEventExtracted(event as StoredEvent)
      })

      readStoreForwardCall.on('end', () => {
        // tslint:disable-next-line:no-object-mutation
        state.isExtracting = false
        if (numberOfExtractedEvents < extractionBatchSize) {
          subscribe()
        } else {
          extractEvents()
        }
      })

      readStoreForwardCall.on('error', readError => {
        closeClient()
        extractor.emit('eventstore-read-error', readError)
        // tslint:disable-next-line:no-object-mutation
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
        extractor.emit('eventstore-connection-timeout', error)
        closeClient()
        setTimeout(() => extractEvents(), 1000)
        return
      }

      const subscription = eventstoreClient.catchUpWithStore()

      const fetchLastStoredEventInterval = setInterval(
        fetchLastStoredEvent,
        2000
      )

      subscription.on('data', (eventMessage: Messages.StoredEvent) => {
        const event = eventMessage.toObject()
        onEventExtracted(event as StoredEvent)
      })

      subscription.on('error', subscriptionError => {
        clearInterval(fetchLastStoredEventInterval)
        closeClient()
        extractor.emit('eventstore-subscription-error', subscriptionError)
        extractor.emit('unsubscribed')
        setTimeout(() => extractEvents(), 1000)
      })

      subscription.on('end', () => {
        clearInterval(fetchLastStoredEventInterval)
        closeClient()
        extractor.emit('unsubscribed')
        setTimeout(() => extractEvents(), 1000)
      })

      const startMessage = new Messages.CatchUpWithStoreRequest()
      startMessage.setFromEventId(state.lastExtractedEventId)

      subscription.write(startMessage)
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
    readonly 'last-stored-event-fetched': StoredEvent
    readonly 'eventstore-connection-timeout': Error
    readonly 'eventstore-read-error': Error
    readonly 'eventstore-subscription-error': Error
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
