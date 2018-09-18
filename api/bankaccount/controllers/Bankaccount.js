"use strict"

const finApi = require("../../../utils/finApi")
const _ = require("lodash")
/**
 * A set of functions called "actions" for `Bankaccount`
 */

module.exports = {
  /**
   * Get all user figo banks
   *
   * @return {Object}
   */
  findAllBankAccounts: async (ctx) => {
    try {
      ctx.body = await finApi.getAndSearchAllAccounts({}, ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }

      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },
  getAndSearchAllBanks: async (ctx) => {
    try {
      ctx.body = await finApi.getAndSearchAllBanks({}, ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }

      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },
  /**
   * Get all user figo banks
   *
   * @return {Object}
   */
  findTransactionsByAccountIds: async (ctx) => {
    try {
      ctx.body = await finApi.getAndSearchAllTransactions(
        _.assign({ includeChildCategories: false }, ctx.query),
        ctx
      )
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }

      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },
  importBankConnection: async (ctx) => {
    try {
      ctx.body = await finApi.importBankConnection({}, ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },
  editBankConnection: async (ctx) => {
    try {
      ctx.body = await finApi.editBankConnection({}, ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },
  deleteBankConnection: async (ctx) => {
    try {
      ctx.body = await finApi.deleteBankConnection({}, ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },
  /**
   * Get all user figo banks
   *
   * @return {Object}
   */
  createUserFinapi: async (ctx) => {
    try {
      ctx.body = await strapi.services.bankaccount.createUserFinapi(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }

      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },

  /**
   * Get BIC from IBAN
   *
   * @return {Object}
   */

  getbic: async (ctx) => {
    try {
      ctx.body = await strapi.services.bankaccount.getbic(ctx, ctx.query.onlyGetBic)
    } catch (err) {
      ctx.status = err.status || 400
      ctx.body = err.details
    }
  },

  /**
   * Get bankaccount entries.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.bankaccount, ctx.query)
      // strapi.services.invoice.fetchAll(ctx.query)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Get a specific bid.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.bankaccount, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Create a/an bankaccount entry.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.bankaccount, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Update a/an bankaccount entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.bankaccount, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Destroy a/an bankaccount entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.bankaccount, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Add relation to a specific bankaccount.
   *
   * @return {Object}
   */

  createRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.bankaccount.addRelation(ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Update relation to a specific bankaccount.
   *
   * @return {Object}
   */

  updateRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.bankaccount.editRelation(ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Destroy relation to a specific bankaccount.
   *
   * @return {Object}
   */

  destroyRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.bankaccount.removeRelation(ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  }
}
