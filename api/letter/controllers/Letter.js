"use strict"

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
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.letter, ctx.query)
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
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.letter, ctx.params)
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  /**
   * Create a/an model entry.
   *
   * @return {Object}
   */

  createOrEditLetter: async (ctx) => {
    try {
      ctx.body = await strapi.services.letter.createOrEditLetter(ctx)
    } catch (err) {
      if (isNaN(err.status)) {
        console.log(err)
        ctx.status = 400
      } else {
        ctx.status = err.status
      }
      if (err.details) {
        ctx.body = { errors: err.details }
      } else {
        ctx.body = { errors: JSON.stringify(err) }
      }
    }
  },
  /**
   * Create a/an model entry.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.letter, ctx.request.body)
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
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.letter, ctx.params, ctx.request.body)
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
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.letter, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },
  createReminder: async (ctx) => {
    try {
      ctx.body = await strapi.services.letter.createReminder(ctx)
    } catch (err) {
      if (isNaN(err.status)) {
        console.log(err)
        ctx.status = 400
      } else {
        ctx.status = err.status
      }
      if (err.details) {
        ctx.body = { errors: err.details }
      } else {
        ctx.body = { errors: JSON.stringify(err) }
      }
    }
  }
}
