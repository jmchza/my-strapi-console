'use strict'

/**
 * A set of functions called "actions" for `Email`
 */

module.exports = {
  /**
   * Get email entries.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      // ctx.body = await strapi.services.email.test(ctx.query);
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.email, ctx.query)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Get a specific email.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.email, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Create a/an email entry.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.email, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Update a/an email entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.email, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Destroy a/an email entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.email, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Add relation to a specific email.
   *
   * @return {Object}
   */

  createRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.addRelation(strapi.models.email, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Update relation to a specific email.
   *
   * @return {Object}
   */

  updateRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.editRelation(strapi.models.email, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Destroy relation to a specific email.
   *
   * @return {Object}
   */

  destroyRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.removeRelation(strapi.models.email, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  }
}
