import * as t from 'io-ts'

import { GRPCCredentials } from './GRPCCredentials'

export type EventStoreConfig = t.TypeOf<typeof EventStoreConfig>
export const EventStoreConfig = t.type(
  {
    address: t.string,
    credentials: GRPCCredentials,
  },
  'EventStoreConfig'
)
