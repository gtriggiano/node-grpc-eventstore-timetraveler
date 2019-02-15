// tslint:disable no-submodule-imports
import * as t from 'io-ts'

import { EventProjectionHandler } from '../Queue'
import { EventID } from './EventID'
import { EventStoreConfig } from './EventStoreConfig'

export type TimetravelerConfigurationProps = t.TypeOf<
  typeof TimetravelerConfigurationProps
>

const TimetravelerConfigurationProps = t.type(
  {
    eventStore: EventStoreConfig,
    extractionBatchSize: t.Int,
    fromEventId: EventID,
    highWaterMark: t.Int,
    lowWaterMark: t.Int,
    name: t.string,
    projectionHandler: (t.Function as unknown) as t.Type<
      EventProjectionHandler
    >,
  },
  'TimetravelerConfigurationProps'
)

export type TimetravelerConfiguration = t.TypeOf<
  typeof TimetravelerConfiguration
>
export const TimetravelerConfiguration = new t.Type<
  TimetravelerConfigurationProps
>(
  'TimetravelerConfiguration',
  (u): u is TimetravelerConfigurationProps => {
    const result = TimetravelerConfigurationProps.decode(u)
    return (
      result.isRight() && result.value.highWaterMark > result.value.lowWaterMark
    )
  },
  (u, c) => {
    const propsValidation = TimetravelerConfigurationProps.validate(u, c)
    return propsValidation.isLeft()
      ? propsValidation
      : propsValidation.value.highWaterMark <=
        propsValidation.value.lowWaterMark
      ? t.failure(u, c, 'highWaterMark should be >= lowWaterMark')
      : t.success(u as TimetravelerConfigurationProps)
  },
  t.identity
)
