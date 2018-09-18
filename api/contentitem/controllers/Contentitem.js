'use strict'

/**
 * A set of functions called "actions" for `settings`
 */

module.exports = {

  findByKeyAndLanguage: async (ctx) => {
    try {
      let content = await Contentitem.forge(ctx.params).fetch()
      if (content && content.id) {
        ctx.body = content
      } else {
        ctx.status = 404
      }
    } catch (err) {
      ctx.status = 400;
      ctx.body = err.toString()
    }
  },

  /**
   * Get industry settings.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.contentitem, ctx.query)
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
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.contentitem, ctx.params)
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
      ctx.body = await strapi.services.jsonapi.add(strapi.models.contentitem, ctx.request.body)
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
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.contentitem, ctx.params, ctx.request.body)
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
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.contentitem, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  }
}
