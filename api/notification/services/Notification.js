"use strict"

/**
 * Module dependencies
 */

// Public dependencies.
const _ = require("lodash")
const joi = require("joi")
const co = require("co")

// Strapi utilities.
const utils = require("strapi-hook-bookshelf/lib/utils/")
const JsonApiError = require("../../../utils/json-api-error")
/**
 * A set of functions called "actions" for `Notification`
 */

module.exports = {
  /**
   * @return {Object}
   *
   */
  setNotifcationStatus: co.wrap(function*(ctx, isRead) {
    const schema = joi.object().keys({
      id: joi
        .string()
        .required()
        .guid()
    })

    const result = joi.validate(ctx.params, schema, { allowUnknown: false })
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }

    let notify = yield new Notification({
      id: ctx.params.id,
      recipient: ctx.session.passport.user.id
    }).fetch()

    if (notify === null) {
      throw new JsonApiError(`E_RESOURCE_NOT_EXISTS`, 404)
    } else if (notify.attributes.read === isRead) {
      return notify
    }

    yield notify.save({ read: isRead }, { patch: true })

    return notify
  }),
  /**
   * @return {Object}
   *
   */
  setAllNotificationStatuses: async function(ctx, isRead) {
    try {
      const query = Notification.query(q => {
        q.where("recipient", ctx.session.passport.user.id)
        q.where("read", !isRead)
      })
      const notifications = await query.fetchAll()
      const jsonData = await notifications.toJSON()
      const numberOfNotifications = _.size(jsonData)
      if (numberOfNotifications === 0) {
        return {
          numberOfNotifications
        }
      }

      const promises = []
      notifications.forEach(row => {
        promises.push(row.save({ read: isRead }, { patch: true }))
      })

      return Promise.all(promises).then(() => {
        return {
          numberOfNotifications
        }
      })
    } catch (e) {
      throw new JsonApiError(`E_RESOURCE_NOT_EXISTS`, 404, {
        details: e.message
      })
    }
  }
}
