'use strict'

/**
 * A set of functions called "actions" for `Transaction`
 */

module.exports = {
  /**
   * Get transaction entries.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.transaction, ctx.query)
			// strapi.services.invoice.fetchAll(ctx.query);
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Get a specific transaction.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.transaction, ctx.params)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Create a/an transaction entry.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.transaction, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Update a/an transaction entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.transaction, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Destroy a/an transaction entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.transaction, ctx.params)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Add relation to a specific transaction.
   *
   * @return {Object}
   */

  createRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.addRelation(strapi.models.transaction, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Update relation to a specific transaction.
   *
   * @return {Object}
   */

  updateRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.editRelation(strapi.models.transaction, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Destroy relation to a specific transaction.
   *
   * @return {Object}
   */

  destroyRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.removeRelation(strapi.models.transaction, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  confirmMandate: async (ctx) => {
    try {
      ctx.body = await strapi.services.transaction.acceptDirectDebitMandate(ctx)
      ctx.status = 200
    } catch (err) {
      ctx.status = err.status
      ctx.body = err.details
    }
  },
  moneyReceived: async (ctx) => {
    try {
      ctx.body = await strapi.services.transaction.moneyReceived(ctx)
    } catch (err) {
      if (isNaN(err.status)) {
        ctx.status = 400
      } else {
        ctx.status = err.status
      }
      if (err.details) {
        ctx.body = { 'errors': err.details }
      } else {
        ctx.body = { 'errors': JSON.stringify(err) }
      }
    }
  },
  getTransactions:  async (ctx) => {
    try {
      ctx.body = await strapi.services.transaction.getTransactions(ctx)
    } catch (err) {
      console.log({err})
      if (isNaN(err.status)) {
        ctx.status = 400
      } else {
        ctx.status = err.status
      }
      if (err.details) {
        ctx.body = { 'errors': err.details }
      } else {
        ctx.body = { 'errors': JSON.stringify(err) }
      }
    }
  },
  createWithdrawal: async (ctx) => {
    try {
      const user = ctx.session.passport.user || {}
      const {amount} = (ctx.request && ctx.request.body) || 0
      ctx.body = await strapi.services.transaction.createWithdrawal(user, amount)
    } catch (err) {
      if (isNaN(err.status)) {
        ctx.status = 400
      } else {
        ctx.status = err.status
      }
      if (err.details) {
        ctx.body = { 'errors': err.details }
      } else {
        ctx.body = { 'errors': JSON.stringify(err) }
      }
    }
  },
  createDeposit: async (ctx) => {
    try {
      const user = ctx.session.passport.user || {}
      const {amount} = (ctx.request && ctx.request.body) || 0
      ctx.body = await strapi.services.transaction.createDeposit(user, amount)
    } catch (err) {
      if (isNaN(err.status)) {
        ctx.status = 400
      } else {
        ctx.status = err.status
      }
      if (err.details) {
        ctx.body = { 'errors': err.details }
      } else {
        ctx.body = { 'errors': JSON.stringify(err) }
      }
    }
  }
}
