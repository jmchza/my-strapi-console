"use strict"
const parse = require("co-busboy")
const path = require("path")
const fs = require("fs")
const ua = require("universal-analytics")
const JsonApiError = require("../../../utils/json-api-error")

/* eslint-disable no-undef */
/**
 * A set of functions called "actions" for `User`
 */

module.exports = {
  /**
   * @api {post} /register User registry
   * @apiName Registration
   * @apiGroup App
   * @apiPermission none
   *
   * @apiDescription Tries to create new user with related models like user login and bank account
   *
   * @apiParam (required) {String} companyName
   * @apiParam (required) {String} street
   * @apiParam (required) {String} postcode 4 or 5 digits only
   * @apiParam (required) {String} city
   * @apiParam (required) {String} phone
   * @apiParam {String} industry
   * @apiParam (required) {String} firstName
   * @apiParam (required) {String} lastName
   * @apiParam (required) {String} email
   * @apiParam (required) {String} password at least 8 characters
   * @apiParam (required) {String} passwordConfirmation at least 8 characters
   * @apiParam {String} holderName
   * @apiParam (required) {String} iban see <a href="https://en.wikipedia.org/wiki/International_Bank_Account_Number">format</a>
   * @apiParam (required) {String} bic see <a href="https://en.wikipedia.org/wiki/ISO_9362">format</a>
   *
   * @apiSuccess {Object} The newly created `User` model
   *
   * @apiError E_VALIDATION 400 Incoming data is not valid
   * @apiError E_RESOURCE_ALREADY_EXISTS 400 Email or IBAN already exist in system
   */
  initRegisterData: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.initRegisterData(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },
  completeProfileRegistration: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.completeProfileRegistration(ctx)
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
  completeRegistration: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.completeRegistration(ctx)
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
  uploadTask: async (ctx) => {
    try {
      const promises = []
      let part, realName
      const parts = parse(ctx, {
        autoFields: true,
        checkFile: function(fieldname, file, filename) {
          realName = filename
        }
      })
      while ((part = await parts)) {
        promises.push(await strapi.services.upload.upload(part, ctx, "lemonway"))
      }
      const uploadDescriptions = await promises
      ctx.body = await strapi.services.account.uploadTask(ctx, realName, uploadDescriptions && uploadDescriptions[0])
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
  stats: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.stats(ctx)
    } catch (err) {
      ctx.body = err
      ctx.status = 401
    }
  },
  /**
   * get data for invoice overview on dashboard
   */
  getInvoiceStats: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.getInvoiceStats(ctx)
    } catch (err) {
      ctx.body = err
      ctx.status = 401
    }
  },
  statsCurrent: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.statsCurrent(ctx)
    } catch (err) {
      ctx.body = err
      ctx.status = 401
    }
  },

  /**
    * @api {get} /account Account information
    * @apiName GetAccount
    * @apiPermission isAuthenticated
    * @apiGroup Account
    *
    * @apiDescription
    * Retrieves account information
    * Use ctx endpoint to make sure that a user is actually logged in
    *
    * @apiError Unauthenticated 401 The user is not logged in.
    * @apiSuccessExample {json} Success-Response:
    *     HTTP/1.1 200 OK
    {
      "id": 1,
      "created_at": "2016-08-07T17:43:34.278Z",
      "updated_at": "2016-08-07T17:43:34.278Z",
      "companyName": "Faktoora GmbH",
      "street": "Passstraße 5",
      "postcode": "52070",
      "city": null,
      "phone": null,
      "email": "contact@storyxag.com",
      "isValidated": false,
      "isPrivate": true,
      "isBuyer": true,
      "isSeller": true,
      "invoices": [
        ...
      ]
    }
    */

  /**
   * @api {get} /account/:related related objects
   * @apiName GetAccountRelated
   * @apiPermission isAuthenticated
   * @apiGroup Account
   *
   * @apiDescription
   * Retrieves objects related to the account of the logged in user
   * `:related` can be any of:
   * - userlogins
   * - primaryBankaccount
   * - bankaccounts
   *
   * @apiError Unauthenticated 401 The user is not logged in.
   */
  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.getAccount(ctx)
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
   * @api {patch} /account/invoice Invoice
   * @apiName UpdateAccountInvoice
   * @apiPermission isAuthenticated
   * @apiGroup Account
   *
   * @apiParam (required) {Number} id - Invoice identificator
   *
   * @apiDescription Retrieves invoice patch update
   */
  updateInvoice: async (ctx) => {
    // try {
    //   ctx.body = await strapi.services.jsonapi.edit(strapi.models.invoice, ctx.params, ctx.request.body)
    // } catch (err) {
    //   ctx.body = err
    // }
    try {
      ctx.body = await strapi.services.invoice.updateInvoice(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }

      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },

  removeTask: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.removeTask(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }

      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },

  /**
   * @api {get} /account Invoices
   * @apiName GetAccountInvoices
   * @apiPermission isAuthenticated
   * @apiGroup Account
   * @apiUse JsonApiHeaders
   * @apiUse Pagination
   * @apiUse Sorting
   *
   * @apiDescription Retrieves invoices created by the logged in user
   */
  findInvoices: async (ctx) => {
    try {
      // ctx.query = { 'filter[where][seller][eq]': ctx.session.passport.user, 'page[size]': 10 }
      let options = {
        where: {
          owner: {
            eq: ctx.session.passport.user.id
          }
        }
      }
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.invoice, ctx.query, options, { filter: false })
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * @api {get} /account Settlements
   * @apiName GetAccountSettlemtnts
   * @apiPermission isAuthenticated
   * @apiGroup Account
   * @apiUse JsonApiHeaders
   * @apiUse Pagination
   * @apiUse Sorting
   *
   * @apiDescription Retrieves settlement created by the logged in user
   */
  findSettlements: async (ctx) => {
    try {
      // ctx.query = { 'filter[where][seller][eq]': ctx.session.passport.user, 'page[size]': 10 }
      let options = {
        where: {
          owner: {
            eq: ctx.session.passport.user.id
          }
        }
      }
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.settlement, ctx.query, options, {
        filter: false
      })
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  findBoughtInvoices: async (ctx) => {
    try {
      let options = {
        join: {
          type: "innerJoin",
          table: "invoicesale",
          comparator1: "invoicesale.id",
          comparator2: "invoice.invoicesale"
        },
        where: {
          "invoicesale.buyer": {
            eq: ctx.session.passport.user.id
          }
        },
        sort: ["-id", "-updated_at"],
        included: ["debtor", "invoicesale", "industry"]
      }
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.invoice, ctx.query, options, { filter: false })
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  sendNotification: async (ctx) => {
    try {
      io.emit("notification", {
        my: "data"
      })
      // debugger
      ctx.body = {}
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  getUserSettings: async (ctx) => {
    try {
      ctx.body = await Usersetting.query({
        where: { user: ctx.session.passport.user.id }
      }).fetchAll()
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  editUserSetting: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.editSetting(ctx)
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
  searchInvoice: async (ctx) => {
    try {
      ctx.body = await strapi.services.invoice.search(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status || 400
    }
  },
  searchCustomer: async (ctx) => {
    try {
      ctx.body = await strapi.services.customer.search(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status || 400
    }
  },
  searchTemplate: async (ctx) => {
    try {
      ctx.body = await strapi.services.template.search(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status || 400
    }
  },
  addOrEditMyCustomer: async (ctx) => {
    try {
      ctx.body = await strapi.services.customer.addOrEditMyCustomer(ctx)
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
  editCustomerFieldValue: async (ctx) => {
    try {
      ctx.body = await strapi.services.customer.editFielValue(ctx)
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
  directDebitMandate: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.directDebitMandate(ctx)
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
  directDebitMandateCallback: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.directDebitMandateCallback(ctx)
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
  checkEmailExist: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.checkEmailExist(ctx)
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
  checkIbanExist: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.checkIbanExist(ctx)
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
  checkCustomerNumberExist: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.checkCustomerNumberExist(ctx)
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
  checkInvoiceNumber: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.checkInvoiceNumber(ctx)
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
  walletStatusChange: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.walletStatusChange(ctx)
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
  userNotifications: async (ctx) => {
    try {
      let user = ctx.session.passport.user
      let filter = {
        where: {
          recipient: {
            eq: `${user.id}`
          }
        }
      }

      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.notification, ctx.query, filter)
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
  getUserTransactions: async (ctx) => {
    try {
      let user = ctx.session.passport.user
      let filter = {
        andwhere: {
          "transaction.benefactor": {
            eq: user && user.id
          }
        },
        orwhere: {
          "transaction.beneficiary": {
            eq: user && user.id
          }
        }
      }

      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.transaction, ctx.query, filter)
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
  getPaymentStatistic: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.getPaymentStatistic(ctx)
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
  easyRegistration: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.easyRegistration(ctx)
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
  addOrEditOffer: async (ctx) => {
    try {
      ctx.body = await strapi.services.offer.createOrEditOffer(ctx)
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
  findDocuments: async (ctx) => {
    try {
      ctx.body = await strapi.services.document.findDocuments(ctx)
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
  findProducts: async (ctx) => {
    try {
      ctx.body = await strapi.services.product.findProducts(ctx)
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
  uploadDunningContract: async (ctx) => {
    try {
      const promises = []
      const type = "dunningContract"
      let part, realName
      const parts = parse(ctx, {
        autoFields: true,
        checkFile: function(fieldname, file, filename) {
          realName = filename
          if (!_.includes([".pdf"], path.extname(filename.toLowerCase()))) {
            return new JsonApiError(`E_NOT_ALLOW_TYPE`, 400)
          }
        }
      })
      while ((part = await parts)) {
        promises.push(await strapi.services.upload.upload(part, ctx, type, null, realName))
      }
      // Create usersetting to keep track of the uploaded contract
      await strapi.services.account.uploadDunningContract(_.get(ctx, "session.passport.user.id"), promises[0].id)

      const uploadDescriptions = await promises
      ctx.body = uploadDescriptions && uploadDescriptions[0]
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },
  submitDunningContract: async (ctx) => {
    try {
      const result = await strapi.services.account.submitDunningContract(ctx)
      ctx.status = 200
      ctx.body = JSON.stringify(result)
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
  generateDunningContract: async (ctx) => {
    try {
      const result = await strapi.services.account.generateDunningContract(ctx)
      ctx.status = 200
      ctx.body = JSON.stringify(result)
    } catch (err) {
      debugger
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
  confirmDunningContract: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.confirmDunningContract(ctx)
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
  downloadDunningContract: async (ctx) => {
    try {
      let fileDownload = await strapi.services.account.downloadDunningContract(ctx)
      let filename = path.basename(fileDownload)
      let filestream = fs.createReadStream(fileDownload)
      ctx.attachment(filename)
      ctx.body = filestream
    } catch (err) {
      ctx.body = err.details ? { errors: err.details } : err
      ctx.status = err.status || 400
    }
  },
  assignBankTransfer: async (ctx) => {
    try {
      ctx.body = {}
      ctx.status = 200
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
  changePremiumPlan: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.changePremiumPlan(ctx)
      ctx.status = 200
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
  keepCurrentPlan: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.keepCurrentPlan(ctx)
      ctx.status = 200
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
  getCurrentPlan: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.getCurrentPlan(ctx)
      ctx.status = 200
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
   * get settlement for statistic by month or year
   */
  getSettlementStatistic: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.getSettlementStatistic(ctx)
      ctx.status = 200
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
  activation: async (ctx) => {
    try {
      const ctx = ctx
      const Userlogin = await strapi.services.account.activation(ctx)

      // Set form data
      ctx.request.body = Userlogin

      await ctx.state._passport.instance
        .authenticate("signup", async function(err, user, info) {
          if (err) {
            console.log(err, user, info)
          }

          if (info !== undefined) {
            ctx.body = { error: info }
          }

          if (user === false) {
            const loginAttemptNumber = await strapi.services.account.loginAttemps(ctx, false)
            ctx.status = 401
            ctx.body = { success: false, loginAttempts: loginAttemptNumber }
          } else {
            // Successful login
            await strapi.services.account.loginAttemps(ctx, true)
            // Side effects
            await strapi.services.account.login(user)
            await ctx.login(user)

            ua(strapi.config.environments[strapi.config.environment].gaId, user.id)
              .event("Invoice", "Invoice Factored", "User factored an invoice")
              .send()
          }

          ctx.body = {
            success: true,
            user
          }
        })
        (ctx)
    } catch (err) {
      if (isNaN(err.status)) {
        ctx.status = 400
      } else {
        ctx.status = err.status
      }
      if (err.details) {
        ctx.body = err.details
      } else {
        ctx.body = err
      }
    }
  },
  /**
   * save apart info of user when user not finish registration
   */
  updateNotValidatedUserInfo: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.updateNotValidatedUserInfo(ctx)
      ctx.status = 200
    } catch (err) {
      console.log({ err })
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
   * set an account to primary bankaccount
   */
  setUserPrimaryBankaccount: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.setUserPrimaryBankaccount(ctx)
      ctx.status = 200
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
   * add a new bankaccount of user ( not include primaryBankaccount)
   */
  addNewUserBankaccount: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.addNewUserBankaccount(ctx)
      ctx.status = 200
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
  /**
   * remove a bankaccount of user ( not include primaryBankaccount)
   */
  removeUserBankaccount: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.removeUserBankaccount(ctx)
      ctx.status = 200
    } catch (err) {
      console.log({ err })
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
  deleteUserSetting: async (ctx) => {
    try {
      ctx.body = await strapi.services.account.deleteSetting(ctx)
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
