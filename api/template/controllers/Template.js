'use strict'

/**
 * A set of functions called "actions" for `Template`
 */
const _ = require('lodash')

module.exports = {
  /**
   * Get template entries.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.template, ctx.query)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Get a specific template.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.template, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Create a/an template entry.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    try {
      const user = ctx.session.passport.user
      const data = _.assign(ctx.request.body, {user: user.id})
      ctx.body = await strapi.services.jsonapi.add(strapi.models.template, data)
    } catch (err) {
      console.log(err)
      ctx.body = err
    }
  },

  /**
   * Update a/an template entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.template, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Destroy a/an template entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.template.remove(ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Add relation to a specific template.
   *
   * @return {Object}
   */

  createRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.template.addRelation(ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Update relation to a specific template.
   *
   * @return {Object}
   */

  updateRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.template.editRelation(ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Destroy relation to a specific template.
   *
   * @return {Object}
   */

  destroyRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.template.removeRelation(ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  }
}
