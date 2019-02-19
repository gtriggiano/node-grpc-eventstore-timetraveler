// tslint:disable no-expression-statement
import { pick, throttle } from 'lodash'
import SocketIO from 'socket.io'

import { Timetraveler } from '../Timetraveler'

export const setupApplicationSocket = (
  ioServer: SocketIO.Server,
  traveler: Timetraveler
): void => {
  const onStartRequested = () => traveler.start()
  const onStopRequested = () => traveler.stop()

  traveler.on(
    'state-update',
    throttle(
      state => ioServer.sockets.emit('traveler-state-update', state),
      250,
      {
        leading: true,
        trailing: true,
      }
    )
  )

  traveler.on('processed-event', () =>
    ioServer.sockets.emit('traveler-processed-event')
  )

  traveler.on('event-processing-error', ({ error, event, ignored }) =>
    ioServer.sockets.emit('traveler-event-processing-error', {
      error: pick(error, ['name', 'message', 'stack']),
      event,
      ignored,
    })
  )

  ioServer.on('connection', socket => {
    socket.emit('traveler-state-update', traveler.getState())
    socket.on('start-traveler-command', onStartRequested)
    socket.on('stop-traveler-command', onStopRequested)
  })
}
