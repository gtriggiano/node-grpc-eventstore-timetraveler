// tslint:disable no-expression-statement
import express, { Application as ExpressApplication } from 'express'
import http from 'http'
import SocketIO from 'socket.io'

import { Timetraveler } from '../Timetraveler'

import { setupApplication } from './setupApplication'
import { setupApplicationSocket } from './setupApplicationSocket'

export const getUserInterface = (
  traveler: Timetraveler,
  customSetup?: UISetupFunction
): UserInterface => {
  const app = express()
  const httpServer = new http.Server(app)
  const ioServer = SocketIO(httpServer)

  app.set('title', traveler.name)

  // tslint:disable-next-line:no-if-statement
  if (customSetup) {
    customSetup(app, ioServer, traveler)
  } else {
    setupApplication(app)
    setupApplicationSocket(ioServer, traveler)
  }

  return {
    app,
    httpServer,
    ioServer,
  }
}

export interface UserInterface {
  readonly app: ExpressApplication
  readonly httpServer: http.Server
  readonly ioServer: SocketIO.Server
}

export type UISetupFunction = (
  app: ExpressApplication,
  ioServer: SocketIO.Server,
  traveler: Timetraveler
) => any
