'use strict'

const _ = require('lodash')
const uuid = require('node-uuid')

/**
 * A set of functions called "actions" for `User`
 */

module.exports = {

  /**
   * @api {get} /notify Send test notification
   * @apiName Notify
   * @apiGroup Test
   * @apiPermission none
   *
   * @apiDescription Emits a test notification via
   * Web Sockets
   **/
  sendNotification: async (ctx) => {
    try {
      io.emit('notification', {
        id: uuid.v4(),
        subject: 'Test Notification',
        text: 'This is just a test notification',
        actionText: 'Go to the Dashboard',
        actionUrl: '/dashboard'
      })
      // debugger
      ctx.body = {}
    } catch (err) {
      ctx.body = err.toString()
    }
  }
}
