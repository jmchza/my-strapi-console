"use strict"

/**
 * A set of functions called "actions" for `Notification`
 */

module.exports = {
  /**
   * Get notification entries.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.notification, ctx.query)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Get a specific notification.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.notification, ctx.params)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  notificationDetails: async (ctx) => {
    try {
      let user = ctx.session.passport.user
      let filter = {
        where: {
          recipient: {
            eq: `${user.id}`
          }
        }
      }
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.notification, ctx.params, filter)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Create a/an notification entry.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.notification, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Update a/an notification entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.notification, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Destroy a/an notification entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.notification, ctx.params)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Add relation to a specific notification.
   *
   * @return {Object}
   */

  createRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.addRelation(strapi.models.notification, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Update relation to a specific notification.
   *
   * @return {Object}
   */

  updateRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.editRelation(strapi.models.notification, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * @api {post} /notification/:id/read Mark notification is read
   * @apiName markRead
   * @apiGroup Notification
   * @apiPermission isAuthenticated
   * @apiUse JsonApiHeaders
   *
   * @apiDescription the user mark a notification is read
   * @apiParam {String} id UUID of notification
   * @apiParam {Object} data
   * @apiParam {String} data.type Must be `notification`
   *
   * @apiSuccess {Object} notification
   * @apiError E_RESOURCE_NOT_EXISTS 404 Either the invoice doesn't exist or it
   * doesn't belong to the logged in user
   *
   */
  markRead: async (ctx) => {
    try {
      ctx.body = await strapi.services.notification.setNotifcationStatus(ctx, true)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },

  markUnread: async (ctx) => {
    try {
      ctx.body = await strapi.services.notification.setNotifcationStatus(ctx, false)
    } catch (err) {
      console.log(err)
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },

  markAllAsRead: async (ctx) => {
    try {
      ctx.body = await strapi.services.notification.setAllNotificationStatuses(ctx, true)
    } catch (err) {
      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },

  /**
   * Destroy relation to a specific notification.
   *
   * @return {Object}
   */

  destroyRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.removeRelation(
        strapi.models.notification,
        ctx.params,
        ctx.request.body
      )
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  }
}
