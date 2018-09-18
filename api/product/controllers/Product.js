"use strict"

/* eslint-disable no-undef */
/**
 * A set of functions called "actions" for `product`
 */

module.exports = {
  /**
   * Get industry settings.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.product, ctx.query)
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
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.product, ctx.params)
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
      ctx.body = await strapi.services.product.createOrUpdate(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Update a/an model entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.product.createOrUpdate(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Destroy a/an model entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.product, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  }
}
