// tslint:disable no-submodule-imports
import * as t from 'io-ts'

import {
  EventProjectionHandler,
  IngnoreEventProjectionHandlerErrorPredicate,
} from '../Queue'
import { EventID } from './EventID'
import { EventStoreConfig } from './EventStoreConfig'

interface DefaultSettings {
  readonly extractionBatchSize: number
  readonly highWaterMark: number
  readonly ignoreProjectionErrorPredicate: IngnoreEventProjectionHandlerErrorPredicate
  readonly lowWaterMark: number
}

interface SettingsToProvide {
  readonly eventStore: EventStoreConfig
  readonly name: string
  readonly projectionHandler: EventProjectionHandler
  readonly startFromEventId: EventID
}

export type TimetravelerSettings = SettingsToProvide & Partial<DefaultSettings>

type Settings = DefaultSettings & SettingsToProvide

const TimetravelerSettingsProps = t.type(
  {
    eventStore: EventStoreConfig,
    extractionBatchSize: t.Int,
    highWaterMark: t.Int,
    ignoreProjectionErrorPredicate: (t.Function as unknown) as t.Type<
      IngnoreEventProjectionHandlerErrorPredicate
    >,
    lowWaterMark: t.Int,
    name: t.string,
    projectionHandler: (t.Function as unknown) as t.Type<
      EventProjectionHandler
    >,

    startFromEventId: EventID,
  },
  'TimetravelerSettingsProps'
)

export const TimetravelerSettings = new t.Type<Settings>(
  'TimetravelerSettings',
  (u): u is Settings => {
    const result = TimetravelerSettingsProps.decode(u)
    return (
      result.isRight() && result.value.highWaterMark > result.value.lowWaterMark
    )
  },
  (u, c) => {
    const propsValidation = TimetravelerSettingsProps.validate(u, c)
    return propsValidation.isLeft()
      ? propsValidation
      : propsValidation.value.highWaterMark <=
        propsValidation.value.lowWaterMark
      ? t.failure(u, c, 'highWaterMark should be >= lowWaterMark')
      : t.success(u as Settings)
  },
  t.identity
)

export const DEFAULT_TIMETRAVELER_CONFIGURATION: DefaultSettings = {
  extractionBatchSize: 500,
  highWaterMark: 5000,
  ignoreProjectionErrorPredicate: () => false,
  lowWaterMark: 500,
}
