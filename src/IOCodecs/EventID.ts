import * as t from 'io-ts'
import { isString } from 'lodash'

const allDigitsRegex = /^\d+$/
const isEventID = (u: unknown): u is EventID =>
  isString(u) && allDigitsRegex.test(u)

export type EventID = t.TypeOf<typeof EventID>
export const EventID: t.Type<string> = new t.Type(
  'EventID',
  isEventID,
  (u, c) => {
    return isEventID(u)
      ? t.success(u)
      : t.failure(
          u,
          c,
          'should be the string representation of an integer >= 0'
        )
  },
  t.identity
)
