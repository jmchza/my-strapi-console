'use strict'

/**
 * A set of functions called "actions" for `settings`
 */

module.exports = {
  /**
   * Get industry settings.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.offer, ctx.query)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Get a specific settings.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.offer, ctx.params)
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  /**
 * Create a/an model entry.
 *
 * @return {Object}
 */

  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.offer, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Update a/an model entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.offer, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Destroy a/an model entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.offer, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },
  /**
   * Generate an offerNumber
   *
   * @return {Object}
   */
  generateOfferNumber: async (ctx) => {
    try {
      ctx.body = await strapi.services.offer.generateOfferNumber(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  }
}
