import * as t from 'io-ts'

export type EventStoreConfig = t.TypeOf<typeof EventStoreConfig>
export const EventStoreConfig = t.type(
  {
    address: t.string,
  },
  'EventStoreConfig'
)
