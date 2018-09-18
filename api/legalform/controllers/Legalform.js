'use strict'

/**
 * A set of functions called "actions" for `Legalform`
 */

module.exports = {
  /**
   * Get industry legalforms.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.legalform, ctx.query)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Get a specific legalform.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.legalform, ctx.params)
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.legalform, ctx.request.body)
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
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.legalform, ctx.params, ctx.request.body)
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
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.legalform, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  }
}
