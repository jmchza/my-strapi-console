"use strict"

/**
 * A set of functions called "actions" for `settlements`
 */

module.exports = {
  /**
   * Get industry settlements.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.settlement, ctx.query)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Get a specific settlements.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.settlement, ctx.params)
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
      let user = ctx.session.passport.user
      let data = Object.assign({}, ctx.request.body, { owner: user.id })
      ctx.body = await strapi.services.jsonapi.add(strapi.models.settlement, data)
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
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.settlement, ctx.params, ctx.request.body)
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
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.settlement, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },
  addPaymentMethod: async (ctx) => {
    try {
      ctx.body = await strapi.services.settlement.addPaymentMethod(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status || 400
    }
  },
  pay: async (ctx) => {
    try {
      ctx.body = await strapi.services.settlement.pay(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status || 400
    }
  }
}
