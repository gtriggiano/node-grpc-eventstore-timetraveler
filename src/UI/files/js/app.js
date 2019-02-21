'use strict'
;(function() {
  const $ = window.$
  const io = window.io
  const moment = window.moment
  const _ = window._
  moment.locale(window.navigator.userLanguage || window.navigator.language)

  let STATE = null
  let STOPPED_ON_ERROR = null

  $(function() {
    const socket = io({
      transports: ['websocket'],
    })
    socket.on('traveler-state-update', state => {
      STATE = state
    })
    socket.on('traveler-processed-event', () => {
      STOPPED_ON_ERROR = null
    })
    socket.on('traveler-event-processing-error', payload => {
      if (!payload.ignored) {
        STOPPED_ON_ERROR = {
          error: payload.error,
          event: payload.event,
        }
      }
    })

    const $dashboard = $('#dashboard')
    const $behind = $('#behind')
    const $leeso = $('#leeso')
    const $lpeso = $('#lpeso')

    const $controls = $('#controls')
    const $status = $('#controls .status')
    const $startStopCTA = $('#controls .start-stop-cta')

    const $queue = $('#queue')
    const $queueHWM = $queue.find('.hwm')
    const $queueLWM = $queue.find('.lwm')
    const $queueFiller = $queue.find('.filler')
    const $queueSize = $queueFiller.find('.size')

    const $processingError = $('#processing-error')
    const $processingErrorText = $processingError.find('.text')

    const toggleStartStop = () =>
      STATE &&
      socket.emit(
        STATE.travelling ? 'stop-traveler-command' : 'start-traveler-command'
      )

    $startStopCTA.on('click', _.throttle(toggleStartStop, 1000))

    function render() {
      if (STATE) {
        $dashboard.show()

        const BEHIND =
          STATE.events.lastInStore &&
          STATE.events.lastProcessed &&
          (() => {
            const duration = moment.duration(
              moment(STATE.events.lastInStore.storedOn).diff(
                STATE.events.lastProcessed.storedOn
              )
            )

            return duration.as('seconds') < 1
              ? '0 seconds'
              : duration.humanize()
          })()

        const queueScale = STATE.queue.hwm + STATE.queue.lwm
        const queueLWMPercentOnScale = STATE.queue.lwm / queueScale
        const queueHWMPercentOnScale = STATE.queue.hwm / queueScale
        const queueFillerPercentOnScale = Math.min(
          STATE.queue.size / queueScale,
          1
        )
        const hue =
          STATE.queue.size < STATE.queue.lwm
            ? 120
            : STATE.queue.size > STATE.queue.hwm
            ? 0
            : 120 -
              ((STATE.queue.size - STATE.queue.lwm) /
                (STATE.queue.hwm - STATE.queue.lwm)) *
                120

        // Last Extracted Event Stored On
        const LEESO =
          (STATE.events.lastExtracted &&
            moment(STATE.events.lastExtracted.storedOn).format('LLLL')) ||
          null

        // Last Processed Event Stored On
        const LPESO =
          (STATE.events.lastProcessed &&
            moment(STATE.events.lastProcessed.storedOn).format('LLLL')) ||
          null

        if (BEHIND) {
          $behind.text(BEHIND)
        }
        if (STATE.travelling) {
          $controls.addClass('travelling')
        } else {
          $controls.removeClass('travelling')
        }
        if (STATE.subscribed) {
          $controls.addClass('subscribed')
        } else {
          $controls.removeClass('subscribed')
        }
        $status.text(STATE.travelling ? 'Running' : 'Stopped')
        $startStopCTA.text(STATE.travelling ? 'Stop' : 'Start')
        $leeso.text(LEESO)
        $lpeso.text(LPESO)

        $queueLWM
          .css({ bottom: queueLWMPercentOnScale * 100 + '%' })
          .text(STATE.queue.lwm)
        $queueHWM
          .css({ bottom: queueHWMPercentOnScale * 100 + '%' })
          .text(STATE.queue.hwm)
        $queueFiller.css({
          height: queueFillerPercentOnScale * 100 + '%',
          backgroundColor: 'hsl(' + hue + ', 100%, 30%)',
        })

        $queueSize.text(STATE.queue.size).css({
          backgroundColor: 'hsl(' + hue + ', 100%, 30%)',
        })

        if (STOPPED_ON_ERROR) {
          $processingError.show()
          $processingErrorText.text(JSON.stringify(STOPPED_ON_ERROR, null, 2))
        } else {
          $processingError.hide()
          $processingErrorText.text('')
        }
      }
      window.requestAnimationFrame(render)
    }

    window.requestAnimationFrame(render)
  })
})()
