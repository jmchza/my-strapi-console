"use strict"

/**
 * A set of functions called "actions" for `Statushistory`
 */

module.exports = {
  /**
   * Get statushistory entries.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      // ctx.body = await strapi.services.statushistory.test(ctx.query);
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.statushistory, ctx.query)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Get a specific statushistory.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.statushistory, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Create a/an statushistory entry.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.statushistory, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Update a/an statushistory entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.statushistory, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Destroy a/an statushistory entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.statushistory, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Add relation to a specific statushistory.
   *
   * @return {Object}
   */

  createRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.addRelation(strapi.models.statushistory, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Update relation to a specific statushistory.
   *
   * @return {Object}
   */

  updateRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.editRelation(
        strapi.models.statushistory,
        ctx.params,
        ctx.request.body
      )
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Destroy relation to a specific statushistory.
   *
   * @return {Object}
   */

  destroyRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.removeRelation(
        strapi.models.statushistory,
        ctx.params,
        ctx.request.body
      )
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  }
}
