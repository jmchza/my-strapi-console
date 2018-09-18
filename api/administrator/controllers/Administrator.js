"use strict"

const joi = require("joi")

/**
 * A set of functions called "actions" for `User`
 */

module.exports = {
  initCheckBankTransfers: async (ctx) => {
    try {
      const timestampSchema = joi.date().timestamp("unix")
      const result = timestampSchema.validate(ctx.request.body.timeStart)

      if (result.error === null) {
        strapi.services.transaction.checkBankTransfers(ctx.request.body.timeStart)
        ctx.status = 200
        ctx.body = { success: true }
      } else {
        let details = Array.from(result.error.details, el => {
          return { message: el.message }
        })
        ctx.status = 400
        ctx.body = { errors: details }
      }
    } catch (err) {
      ctx.status = 400
      ctx.body = { errors: err }
    }
  },
  generateMonthlySellerSettlement: async (ctx) => {
    await strapi.services.invoice.createMonthlySellerSettlement(ctx.params.id)
    ctx.status = 200
    ctx.body = { success: true }
  },
  editSettingByAdmin: async (ctx) => {
    try {
      ctx.body = strapi.services.app.editSettingByAdmin(ctx)
    } catch (err) {
      console.log(err)
      ctx.status = 400
      ctx.body = { errors: err }
    }
  },
  getSettlements: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.user, ctx.params, {
        includeAll: ["settlements"]
      })
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  getTransactions: async (ctx) => {
    try {
      ctx.body = await strapi.services.administrator.getTransactions(ctx)
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  getInvoices: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.user, ctx.params, {
        includeAll: [
          "invoices.debtor",
          "userlogins",
          "userSettings",
          "primaryBankaccount",
          "legalform",
          "industry",
          "invoices.invoicesale"
        ]
      })
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  getInvoice: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.invoice, ctx.params, {
        includeAll: ["owner", "debtor", "invoiceFile", "invoicesale", "invoicepositions", "statusUpdates"]
      })
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * accept dunning contract.
   *
   * @return {Object|Array}
   */
  acceptDunningContract: async (ctx) => {
    try {
      ctx.body = await strapi.services.administrator.acceptDunningContract(ctx)
    } catch (err) {
      console.log("err:", err)
      if (isNaN(err.status)) {
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
   * reject dunning contract.
   *
   * @return {Object|Array}
   */
  rejectDunningContract: async (ctx) => {
    try {
      ctx.body = await strapi.services.administrator.rejectDunningContract(ctx)
    } catch (err) {
      if (isNaN(err.status)) {
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
  editUserDetail: async (ctx) => {
    try {
      ctx.body = await strapi.services.administrator.editUserDetail(ctx)
    } catch (err) {
      console.log(err)
      if (isNaN(err.status)) {
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
  sendNewsletter: async (ctx) => {
    try {
      ctx.body = await strapi.services.administrator.sendNewsletter(ctx)
    } catch (err) {
      console.log(err)
      if (isNaN(err.status)) {
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
   * retrieve general stats like invoices created for faktoora
   *
   * @return {Object|Array}
   */
  retrieveFaktooraStats: async (ctx) => {
    try {
      ctx.body = await strapi.services.administrator.retrieveFaktooraStats(ctx)
    } catch (err) {
      if (isNaN(err.status)) {
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
