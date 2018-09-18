"use strict"

const fs = require("fs")
const path = require("path")
const _ = require("lodash")
const joi = require("joi")
const co = require("co")
const IBAN = require("iban")
const Chance = require("chance")
const chance = new Chance()
const uuid = require("node-uuid")
const ua = require("universal-analytics")
const moment = require("moment")
const {
  beneficialAvailable,
  getTasks,
  addTask,
  removeTask,
  initTaskFromType,
  registerLemonWay,
  registerIbanLemonWay,
  getWalletDetails,
  registerSddMandate,
  signDocumentInit,
  isFinishedAllTask,
  linkAllDocument
} = require("../../../utils/lemonway")
const JsonApiError = require("../../../utils/json-api-error")
const worker = require("../../../utils/worker")
const RESTClient = require("../../../utils/RESTClient")
const IBAN_SERVICE_URL = "https://fintechtoolbox.com/bankcodes/[code].json"
const common = require("../../../utils/common")

// function sleep (ms) {
//   return new Promise(resolve => setTimeout(resolve, ms))
// }

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, "") // Trim - from end of text
}

module.exports = {
  editSetting: co.wrap(function*(ctx) {
    const body = ctx.request.body
    let values = body
    const schema = joi.object().keys({
      key: joi.string().required(),
      value: joi.string().required()
    })
    const result = joi.validate(values, schema, {
      allowUnknown: false,
      abortEarly: false
    })
    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    const setting = yield Usersetting.forge({
      user: ctx.session.passport.user.id,
      key: values.key
    }).fetch()
    values.user = ctx.session.passport.user.id
    if (setting) {
      yield setting.save(values)
    } else {
      yield strapi.services.jsonapi.add(strapi.models.usersetting, values)
    }
    const setttings = yield Usersetting.query({
      where: { user: ctx.session.passport.user.id }
    })
      .orderBy("created_at", "DESC")
      .fetchAll()
    return setttings
  }),
  stats: async function(ctx) {
    let results = {}
    const user = ctx.session.passport.user
    if (user) {
      let date = new Date()
      let currentDay = date.getDate()
      let currentMonth = date.getMonth()
      let currentYear = date.getFullYear()
      let now = chance.date({
        string: true,
        day: currentDay,
        month: currentMonth,
        year: currentYear
      })
      let next3Days = chance.date({
        string: true,
        day: currentDay + 3,
        month: currentMonth,
        year: currentYear
      })
      let last2Days = chance.date({
        string: true,
        day: currentDay - 2,
        month: currentMonth,
        year: currentYear
      })
      let next7Days = chance.date({
        string: true,
        day: currentDay + 7,
        month: currentMonth,
        year: currentYear
      })
      try {
        if (user.isSeller) {
          // sold invoice
          let sumSold = await Invoice.query(function(qb) {
            qb.sum("invoice.amount as sumSoldInvoiceAmount")
            qb.sum("invoicesale.highestBid as sumSoldBidAmount")
            qb.count("invoice.id as totalInvoiceSold")
            qb.innerJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
            qb.where("invoice.owner", "=", user.id)
            qb.where(function() {
              this.orWhere("status", "=", "sold")
            })
          }).fetch()
          sumSold = sumSold.toJSON() || {}
          results.invoicesSold = (sumSold && sumSold.totalInvoiceSold) || 0
          results.sumSoldInvoiceAmount = (sumSold && sumSold.sumSoldInvoiceAmount) || 0
          results.sumSoldBidAmount = (sumSold && sumSold.sumSoldBidAmount) || 0
          // invoice sell paid
          let sumSellPaid = await Invoice.query(function(qb) {
            qb.sum("invoice.amount as sumSellPaidInvoiceAmount")
            qb.sum("invoicesale.highestBid as sumSellPaidBidAmount")
            qb.count("invoice.id as totalInvoiceSellPaid")
            qb.innerJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
            qb.where("invoice.owner", "=", user.id)
            qb.where(function() {
              this.where("status", "=", "paid")
              this.orWhere("status", "=", "completed")
            })
          }).fetch()
          sumSellPaid = sumSellPaid.toJSON() || {}
          results.invoiceSellPaid = (sumSellPaid && sumSellPaid.totalInvoiceSellPaid) || 0
          results.sumSellPaidInvoiceAmount = (sumSellPaid && sumSellPaid.sumSellPaidInvoiceAmount) || 0
          results.sumSellPaidBidAmount = (sumSellPaid && sumSellPaid.sumSellPaidBidAmount) || 0
          // created invoice
          let sumCreated = await Invoice.query(function(qb) {
            qb.sum("invoice.amount as sumCreatedInvoiceAmount")
            qb.count("invoice.id as totalInvoiceCreated")
            qb.where("invoice.owner", "=", user.id)
          }).fetch()
          sumCreated = sumCreated.toJSON() || {}
          results.invoicesCreated = (sumCreated && sumCreated.totalInvoiceCreated) || 0
          results.sumCreatedInvoiceAmount = (sumCreated && sumCreated.sumCreatedInvoiceAmount) || 0
          // active invoice
          let sumInvoiceActive = await Invoice.query(function(qb) {
            qb.sum("invoice.amount as sumActiveInvoiceAmount")
            qb.count("invoice.id as totalInvoiceActive")
            qb.innerJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
            qb.where("invoice.owner", "=", user.id)
            qb.where(function() {
              this.where("status", "=", "available")
            })
          }).fetch()
          sumInvoiceActive = sumInvoiceActive.toJSON() || {}
          results.invoicesActive = (sumInvoiceActive && sumInvoiceActive.totalInvoiceActive) || 0
          results.sumActiveInvoiceAmount = (sumInvoiceActive && sumInvoiceActive.sumActiveInvoiceAmount) || 0

          // invoice due date 7 day and status in 'created', 'sent', 'available', 'aborted'
          let invoiceDueDateRecommendation = await Invoice.query(function(qb) {
            qb.where("invoice.owner", "=", user.id)
            qb.where("invoice.lastPaymentDate", "<=", next7Days).andWhere("invoice.lastPaymentDate", ">=", now)
            qb.where(function() {
              this.where("status", "in", ["created", "sent", "available", "aborted", "inkasso"])
            })
          }).fetchAll({ withRelated: ["debtor"] })
          results.invoiceDueDateRecommendation = invoiceDueDateRecommendation.toJSON() || []

          // invoices that already passed the duedate
          let invoiceOverDueDateRecommendation = await Invoice.query(function(qb) {
            qb.where("invoice.owner", "=", user.id)
            qb.where("invoice.lastPaymentDate", "<", now)
            qb.where(function() {
              this.where("status", "in", ["created", "sent", "available", "aborted", "inkasso", "overdue"])
            })
          }).fetchAll({ withRelated: ["debtor"] })
          results.invoiceOverDueDateRecommendation = invoiceOverDueDateRecommendation.toJSON() || []

          // 3 next days
          let sumCreatedDueNext3Days = await Invoice.query(function(qb) {
            qb.sum("invoice.amount as sumCreatedInvoiceAmount")
            qb.sum("invoicesale.highestBid as sumCreatedBidAmount")
            qb.count("invoice.id as totalInvoiceCreated")
            qb.innerJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
            qb.where("invoice.owner", "=", user.id)
            qb.where("invoice.lastPaymentDate", ">=", now).andWhere("invoice.lastPaymentDate", "<=", next3Days)
          }).fetch()
          sumCreatedDueNext3Days = (sumCreatedDueNext3Days && sumCreatedDueNext3Days.toJSON()) || {}
          results.sumCreatedDueNext3Days = (sumCreatedDueNext3Days && sumCreatedDueNext3Days.totalInvoiceCreated) || 0
          results.sumCreatedDueNext3DaysInvoiceAmount =
            (sumCreatedDueNext3Days && sumCreatedDueNext3Days.sumCreatedInvoiceAmount) || 0
          results.sumCreatedDueNext3DaysBidAmount =
            (sumCreatedDueNext3Days && sumCreatedDueNext3Days.sumCreatedBidAmount) || 0
          // overdue date
          let sumSellOverDue = await Invoice.query(function(qb) {
            qb.sum("invoice.amount as sumSellInvoiceAmount")
            qb.count("invoice.id as totalInvoiceSell")
            qb.leftJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
            qb.where("invoice.owner", "=", user.id)
            qb.where("invoice.status", "=", "overdue")
          }).fetch()

          sumSellOverDue = (sumSellOverDue && sumSellOverDue.toJSON()) || {}
          results.invoicesSellOverDue = (sumSellOverDue && sumSellOverDue.totalInvoiceSell) || 0
          results.sumSellOverDueInvoiceAmount = (sumSellOverDue && sumSellOverDue.sumSellInvoiceAmount) || 0
        }

        // statistic invoice for buyer
        if (user.isBuyer) {
          // bought invoice
          let sumBought = await Invoice.query(function(qb) {
            qb.sum("invoice.amount as sumBoughtInvoiceAmount")
            qb.sum("invoicesale.highestBid as sumBoughtBidAmount")
            qb.count("invoice.id as totalInvoiceBought")
            qb.innerJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
            qb.where("invoicesale.buyer", "=", user.id)
            qb.where(function() {
              this.where("status", "=", "paid")
              this.orWhere("status", "=", "sold")
              this.orWhere("status", "=", "overdue")
            })
          }).fetch()
          sumBought = sumBought.toJSON() || {}
          results.invoicesBought = (sumBought && sumBought.totalInvoiceBought) || 0
          results.sumBoughtInvoiceAmount = (sumBought && sumBought.sumBoughtInvoiceAmount) || 0
          results.sumBoughtBidAmount = (sumBought && sumBought.sumBoughtBidAmount) || 0
          results.averageDiscount =
            (sumBought.sumBoughtInvoiceAmount - sumBought.sumBoughtBidAmount) / sumBought.sumBoughtInvoiceAmount * 100
          // 3 next days
          let sumBoughtDueNext3Days = await Invoice.query(function(qb) {
            qb.sum("invoice.amount as sumBoughtInvoiceAmount")
            qb.sum("invoicesale.highestBid as sumBoughtBidAmount")
            qb.count("invoice.id as totalInvoiceBought")
            qb.innerJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
            qb.where("invoicesale.buyer", "=", user.id).andWhere("status", "=", "sold")
            qb.where("invoice.lastPaymentDate", ">=", now).andWhere("invoice.lastPaymentDate", "<=", next3Days)
          }).fetch()
          sumBoughtDueNext3Days = (sumBoughtDueNext3Days && sumBoughtDueNext3Days.toJSON()) || {}
          results.invoicesBoughtNext3Days = (sumBoughtDueNext3Days && sumBoughtDueNext3Days.totalInvoiceBought) || 0
          results.sumBoughtNext3DaysInvoiceAmount =
            (sumBoughtDueNext3Days && sumBoughtDueNext3Days.sumBoughtInvoiceAmount) || 0
          results.sumBoughtNext3DaysBidAmount = (sumBoughtDueNext3Days && sumBoughtDueNext3Days.sumBoughtBidAmount) || 0
          // over due date
          let sumBoughtOverDue = await Invoice.query(function(qb) {
            qb.sum("invoice.amount as sumBoughtInvoiceAmount")
            qb.sum("invoicesale.highestBid as sumBoughtBidAmount")
            qb.count("invoice.id as totalInvoiceBought")
            qb.innerJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
            qb.where("invoicesale.buyer", "=", user.id).andWhere("status", "=", "sold")
            qb.where("invoice.lastPaymentDate", "<", now)
          }).fetch()
          sumBoughtOverDue = (sumBoughtOverDue && sumBoughtOverDue.toJSON()) || {}
          results.invoicesBoughtOverDue = (sumBoughtOverDue && sumBoughtOverDue.totalInvoiceBought) || 0
          results.sumBoughtOverDueInvoiceAmount = (sumBoughtOverDue && sumBoughtOverDue.sumBoughtInvoiceAmount) || 0
          results.sumBoughtOverDueBidAmount = (sumBoughtOverDue && sumBoughtOverDue.sumBoughtBidAmount) || 0
          // paid invoices
          let sumPaid = await Invoice.query(function(qb) {
            qb.sum("invoice.amount as sumPaidInvoiceAmount")
            qb.sum("invoicesale.highestBid as sumPaidBidAmount")
            qb.count("invoice.id as totalInvoicePaid")
            qb.innerJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
            qb.where("invoicesale.buyer", "=", user.id).andWhere("status", "=", "paid")
            // qb.debug(true)
          }).fetch()
          sumPaid = (sumPaid && sumPaid.toJSON()) || {}
          results.invoicesPaid = (sumPaid && sumPaid.totalInvoicePaid) || 0
          results.sumPaidInvoiceAmount = (sumPaid && sumPaid.sumPaidInvoiceAmount) || 0
          results.sumPaidBidAmount = (sumPaid && sumPaid.sumPaidBidAmount) || 0
          // status invoice bid not not bought
          let sumInvoiceBid = await Invoice.query(function(qb) {
            qb.sum("invoice.amount as sumBidInvoiceAmount")
            qb.count("invoice.id as totalInvoiceBid")
            qb.innerJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
            // qb.innerJoin(`bid`, `invoicesale.id`, `bid.invoicesale`)
            qb.where("status", "=", "available")
            qb.whereIn("invoicesale.id", function() {
              this.select("bid.invoicesale")
                .from("bid")
                .where(`bid.bidder`, "=", user.id)
            })
            // qb.debug(true)
          }).fetch()
          sumInvoiceBid = (sumInvoiceBid && sumInvoiceBid.toJSON()) || {}
          results.invoicesBidding = (sumInvoiceBid && sumInvoiceBid.totalInvoiceBid) || 0
          results.sumBidInvoiceAmount = (sumInvoiceBid && sumInvoiceBid.sumBidInvoiceAmount) || 0
        }
        // add selling stats
        results.invoicesSelling = await Invoice.query(qb => {
          qb.innerJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
          qb.where("invoice.owner", "=", user.id).andWhere("status", "=", "available")
        }).count()
        // news invoice created
        results.invoiceNewCreated = await Invoicesale.query(qb => {
          qb.innerJoin("invoice", "invoicesale.id", "invoice.invoicesale")
          qb.where("invoicesale.created_at", ">=", last2Days)
          qb.where(`invoice.status`, "available")
        }).count()
        // notification not read
        results.invoiceNotifications = await Notification.query(qb => {
          qb.where("recipient", user.id).andWhere("read", false)
        }).count()
      } catch (err) {
        console.log("err:", err)
      }
    }
    return results
  },
  getInvoiceStats: async function(ctx) {
    let user = ctx.session && ctx.session.passport && ctx.session.passport.user
    let { startDate, endDate } = ctx.query || null
    // let currentDate = moment()
    //   .endOf("day")
    //   .toISOString()
    // let last30Day = moment()
    //   .startOf("day")
    //   .add(-30, "days")
    //   .toISOString()
    // startDate = endDate || last30Day
    // endDate = endDate || currentDate

    // const schema = joi.object().keys({
    //   startDate: joi.date(),
    //   endDate: joi.date()
    // })
    // validate data
    // const result = joi.validate({ startDate, endDate }, schema, {
    //   allowUnknown: true,
    //   abortEarly: false
    // })
    // Throw validate errors
    // if (result.error !== null) {
    //   let details = Array.from(result.error.details, el => {
    //     return { message: el.message }
    //   })
    //   throw new JsonApiError(`E_VALIDATION`, 400, details)
    // }

    let results = {}
    if (user.isSeller) {
      // draft invoice
      let invoiceDraftModel = await Invoice.query(function(qb) {
        qb.sum("amount as totalAmount")
        qb.count("id as totalItem")
        qb.where("owner", "=", user.id)
        qb.where(function() {
          this.where("status", "draft")
        })
      }).fetch()
      let invoiceDraft = (invoiceDraftModel && invoiceDraftModel.toJSON()) || {}
      results.draft = {
        count: (invoiceDraft && invoiceDraft.totalItem) || 0,
        totalAmount: (invoiceDraft && invoiceDraft.totalAmount) || 0
      }

      // created invoice
      let invoiceCreatedModel = await Invoice.query(function(qb) {
        qb.sum("amount as totalAmount")
        qb.count("id as totalItem")
        qb.where("owner", "=", user.id)
        if (startDate && endDate) {
          qb.where("invoice.created_at", "<=", endDate).andWhere("invoice.created_at", ">=", startDate)
        }
        qb.where(function() {
          this.whereIn("status", ["created", "review", "available", "sent", "aborted", "rejected"])
        })
      }).fetch()
      let invoiceCreated = (invoiceCreatedModel && invoiceCreatedModel.toJSON()) || {}
      results.created = {
        count: (invoiceCreated && invoiceCreated.totalItem) || 0,
        totalAmount: (invoiceCreated && invoiceCreated.totalAmount) || 0
      }

      // paid date
      let invoicePaidModel = await Invoice.query(function(qb) {
        qb.count("invoice.id as totalItem")
        qb.sum("invoice.amount as totalAmount")
        qb.count("invoice.id as totalInvoiceSold")
        if (startDate && endDate) {
          qb.where("invoice.lastPaymentDate", "<=", endDate).andWhere("invoice.lastPaymentDate", ">=", startDate)
        }
        qb.where("invoice.owner", "=", user.id)
        qb.whereIn("invoice.status", ["sold", "paid", "paidCash"])
      }).fetch()
      let invoicePaid = (invoicePaidModel && invoicePaidModel.toJSON()) || {}
      results.paid = {
        count: (invoicePaid && invoicePaid.totalItem) || 0,
        totalAmount: (invoicePaid && invoicePaid.totalAmount) || 0
      }

      // overdue date
      let invoiceOverDueModel = await Invoice.query(function(qb) {
        qb.sum("invoice.amount as totalAmount")
        qb.count("invoice.id as totalItem")
        // qb.leftJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
        if (startDate && endDate) {
          qb.where("invoice.lastPaymentDate", "<=", endDate).andWhere("invoice.lastPaymentDate", ">=", startDate)
        }
        qb.where("invoice.owner", "=", user.id)
        qb.where("invoice.status", "=", "overdue")
      }).fetch()
      let invoiceOverDue = (invoiceOverDueModel && invoiceOverDueModel.toJSON()) || {}
      results.overdue = {
        count: (invoiceOverDue && invoiceOverDue.totalItem) || 0,
        totalAmount: (invoiceOverDue && invoiceOverDue.totalAmount) || 0
      }

      // collection date
      let invoiceCollectionModel = await Invoice.query(function(qb) {
        qb.sum("invoice.amount as totalAmount")
        qb.count("invoice.id as totalItem")
        // qb.leftJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
        if (startDate && endDate) {
          qb.where("invoice.lastPaymentDate", "<=", endDate).andWhere("invoice.lastPaymentDate", ">=", startDate)
        }
        qb.where("invoice.owner", "=", user.id)
        qb.where("invoice.status", "=", "inkasso")
      }).fetch()
      let invoiceCollection = (invoiceCollectionModel && invoiceCollectionModel.toJSON()) || {}
      results.inkasso = {
        count: (invoiceCollection && invoiceCollection.totalItem) || 0,
        totalAmount: (invoiceCollection && invoiceCollection.totalAmount) || 0
      }
    } else {
      // bounght date
      let invoiceBoughtModel = await Invoice.query(function(qb) {
        qb.innerJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
        qb.count("invoice.id as totalItem")
        qb.sum("invoice.amount as totalAmount")
        qb.where("invoicesale.buyer", "=", user.id)
      }).fetch()
      let invoiceBought = (invoiceBoughtModel && invoiceBoughtModel.toJSON()) || {}
      results.bought = {
        count: (invoiceBought && invoiceBought.totalItem) || 0,
        totalAmount: (invoiceBought && invoiceBought.totalAmount) || 0
      }

      // paid
      let invoicePaidModel = await Invoice.query(function(qb) {
        qb.innerJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
        qb.count("invoice.id as totalItem")
        qb.sum("invoice.amount as totalAmount")
        qb.count("invoice.id as totalInvoiceSold")
        qb.where("invoicesale.buyer", "=", user.id)
        qb.whereIn("invoice.status", ["sold", "paid", "paidCash"])
      }).fetch()
      let invoicePaid = (invoicePaidModel && invoicePaidModel.toJSON()) || {}
      results.paid = {
        count: (invoicePaid && invoicePaid.totalItem) || 0,
        totalAmount: (invoicePaid && invoicePaid.totalAmount) || 0
      }
      // overdue
      let invoiceOverDueModel = await Invoice.query(function(qb) {
        qb.innerJoin("invoicesale", "invoicesale.id", "invoice.invoicesale")
        qb.sum("invoice.amount as totalAmount")
        qb.count("invoice.id as totalItem")
        qb.where("invoicesale.buyer", "=", user.id)
        qb.where("invoice.status", "=", "overdue")
      }).fetch()
      let invoiceOverDue = (invoiceOverDueModel && invoiceOverDueModel.toJSON()) || {}
      results.overdue = {
        count: (invoiceOverDue && invoiceOverDue.totalItem) || 0,
        totalAmount: (invoiceOverDue && invoiceOverDue.totalAmount) || 0
      }
    }
    return results
  },
  statsCurrent: async function(ctx) {
    let result = {}
    const user = ctx.session.passport.user
    if (user && user.id) {
      result.totalInvoicesale = await Invoice.query(qb => {
        qb.where("owner", "=", user.id)
      }).count()
    }
    return result
  },
  easyRegistration: async function(ctx) {
    try {
      const body = ctx.request.body
      let values = body

      // Validate incoming data
      const schema = joi
        .object()
        .keys({
          clientId: joi.string().only("datracon"),
          legalform: joi.string().guid(),
          companyName: joi.string(),
          firstName: joi.string(),
          lastName: joi.string(),
          email: joi
            .string()
            .required()
            .email(),
          password: joi
            .string()
            .required()
            .min(8),
          plan: joi.string().default("startup"),
          taxExempt: joi.boolean()
          // passwordConfirmation: joi
          //   .string()
          //   .required()
          //   .min(8)
        })
        .xor("isBuyer", "isSeller")

      const result = joi.validate(values, schema, {
        allowUnknown: true,
        abortEarly: false
      })
      // Throw validate errors
      if (result.error !== null) {
        let details = Array.from(result.error.details, el => {
          return { message: el.message }
        })
        throw new JsonApiError(`E_VALIDATION`, 400, details)
      }

      // Check whether email already exists
      let userLoginModel = await Userlogin.query({
        where: { email: values.email }
      }).fetch() // or null
      if (userLoginModel !== null) {
        throw new JsonApiError("E_RESOURCE_ALREADY_EXISTS", 400, `User with email ${values.email} already exist`)
      }

      const activationCode = uuid.v4()

      if (!values.isSeller) values.isSeller = false
      if (!values.isBuyer) values.isBuyer = false
      values.isMain = true
      values.isVerified = false
      values.activationCode = activationCode
      let user = await User.forge(
        _.pick(values, [
          "companyName",
          "isBuyer",
          "isSeller",
          "activationCode",
          "legalform",
          "executiveName",
          "clientId",
          "taxExempt"
        ])
      ).save()
      const userlogin = _.pick(values, ["email", "firstName", "lastName", "isMain", "isVerified"])
      userlogin.passwordHash = values.password
      await user.userlogins().create(userlogin)

      // Set plan for the user
      if (["basic", "premium"].includes(values.plan)) {
        let startDate = new Date()
        let endDate = moment(startDate).add(1, "M")
        let price = 9.0
        if (values.plan === "premium") {
          price = 29.0
        }

        const newSubscription = await Subscription.forge({
          user: user.id,
          plan: values.plan,
          isCurrent: true,
          price,
          startDate,
          endDate,
          period: "month"
        }).save()
      }
      //

      // send notification
      await Notification.forge({
        type: `registrationEasyComplete`,
        data: {
          link: `${strapi.config.environments[strapi.config.environment].frontendUrl}/complete-registration/step/1`,
          activeLink: `${strapi.config.environments[strapi.config.environment].frontendUrl}/account-registration/${activationCode}/verify`,
          email: userlogin.email
        },
        recipient: user.id
      }).save()

      // send mail for notification have new user.
      await Email.forge({
        data: {
          subject: `app.notification.newUserRegistered.summary`,
          content: `app.notification.newUserRegistered.text`,
          name: `faktoora Team`,
          companyName: user.attributes.companyName,
          executiveName: body.executiveName,
          email: body.email,
          plan: body.plan
        },
        template: "notification",
        to: strapi.config.environments[strapi.config.environment].adminEmail
      }).save()

      // log to google analytics
      let visitor = ua(strapi.config.environments[strapi.config.environment].gaId)
      visitor
        .event(
          "Registration",
          "Easy registration completed",
          "Easy registration completed",
          // 1,
          // {user: values.companyName},
          err => {
            if (err) console.log("err:", err)
          }
        )
        .send()

      return await strapi.services.jsonapi.fetch(strapi.models.user, {
        id: user.id
      })
    } catch (err) {
      strapi.log.error(err)
      console.log("err:", err)
      throw err
    }
  },
  initRegisterData: async function(ctx) {
    try {
      const body = ctx.request.body
      let values = body
      let userSession = ctx.session.passport && ctx.session.passport.user
      let schema
      let isCompleteProfileMode = false
      let userExistModel
      if (userSession && userSession.id) {
        // Validate incoming data
        schema = joi
          .object()
          .keys({
            companyName: joi.string().required(),
            executiveName: joi.string(), // .required(),
            tradeRegisterNumber: joi.string(),
            valueAddedTaxId: joi.string().regex(common.VALUE_ADDED_TAXID_REGEX),
            taxIdentNumber: joi.string().regex(common.TAX_IDENT_NUMBER_REGEX),
            street: joi.string().required(),
            postcode: joi
              .string()
              .required()
              .min(4)
              .max(5),
            city: joi.string().required(),
            phone: joi
              .string()
              .regex(/^[0-9()\/\-\#\*\_\|\+\ ]{6,23}[0-9()]{1}$/i)
              .required()
              .allow(""),
            industry: joi
              .string()
              .required()
              .guid(),
            legalform: joi
              .string()
              .required()
              .guid(),
            country: joi.string(),
            firstName: joi.string().required(),
            lastName: joi.string().required(),
            gender: joi.string(),
            title: joi.string(),
            email: joi
              .string()
              .required()
              .email(),
            holderName: joi.string(),
            isBuyer: joi.boolean().invalid(false),
            iban: joi
              .string()
              .required()
              .max(34)
              .regex(/^DE\d{2}\s*([\da-zA-Z]{4}\s*){4}[\da-zA-Z]{2}$/),
            bic: joi
              .string()
              .required()
              .min(11)
              .regex(/^[a-z]{6}[0-9a-z]{2}([0-9a-z]{3})?/i)
          })
          .xor("valueAddedTaxId", "taxIdentNumber")

        // check user is login or not
        if (userSession && userSession.id) {
          userExistModel = await User.query({
            where: { id: userSession.id }
          }).fetch()
          if (userExistModel) {
            if (
              !userExistModel.attributes.primaryBankaccount &&
              !userExistModel.attributes.industry &&
              !userExistModel.attributes.isValidated
            ) {
              isCompleteProfileMode = true
            } else {
              // throw new JsonApiError(`E_CANNOT_REGISTRATION_YOU_ARE_ALREADY_LOGIN`, 400, 'Pls, logout before create a new account')
              ctx.session.passport.user = null
            }
          }
        }
      } else {
        // Validate incoming data
        schema = joi
          .object()
          .keys({
            companyName: joi.string().required(),
            executiveName: joi.string(), // .required(),
            tradeRegisterNumber: joi.string(),
            valueAddedTaxId: joi.string().regex(common.VALUE_ADDED_TAXID_REGEX),
            taxIdentNumber: joi.string().regex(common.TAX_IDENT_NUMBER_REGEX),
            street: joi.string().required(),
            postcode: joi
              .string()
              .required()
              .min(4)
              .max(5),
            city: joi.string().required(),
            phone: joi
              .string()
              .regex(/^[0-9()\/\-\#\*\_\|\+\ ]{6,23}[0-9()]{1}$/i)
              .required()
              .allow(""),
            industry: joi
              .string()
              .required()
              .guid(),
            legalform: joi
              .string()
              .required()
              .guid(),
            country: joi.string(),
            firstName: joi.string().required(),
            lastName: joi.string().required(),
            gender: joi.string(),
            title: joi.string(),
            email: joi
              .string()
              .required()
              .email(),
            password: joi
              .string()
              .required()
              .min(8),
            passwordConfirmation: joi
              .string()
              .required()
              .min(8),
            holderName: joi.string(),
            isBuyer: joi.boolean().invalid(false),
            iban: joi
              .string()
              .required()
              .max(34)
              .regex(/^DE\d{2}\s*([\da-zA-Z]{4}\s*){4}[\da-zA-Z]{2}$/),
            bic: joi
              .string()
              .required()
              .min(11)
              .regex(/^[a-z]{6}[0-9a-z]{2}([0-9a-z]{3})?/i)
          })
          .xor("valueAddedTaxId", "taxIdentNumber")
      }

      console.log("before stripping")
      // Strip undefined values
      values = _.omit(values, "")

      let cleanedValues = {}
      Object.keys(values).forEach(prop => {
        if (values[prop] !== "") {
          cleanedValues[prop] = values[prop]
        }
      })

      console.log("after stripping")
      console.log(cleanedValues)

      const result = joi.validate(cleanedValues, schema, {
        allowUnknown: true,
        abortEarly: false
      })
      // Throw validate errors
      if (result.error !== null) {
        let details = Array.from(result.error.details, el => {
          return { message: el.message }
        })
        throw new JsonApiError(`E_VALIDATION`, 400, details)
      }

      // Check whether email already exists
      let userLoginModel
      console.log("isCompleteProfileMode:", isCompleteProfileMode)
      if (isCompleteProfileMode) {
        userLoginModel = await Userlogin.query(function(qb) {
          qb.where("email", values.email)
          qb.andWhere("user", "<>", userExistModel.id)
        }).fetch()
      } else {
        userLoginModel = await Userlogin.query({
          where: { email: values.email }
        }).fetch() // or null
      }
      console.log("userLoginModel:", userLoginModel)
      if (userLoginModel !== null) {
        throw new JsonApiError("E_RESOURCE_ALREADY_EXISTS", 400, `User with email ${values.email} already exist`)
      }

      // validate Iban
      const ibanValid = IBAN.isValid(values.iban)
      if (!ibanValid) {
        throw new JsonApiError("E_IBAN_INVALID", 400, `IBAN ${values.iban} is invalid`)
      }

      // Check industry
      let industryModel = await Industry.query({
        where: { id: values.industry }
      }).fetch()
      if (industryModel === null) {
        throw new JsonApiError("E_RESOURCE_INDUSTRY_NOT_EXISTS", 400, `Industry is not exist`)
      }

      // Check legalform value
      let legalformModel = await Legalform.query({
        where: { id: values.legalform }
      }).fetch()
      if (legalformModel === null) {
        throw new JsonApiError("E_RESOURCE_LEGALFORM_NOT_EXISTS", 400, `Legal Form value is not exist`)
      }

      // Check whether IBAN already exists
      let bankAccountModel = await Bankaccount.query({
        where: { iban: values.iban }
      }).fetch() // or null
      if (bankAccountModel !== null) {
        throw new JsonApiError("E_RESOURCE_IBAN_ALREADY_EXISTS", 400, `Bank with IBAN ${values.iban} already exist`)
      }
      let user = _.pick(values, [
        "companyName",
        "street",
        "postcode",
        "city",
        "country",
        "phone",
        "industry",
        "legalform",
        "isBuyer",
        "isSeller",
        "executiveName",
        "valueAddedTaxId",
        "taxIdentNumber",
        "walletID",
        "tradeRegisterNumber"
      ])
      const primaryBankaccount = _.pick(values, ["iban", "bic", "holderName"])
      const userlogin = _.pick(values, ["password", "email", "firstName", "lastName", "phone", "title"])
      if (isCompleteProfileMode) delete userlogin.password
      let userSetting = { key: "identificationData", value: {} }
      const tasks = getTasks(legalformModel.attributes.key)
      userSetting.value.tasks = tasks.slice()
      userSetting.value.beneficials = beneficialAvailable(legalformModel.attributes.key) ? [] : false
      const prevData = ctx.session.userTemporary
      if (prevData && prevData.userSettings && prevData.userSettings[0]) {
        const prevUploadTasks = prevData.userSettings[0].value && prevData.userSettings[0].value.tasks
        _.forEach(tasks, (task, idx) => {
          const prevUploadByType = _.filter(prevUploadTasks, o => o.file && o.key === task.key)
          if (!_.isEmpty(prevUploadByType)) {
            const idxNow = _.findIndex(userSetting.value.tasks, o => o.key === task.key)
            userSetting.value.tasks.splice(idxNow, 1)
            userSetting.value.tasks = userSetting.value.tasks.concat(prevUploadByType)
          }
        })
      }
      user.primaryBankaccount = primaryBankaccount
      user.userlogins = [userlogin]
      user.userSettings = [userSetting]
      ctx.session.userTemporary = user
      return user
    } catch (err) {
      strapi.log.error(err)
      throw err
    }
  },
  completeProfileRegistration: async function(ctx) {
    try {
      // check user is login or not
      let userSession = ctx.session.passport && ctx.session.passport.user
      let { chooseShare, beneficialOwners } = ctx.request.body
      let userModel = await User.query({ where: { id: userSession.id } }).fetch()
      let userloginModel = await Userlogin.query({ where: { user: userSession.id } }).fetch()
      let userTemporary = ctx.session.userTemporary
      let user

      let taskSetting = _.get(userTemporary, "userSettings[0]") || false
      const reuseExistingWallets = strapi.config.environments[strapi.config.environment].lemonway.reuseExistingWallets || false
      let wallet
      let walletDoesExist = false

      if (reuseExistingWallets === true) {
        try {
          wallet = await getWalletDetails(null, userTemporary.userlogins[0].email, ctx.ip)
          console.log(`Found Lemon Way wallet with ID ${wallet.ID}`)
          walletDoesExist = true
        } catch (err) {
          if (err.details[0].code === "E_SERVICE_LEMONWAY_147") {
            // 147 = Non-existent login
            console.log(`Wallet does not exist yet for ${userTemporary.userlogins[0].email}`)
          } else {
            console.log(`Unhandled error when looking for existing Lemon Way user`, err)
          }
        }
      }

      if (walletDoesExist === false) {
        console.log(`Registering new Lemon Way account for ${userTemporary.userlogins[0].email}`)
        wallet = await registerLemonWay(userTemporary, ctx.ip)
      }

      await registerIbanLemonWay(userTemporary, wallet.ID, ctx.ip)
      const tasks = _.get(taskSetting, "value.tasks")
      let isFinished = isFinishedAllTask(tasks)
      if (isFinished) {
        taskSetting.value.status = "finished"
        taskSetting.value.tasks = await linkAllDocument(tasks, wallet.ID, ctx.ip)
      }
      if (chooseShare && !_.isEmpty(beneficialOwners)) {
        taskSetting.value.beneficials = beneficialOwners
      }
      taskSetting.value.addedBeneficial = true

      // delete taskSetting.value.status
      userTemporary.walletID = wallet.ID
      // Create new bank account
      userTemporary.primaryBankaccount.user = userModel.id
      const bankAccount = await Bankaccount.forge().save(
        _.pick(userTemporary.primaryBankaccount, ["iban", "bic", "holderName", "user"]),
        { method: "insert" }
      )
      // Create new user
      userTemporary.primaryBankaccount = bankAccount.id
      if (!userTemporary.isSeller) userTemporary.isSeller = false
      if (!userTemporary.isBuyer) userTemporary.isBuyer = false

      user = await userModel.save(
        _.pick(userTemporary, [
          "companyName",
          "street",
          "postcode",
          "city",
          "phone",
          "primaryBankaccount",
          "industry",
          "legalform",
          "isBuyer",
          "isSeller",
          "executiveName",
          "valueAddedTaxId",
          "taxIdentNumber",
          "walletID",
          "tradeRegisterNumber"
        ]),
        { patch: true }
      )
      // Update new user login
      let userLoginData = userTemporary.userlogins && userTemporary.userlogins[0]

      console.log("userLoginData")
      console.log(userLoginData)
      userLoginData.isMain = true // first login is always the main one
      userLoginData.passwordHash = userLoginData.password
      delete userLoginData.password
      await userloginModel.save(userLoginData, { patch: true })
      await user.userSettings().create(taskSetting)

      let visitor = ua(strapi.config.environments[strapi.config.environment].gaId)
      // add notification & log to analytics
      if (isFinished) {
        await Notification.forge({
          type: `registrationComplete`,
          recipient: user.id
        }).save()

        // user upload all document
        visitor
          .event(
            "Registration",
            "User uploaded all identification documents",
            "User uploaded all identification documents",
            // {user: userTemporary.companyName},
            err => {
              if (err) console.log("err:", err)
            }
          )
          .send()
      } else {
        await Notification.forge({
          type: `completeUserProfile`,
          data: {
            link: `${strapi.config.environments[strapi.config.environment].frontendUrl}/identification`
          },
          recipient: user.id
        }).save()

        // user complete profile only
        visitor
          .event(
            "Registration",
            "User completed his profile",
            "User completed his profile",
            // {user: userTemporary.companyName},
            err => {
              if (err) console.log("err:", err)
            }
          )
          .send()
      }
      ctx.session.userTemporary = null

      return await strapi.services.jsonapi.fetch(strapi.models.user, {
        id: userModel.id
      })
    } catch (err) {
      strapi.log.error(err)
      throw err
    }
  },
  completeRegistration: async function(ctx) {
    let visitor = ua(strapi.config.environments[strapi.config.environment].gaId)
    try {
      const body = ctx.request.body
      let { extendData, ignore } = body
      let user = ctx.session.passport && ctx.session.passport.user
      if (user) {
        const userModal = await User.forge({ id: user.id }).fetch()
        let walletID = userModal.attributes.walletID
        if (!walletID) {
          walletID = await strapi.services.user.createOrUpdateLemonWayAccount(userModal.id)
        }
        let currentTaskModel = await Usersetting.where({
          user: user.id,
          key: "identificationData"
        }).fetch()
        let currentTaskSetting = currentTaskModel && currentTaskModel.toJSON().value
        if (extendData && extendData.beneficialOwners) {
          currentTaskSetting.beneficials = extendData.beneficialOwners
        }
        let isFinished = isFinishedAllTask(currentTaskSetting.tasks)
        if (isFinished) {
          currentTaskSetting.status = "finished"
          console.log(currentTaskSetting.tasks)
          currentTaskSetting.tasks = await linkAllDocument(currentTaskSetting.tasks, walletID, ctx.ip)
        }
        currentTaskSetting.addedBeneficial = true
        await currentTaskModel.save({ value: currentTaskSetting }, { patch: true })
        if (isFinished) {
          const userloginModal = await Userlogin.forge({
            user: user.id,
            isMain: true
          }).fetch()
          await Notification.forge({
            type: `registrationComplete`,
            data: {
              name: userloginModal && userloginModal.attributes && userloginModal.attributes.firstName
            },
            recipient: user.id
          }).save()
        }

        // ga log user upload all document
        visitor
          .event(
            "Registration",
            "User uploaded all identification documents",
            "User uploaded all identification documents",
            // {user: userModal.attributes.companyName},
            err => {
              if (err) console.log("err:", err)
            }
          )
          .send()
      } else {
        let userTemporary = ctx.session.userTemporary
        if (!userTemporary) {
          throw new JsonApiError("E_REGISTRATION_USER_SESSION", 400, `Cant get user session for regestration`)
        }
        let taskSetting = _.get(userTemporary, "userSettings[0]") || false
        const reuseExistingWallets = strapi.config.environments[strapi.config.environment].lemonway.reuseExistingWallets || false
        let wallet
        let walletDoesExist = false

        if (reuseExistingWallets === true) {
          try {
            wallet = await getWalletDetails(null, userTemporary.userlogins[0].email, ctx.ip)
            console.log(`Found Lemon Way wallet with ID ${wallet.ID}`)
            walletDoesExist = true
          } catch (err) {
            if (err.details[0].code === "E_SERVICE_LEMONWAY_147") {
              // 147 = Non-existent login
              console.log(`Wallet does not exist yet for ${userTemporary.userlogins[0].email}`)
            } else {
              console.log(`Unhandled error when looking for existing Lemon Way user`, err)
            }
          }
        }

        if (walletDoesExist === false) {
          console.log(`Registering new Lemon Way account for ${userTemporary.userlogins[0].email}`)
          wallet = await registerLemonWay(userTemporary, ctx.ip)
        }

        await registerIbanLemonWay(userTemporary, wallet.ID, ctx.ip)
        const tasks = _.get(taskSetting, "value.tasks")
        let isFinished = isFinishedAllTask(tasks)
        if (isFinished) {
          taskSetting.value.status = "finished"
          taskSetting.value.tasks = await linkAllDocument(tasks, wallet.ID, ctx.ip)
        }
        if (!ignore) {
          taskSetting.value.addedBeneficial = true
        } else {
          delete taskSetting.value.status
        }
        userTemporary.walletID = wallet.ID
        // Create new bank account
        const bankAccount = await Bankaccount.forge(userTemporary.primaryBankaccount).save()
        // Create new user
        userTemporary.primaryBankaccount = bankAccount.id
        if (!userTemporary.isSeller) userTemporary.isSeller = false
        if (!userTemporary.isBuyer) userTemporary.isBuyer = false
        user = await User.forge(
          _.pick(userTemporary, [
            "companyName",
            "street",
            "postcode",
            "city",
            "phone",
            "primaryBankaccount",
            "industry",
            "legalform",
            "isBuyer",
            "isSeller",
            "executiveName",
            "valueAddedTaxId",
            "taxIdentNumber",
            "walletID",
            "tradeRegisterNumber"
          ])
        ).save()
        // Create new user login
        let userLoginData = userTemporary.userlogins && userTemporary.userlogins[0]
        userLoginData.isMain = true // first login is always the main one
        userLoginData.passwordHash = userLoginData.password
        delete userLoginData.password
        await user.userlogins().create(userLoginData)
        // Update user field on table Bankaccount
        await bankAccount.save({ user: user.id }, { path: true })
        if (extendData && extendData.beneficialOwners) {
          taskSetting.value.beneficials = extendData.beneficialOwners
        }
        await user.userSettings().create(taskSetting)

        // add notification
        if (isFinished) {
          await Notification.forge({
            type: `registrationComplete`,
            recipient: user.id
          }).save()

          // ga log user upload all document
          visitor
            .event(
              "Registration",
              "User uploaded all identification documents",
              "User uploaded all documents",
              // {user: userTemporary.companyName},
              err => {
                if (err) console.log("err:", err)
              }
            )
            .send()
        } else {
          await Notification.forge({
            type: `registratrionSkipVerify`,
            data: {
              link: `${strapi.config.environments[strapi.config.environment].frontendUrl}/identification`
            },
            recipient: user.id
          }).save()

          // ga user complete profile only
          visitor
            .event(
              "Registration",
              "User completed his profile",
              "User completed his profile",
              // {user: userTemporary.companyName},
              err => {
                if (err) console.log("err:", err)
              }
            )
            .send()
        }
      }
      ctx.session.userTemporary = null
      return await strapi.services.jsonapi.fetch(strapi.models.user, {
        id: user.id
      })
    } catch (err) {
      strapi.log.error(err)
      throw err
    }
  },
  uploadTask: async function(ctx, filename, uploadResult) {
    try {
      let query = ctx.query
      let { userId, taskId, taskType } = query
      let currentTaskModel, userModel, currentTaskSetting, userTemporary, result
      if (userId) {
        userModel = await User.forge({ id: userId }).fetch()
        if (!userModel || !userModel.id || userModel.attributes.isValidated) {
          throw new JsonApiError("E_SECUPAY_USER_LOCAL", 400, `Cant get user local for Bank services`)
        }
        currentTaskModel = await Usersetting.forge({
          user: userId,
          key: "identificationData"
        }).fetch()
        currentTaskSetting = currentTaskModel && currentTaskModel.toJSON()
        currentTaskSetting = currentTaskSetting && currentTaskSetting.value
      } else {
        userTemporary = ctx.session.userTemporary
        if (!userTemporary) {
          throw new JsonApiError("E_REGISTRATION_USER_SESSION", 400, `Cant get user session for regestration`)
        }
        currentTaskSetting =
          userTemporary.userSettings && userTemporary.userSettings[0] && userTemporary.userSettings[0].value
      }
      if (currentTaskSetting && uploadResult && uploadResult.id) {
        if (taskId && currentTaskSetting.tasks) {
          taskType = _.get(_.find(currentTaskSetting.tasks, o => o.taskId === taskId), "key")
        }
        const autoId = uuid.v4()
        currentTaskSetting.tasks = addTask(currentTaskSetting.tasks, {
          taskId,
          file: uploadResult.id,
          filename,
          taskType,
          autoId
        })
        if (currentTaskModel && userModel) {
          await currentTaskModel.save({ value: currentTaskSetting }, { patch: true })
        } else {
          userTemporary.userSettings = [{ key: "identificationData", value: currentTaskSetting }]
          ctx.session.userTemporary = userTemporary
        }
        result = initTaskFromType({
          taskId,
          file: uploadResult.id,
          filename,
          taskType,
          autoId
        })
      }
      return result
    } catch (err) {
      console.log("Upload error", err)
      strapi.log.error(err)
      throw err
    }
  },
  removeTask: async function(ctx) {
    try {
      const { taskid } = ctx.params
      let user = ctx.session.passport && ctx.session.passport.user
      let userTemporary, currentTaskModel, currentTaskSetting

      if (user && user.id) {
        currentTaskModel = await Usersetting.forge({
          user: user.id,
          key: "identificationData"
        }).fetch()
        currentTaskSetting = currentTaskModel && currentTaskModel.toJSON()
        currentTaskSetting = currentTaskSetting && currentTaskSetting.value
      } else {
        userTemporary = ctx.session.userTemporary
        if (!userTemporary) {
          throw new JsonApiError("E_REGISTRATION_USER_SESSION", 400, `Cant get user session for regestration`)
        }
        currentTaskSetting =
          userTemporary.userSettings && userTemporary.userSettings[0] && userTemporary.userSettings[0].value
      }

      if (currentTaskSetting) {
        currentTaskSetting.tasks = removeTask(currentTaskSetting.tasks, taskid)
        if (currentTaskModel) {
          await currentTaskModel.save({ value: currentTaskSetting }, { patch: true })
        } else {
          userTemporary.userSettings = [{ key: "identificationData", value: currentTaskSetting }]
          ctx.session.userTemporary = userTemporary
        }
      }
      return currentTaskSetting
    } catch (err) {
      console.log("Upload error", err)
      strapi.log.error(err)
      throw err
    }
  },
  loginAttemps: co.wrap(function*(ctx, isOk) {
    const { email } = ctx.request.body
    let userloginModel = yield Userlogin.query({
      where: { email: email }
    }).fetch()
    let loginAttempts = 0
    if (userloginModel) {
      let userModel = yield User.query({
        where: { id: userloginModel.attributes.user }
      }).fetch()
      if (userModel) {
        let data = {}
        if (isOk) {
          data = {
            loginAttempts: userModel.attributes.isBlocked ? userModel.attributes.loginAttempts : 0
          }
        } else {
          loginAttempts = (userModel.attributes.loginAttempts || 0) + 1
          if (loginAttempts >= 5) {
            data = { loginAttempts: loginAttempts, isBlocked: true }
          } else {
            data = { loginAttempts: loginAttempts }
          }
        }
        yield userModel.save(data, { patch: true })
      }
    }
    return loginAttempts
  }),
  checkEmailExist: async function(ctx) {
    let user = ctx.session.passport && ctx.session.passport.user
    // Validate incoming data
    const schema = joi.object().keys({
      email: joi
        .string()
        .required()
        .email()
    })
    const { email, id } = ctx.params
    const result = joi.validate({ email: email }, schema, {
      allowUnknown: false,
      abortEarly: false
    })
    // let userId = ctx.session.passport && ctx.session.passport.user && ctx.session.passport.user.id || null

    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }

    let userLoginExistModel = await Userlogin.query(function(qb) {
      qb.where("email", email)
      if (id) {
        qb.andWhere("id", "<>", id || (user && user.userloginId))
      }
    }).fetch()
    if (userLoginExistModel) {
      throw new JsonApiError(`E_EMAIL_EXISTS`, 400)
    }

    // Only check whether wallet exists on environments that don't reuse existing wallets (such as production)
    const reuseExistingWallets = strapi.config.environments[strapi.config.environment].lemonway.reuseExistingWallets || false
    if (reuseExistingWallets === false) {
      let lemonUser
      try {
        lemonUser = await getWalletDetails(null, email, ctx.ip)
      } catch (error) {
        lemonUser = null
      }
      if (lemonUser && lemonUser.ID) {
        throw new JsonApiError(`E_WALLET_EXISTS`, 400)
      }
    }
    return {}
  },
  checkIbanExist: async function(ctx) {
    // Validate incoming data
    const schema = joi.object().keys({
      iban: joi
        .string()
        .required()
        .max(34)
        .regex(/^DE\d{2}\s*([\da-zA-Z]{4}\s*){4}[\da-zA-Z]{2}$/)
    })
    const { iban } = ctx.params
    const result = joi.validate({ iban: iban }, schema, {
      allowUnknown: false,
      abortEarly: false
    })
    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    let ibanWithoutSpace = iban.replace(/ /g, "")
    if (ctx.query.onlyCustomer) {
      const userId = _.get(ctx, "session.passport.user.id")
      const customerIban = await Customer.query(function(qb) {
        qb.select("customer.extras")
      }).fetchAll()

      let customerIbanList = customerIban.map(obj => _.get(obj, "attributes.extras.bank.iban") || "")
      let customerIbanWithoutSpace = customerIbanList.map(obj => obj.replace(/ /g, ""))
      const customer = await Customer.query(function(qb) {
        qb.where("user", userId).andWhere(function() {
          this.whereRaw("extras #>> ? = ?", ["{bank,iban}", iban])
        })
      }).fetch()
      if (customer || customerIbanWithoutSpace.includes(ibanWithoutSpace)) {
        throw new JsonApiError(`E_IBAN_EXISTS`, 400)
      }
      return {}
    }
    //get iban list from database and remove all spaces of all iban and check if the input iban exits in this list
    let ibanList = await Bankaccount.query(qb => {
      qb.select("bankaccount.iban")
    }).fetchAll()
    let ibanArray = ibanList.toJSON().map(obj => obj["iban"].replace(/ /g, ""))

    let bankaccountModel = await Bankaccount.forge({ iban: iban }).fetch()
    if (bankaccountModel || ibanArray.includes(ibanWithoutSpace)) {
      throw new JsonApiError(`E_IBAN_EXISTS`, 400)
    }

    return {}
  },
  checkCustomerNumberExist: async function(ctx) {
    let user = ctx.session.passport && ctx.session.passport.user
    const { id } = ctx.params
    const { customerNumber } = ctx.request.body
    // Validate incoming data
    const schema = joi.object().keys({
      customerNumber: joi.string().required()
    })
    const result = joi.validate({ customerNumber }, schema, {
      allowUnknown: false,
      abortEarly: false
    })
    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }

    let customerExist = await Customer.query(qb => {
      qb.where("customerId", customerNumber).andWhere("user", user.id)
      if (id) {
        qb.andWhere("id", "!=", id)
      }
    }).count()

    if (customerExist > 0) {
      throw new JsonApiError(`E_CUSTOMER_NUMBER_EXISTS`, 400)
    }

    return {}
  },
  checkInvoiceNumber: async function(ctx) {
    // Validate incoming data
    const schema = joi.object().keys({ invoiceNumber: joi.string().required(), templateName: joi.string() })
    const { id } = ctx.params
    const { invoiceNumber, templateName } = ctx.request.body
    const result = joi.validate({ invoiceNumber }, schema, {
      allowUnknown: false,
      abortEarly: false
    })
    const owner = ctx.session.passport.user.id

    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    /*
    if (templateName) {
      const exitsTemplate = await Template.query(function(qb) {
        qb.where("type", "invoice").andWhere("name", templateName)
      }).count()
      if (exitsTemplate > 0) {
        throw new JsonApiError(`E_TEMPLATE_EXISTS`, 400)
      }
    }*/

    const invoiceExists = await Invoice.query(function(qb) {
      qb
        .where("owner", owner)
        .andWhere("invoiceNumber", invoiceNumber)
        .andWhere("status", "!=", "draft")
      if (id) {
        qb.andWhere("id", "!=", id)
      }
    }).count()
    if (invoiceExists > 0) {
      throw new JsonApiError(`E_INVOICE_NUMBER_EXISTS`, 400)
    }
    return {}
  },
  directDebitMandate: async function(ctx) {
    const values = ctx.request.body
    const schema = joi.object().keys({
      phone: joi
        .string()
        .regex(/^[0-9()\/\-\#\*\_\|\+\ ]{6,23}[0-9()]{1}$/i)
        .required()
        .allow("")
    })
    const result = joi.validate(values, schema, {
      allowUnknown: false,
      abortEarly: false
    })
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    let user = ctx.session.passport.user

    if (user && user.hasValidDirectDebitMandate) {
      throw new JsonApiError(
        `E_USER_ALREADY_HAS_VALID_DIRECT_DEBIT_MANDATE`,
        400,
        "Der Benutzer hat bereit ein gültigtes Lastschriftmandat"
      )
    }
    let settingDebit = await Usersetting.query({
      where: { user: user.id, key: "directDebitMandate" }
    }).fetch()

    // Create a direct debit mandate usersetting
    if (!settingDebit) {
      settingDebit = await Usersetting.forge().save({
        key: "directDebitMandate",
        user: user.id,
        value: JSON.stringify({ confirmed: false })
      })
    }

    let userModel = await strapi.services.jsonapi.fetch(
      strapi.models.user,
      { id: user.id },
      { includes: ["primaryBankaccount"] }
    )
    // Test walletID
    const data = _.assign(userModel.toJSON(), result.value)
    const hashData = {
      confirmHash: uuid.v4(),
      errorHash: uuid.v4()
    }
    // Format number (only works for Germany right now)
    let mobileNumber = result.value.phone.replace(/^[0+]+/, "")
    if (mobileNumber.indexOf("49") !== 0) {
      mobileNumber = `49${mobileNumber}`
    }
    data.phone = mobileNumber
    const mandate = await registerSddMandate(_.assign(data, hashData), ctx.ip)
    console.log("executing signDocumentInit")
    const signDocumentData = await signDocumentInit(data, mandate, ctx.ip)
    console.log("signDocumentInit finished", signDocumentData)

    const newValue = _.assign(
      {
        documentId: mandate.ID,
        mobileNumber
      },
      hashData
    )
    await settingDebit.save({ value: JSON.stringify(newValue) }, { path: true })
    const newSettings = await Usersetting.query({
      where: { user: ctx.session.passport.user.id }
    }).fetchAll()
    user.userSettings = newSettings.toJSON()
    ctx.session.passport.user = user
    return signDocumentData
  },
  /**
   * Called by Lemon Way when the wallet status of a user
   * @param  {[type]} ctx [description]
   * @return {[type]}     [description]
   */
  walletStatusChange: async function(ctx) {
    let walletId = ctx.request.body.ExtId
    let notificationCategory = ctx.request.body.NotifCategory
    let status = ctx.request.body.Status

    if (status === "6") {
      if (notificationCategory === "8") {
        // KYC 2 confirmed
        const walletUser = await User.query({
          where: { walletID: walletId }
        }).fetch()
        if (!walletUser) {
          strapi.log.error(`User with wallet-ID ${walletId} could not be found`)
        } else {
          await walletUser.save({ isValidated: true }, { path: true })
          console.log("User validated successfully")

          // GA log user validated sucessful
          let visitor = ua(strapi.config.environments[strapi.config.environment].gaId)
          visitor
            .event(
              "Registration",
              "User received KYC2 status",
              "User received KYC2 status",
              // {user: walletUser.attributes.companyName},
              err => {
                if (err) console.log("err:", err)
              }
            )
            .send()
        }
      } else {
        console.log(`Unhandled notification cateogry ${notificationCategory}`)
      }
    } else {
      console.log(`Unhandled wallet status ${status}`)
    }
  },
  /**
   * This method is linked to an endpoint that is called when
   */
  directDebitMandateCallback: async function(ctx) {
    const { userId, hash } = ctx.params
    if (userId) {
      const userModel = await User.forge({ id: userId }).fetch()
      const settingDebit = await Usersetting.query({
        where: { user: userId, key: "directDebitMandate" }
      }).fetch()
      if (!settingDebit || settingDebit.attributes.value.confirmed) {
        throw new JsonApiError(`E_SETTING_DEBIT_DO_NOT_EXISTS`, 400, "User do not have setting of debit")
      }
      let settingData = settingDebit.toJSON().value
      let result = {}
      if (hash && settingData.confirmHash === hash) {
        settingData.confirmed = true
        result = { status: "ddmSigned", success: true }
      } else if (hash && settingData.confirmHash !== hash) {
        settingData.confirmed = false
        result = { status: "ddmFail", success: false }
      }
      if (result.success) {
        if (userModel.attributes.isSeller === true) {
          await Notification.forge({
            type: "ddmSignedSeller",
            //actionUrl: `/claims/buy`,
            recipient: userId
          }).save()
        } else if (userModel.attributes.isBuyer === true) {
          await Notification.forge({
            type: "ddmSigned",
            actionUrl: `/claims/buy`,
            recipient: userId
          }).save()
        } else {
          console.log("User was neither seller nor buyer")
          console.log(userModel.toJSON)
        }
      }
      await settingDebit.save({ value: JSON.stringify(settingData) }, { path: true })
      return result
    }
  },
  getAccount: async function(ctx) {
    const sessionUser = ctx.session.passport.user
    let params = Object.assign(ctx.params, { id: sessionUser.id })
    let userModel = await strapi.services.jsonapi.fetch(strapi.models.user, params, {}, ctx.query)
    let user = userModel.toJSON()
    user.userloginId = sessionUser.userloginId
    if (!sessionUser.hasValidDirectDebitMandate || !sessionUser.isValidated) {
      const settingDebit = await Usersetting.query({
        where: { user: user.id, key: "directDebitMandate" }
      }).fetch()
      if (
        user.isBuyer &&
        settingDebit &&
        settingDebit.attributes &&
        settingDebit.attributes.value &&
        settingDebit.attributes.value.confirmed
      ) {
        await userModel.save({ hasValidDirectDebitMandate: true }, { patch: true })
        userModel = await strapi.services.jsonapi.fetch(strapi.models.user, params, {}, ctx.query)
      }
      user = userModel.toJSON()
      user.userloginId = sessionUser.userloginId
      user.email = sessionUser.email
      const sessionData = _.pick(user, [
        "id",
        "email",
        "userloginId",
        "role",
        "status",
        "isBuyer",
        "isSeller",
        "isBlocked",
        "isValidated",
        "userSettings",
        "hasValidDirectDebitMandate"
      ])
      ctx.session.passport.user = sessionData
    }
    // Determine whether user have decimo invoice
    try {
      let numberOfDecimoInvoices = 0
      const userInvoicesModel = userModel.related("invoices")
      if (userInvoicesModel.length > 0) {
        numberOfDecimoInvoices = userInvoicesModel.reduce((total, invoice) => {
          if (_.get(invoice.get("data"), "isDecimoMode")) {
            total += 1
          }
          return total
        }, 0)
      }
      user.numberOfDecimoInvoices = _.get(user, "principalDecimoId") ? numberOfDecimoInvoices : 0
    } catch (e) {}
    return user
  },
  getPaymentStatistic: async function(ctx) {
    const user = ctx.session.passport.user
    let userModel = await User.forge({ id: user.id }).fetch()
    let lemonUser = await getWalletDetails(userModel.attributes.walletID, null, ctx.ip)

    let date = new Date()
    let currentDay = date.getDate()
    let currentMonth = date.getMonth()
    let currentYear = date.getFullYear()
    let last30Days =
      chance.date({
        string: true,
        hour: 0,
        minute: 1,
        day: currentDay - 29,
        month: currentMonth,
        year: currentYear
      }) + " 00:00:00"

    // calculate payin lastmonth
    let payIn = await Transaction.query(function(qb) {
      qb.sum("amount as sumPayIn")
      qb.count("id as totalPayin")
      qb.where("beneficiary", "=", user.id)
      qb.where("state", "=", "finished")
      qb.where("created_at", ">=", last30Days)
      // qb.debug(true)
    }).fetch()

    // calculate payout lastmonth
    let payOut = await Transaction.query(function(qb) {
      qb.sum("amount as sumPayOut")
      qb.count("id as totalPayout")
      qb.where("benefactor", "=", user.id)
      qb.where("state", "=", "finished")
      qb.where("created_at", ">=", last30Days)
      // qb.debug(true)
    }).fetch()

    return {
      balance: (lemonUser && lemonUser.BAL) || 0,
      payinBalance: (payIn && payIn.attributes.sumPayIn) || 0,
      countPayin: (payIn && payIn.attributes.totalPayin) || 0,
      payoutBalance: (payOut && payOut.attributes.sumPayOut) || 0,
      countPayout: (payOut && payOut.attributes.totalPayout) || 0
    }
  },
  /**
   * This function is executed after successfully logging in
   * It only contains side effects of the login
   * @return {[type]} [description]
   */
  login: async function(user) {
    const { id } = user

    let userModel = await User.where({ id }).fetch()
    userModel.save({ lastLogin: new Date() }, { patch: true })
  },

  uploadDunningContract: async function(userId, uploadId) {
    // Create usersetting to indicate the contract has been uploaded

    const dunningContractUserSetting = await Usersetting.forge({
      user: userId,
      key: "dunningContract"
    }).fetch()

    const value = {
      uploadId,
      uploadDate: new Date(),
      confirmed: false
    }
    if (dunningContractUserSetting) {
      await dunningContractUserSetting.save(
        { value: { uploadId, uploadDate: new Date(), confirmed: false } },
        { patch: true }
      )
    } else {
      await Usersetting.forge().save({
        key: "dunningContract",
        user: userId,
        value
      })
    }
    // create task for dunning contract
    await Supporttask.forge({
      type: "approve-dunning-contract",
      data: {
        uploadId,
        userId
      }
    }).save()
  },
  /**
   * add dunning contract to usersetting
   */
  submitDunningContract: async function(ctx) {
    const userId = ctx.session.passport.user.id
    const values = ctx.request.body
    const schema = joi.object().keys({
      dunningContract: joi.string().guid(),
      invoice: joi.object().required(),
      companyName: joi.string().allow("")
    })
    const result = joi.validate(values, schema, {
      allowUnknown: false,
      abortEarly: false
    })
    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    const clearValues = result.value
    // find the exist dunning contract
    const dunningContractUserSetting = await Usersetting.forge({
      user: userId,
      key: "dunningContract"
    }).fetch()

    const uploadId = clearValues.dunningContract
    const value = {
      uploadId,
      uploadDate: new Date(),
      confirmed: false
    }
    if (dunningContractUserSetting) {
      await dunningContractUserSetting.save({ value }, { patch: true })
    } else {
      await Usersetting.forge().save({
        key: "dunningContract",
        user: userId,
        value
      })
    }
    // send mail for notification have new user.
    await Email.forge({
      data: {
        subject: `app.notification.uploadedCollectionContracts.summary`,
        content: `app.notification.uploadedCollectionContracts.text`,
        name: `faktoora team`,
        companyName: clearValues && clearValues.companyName,
        invoiceNumber: clearValues && clearValues.invoice && clearValues.invoice.invoiceNumber,
        faktooraID: clearValues && clearValues.invoice && clearValues.invoice.faktooraId,
        amount: common.formatCurrency(clearValues && clearValues.invoice && clearValues.invoice.amount),
        dueDate: common.formatDate(clearValues && clearValues.invoice && clearValues.invoice.lastPaymentDate)
      },
      template: "notification",
      to: strapi.config.environments[strapi.config.environment].adminEmail
    }).save()
    // create task for dunning contract
    await Supporttask.forge({
      type: "approve-dunning-contract",
      data: {
        uploadId,
        userId
      }
    }).save()

    return clearValues
  },
  generateDunningContract: async function(ctx) {
    const userId = ctx.session.passport.user.id

    const dunningContractUserSetting = await Usersetting.forge({
      user: userId,
      key: "dunningContract"
    }).fetch()

    if (dunningContractUserSetting) {
      return {
        created: false,
        existed: true
      }
    }

    await Usersetting.forge().save({
      key: "dunningContract",
      user: userId,
      value: {
        confirmed: false
      }
    })

    const user = await User.forge({
      id: userId
    }).fetch({ withRelated: ["primaryBankaccount", "userlogins"] })

    let userAttributes = _.pick(user.attributes, [
      "companyName",
      "executiveName",
      "street",
      "postcode",
      "city",
      "phone"
    ])

    userAttributes.id = userId

    const userLogins = user.related("userlogins")
    const bankAccount = user.related("primaryBankaccount")

    const mainUserLogin = userLogins.filter(item => item.attributes.isMain === true)
    const userloginAttributes = _.pick(mainUserLogin[0].attributes, ["email"])

    let bankCode = bankAccount.attributes.iban.substring(4, 12)
    let bankAccountAttributes = {
      iban: bankAccount.attributes.iban,
      bic: bankAccount.attributes.bic,
      bankName: ""
    }
    let result = await RESTClient.get(IBAN_SERVICE_URL.replace("[code]", bankCode))
    if (_.get(result, "bank_code.bank_name")) {
      bankAccountAttributes.bankName = result.bank_code.bank_name
    }

    const workerData = {
      user: userAttributes,
      userlogin: userloginAttributes,
      bankAccount: bankAccountAttributes
    }

    worker.prefillDunningContract(workerData)

    return { created: true, existed: false }
  },

  confirmDunningContract: async function(ctx) {
    const { id } = ctx.params

    const dunningContractUserSetting = await Usersetting.forge({
      id,
      key: "dunningContract"
    }).fetch({ withRelated: ["user"] })
    const user = dunningContractUserSetting.related("user")

    if (!dunningContractUserSetting) {
      return { success: false, reason: "could not find user setting" }
    }

    const uploadId = _.get(dunningContractUserSetting, "attributes.value.uploadId")

    if (!uploadId) {
      return { success: false, reason: "could not find upload" }
    }

    let { value } = dunningContractUserSetting.attributes
    if (value.confirmed === true) {
      return { success: false, reason: "Already sent" }
    }

    const upload = await Upload.forge({
      id: uploadId
    }).fetch()
    const filePath = path.join(strapi.config.environments[strapi.config.environment].uploadFolder, upload.attributes.path, upload.attributes.filename)

    let attachments = JSON.stringify([
      {
        path: filePath,
        filename: `inkassovereinbarung-${slugify(user.attributes.companyName)}.pdf`
      }
    ])

    // send mail to notify new dunningContract
    await Email.forge({
      data: {
        subject: `app.notification.newDunningContract.summary`,
        content: `app.notification.newDunningContract.text`,
        companyName: user.attributes.companyName,
        name: "Elbe Inkasso Team"
      },
      to: "testme@faktoora.com",
      attachments,
      template: "notification"
    }).save()

    value = Object.assign(value, { confirmed: true })

    join.save({})
  },
  downloadDunningContract: async function(ctx) {
    const userId = ctx.session.passport.user.id

    const fileModel = await Upload.forge({
      user: userId,
      uploadType: "dunningContractDownload"
    }).fetch()

    let filepath = `${strapi.config.environments[strapi.config.environment].uploadFolder}/${fileModel.attributes.path}/${fileModel.attributes.filename}`
    // let filepath = `${strapi.config.environments[strapi.config.environment].uploadFolder}/${uploadModel.attributes.path}/${uploadModel.attributes.filename}`;
    if (!fs.existsSync(filepath)) {
      throw new JsonApiError("E_RESOURCE_INVOICE_FILE_NOT_EXISTS", 400, `File has been deleted.`)
    }

    return filepath
  },
  changePremiumPlan: async function(ctx) {
    const userId = ctx.session.passport.user.id
    const body = ctx.request.body
    let values = body
    // validate data send to backend
    //
    const schema = joi.object().keys({
      plan: joi
        .string()
        .valid(["startup", "basic", "premium"])
        .required(),
      period: joi
        .string()
        .valid(["month", "year"])
        .required()
    })
    const result = joi.validate(values, schema, {
      allowUnknown: false,
      abortEarly: false
    })
    const clearValues = result.value
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }

    // check user is seller & have a valid direct debit
    //
    let userModel = await User.forge({ id: userId }).fetch()
    let user = (userModel && userModel.toJSON()) || {}
    if (!user.isSeller) {
      throw new JsonApiError("E_USER_IS_NOT_SELLER", 400, `User is not seller.`)
    }
    if (user.clientId !== null) {
      throw new JsonApiError("E_USER_IS_NOT_ALLOW", 400, `User is not allow.`)
    }
    /*else if (!user.hasValidDirectDebitMandate) {
      throw new JsonApiError(
        "E_USER_IS_NOT_VALID_DIRECT_DEBIT_MANDATE",
        400,
        `User does not have a valid direct debit mandate.`
      )
    }*/

    // Calculate price of subscription fee
    let price = 0
    if (clearValues.plan === "basic") {
      if (clearValues.period === "month") {
        price = 9.0
      } else if (clearValues.period === "year") {
        price = 99.0
      }
    } else if (clearValues.plan === "premium") {
      if (clearValues.period === "month") {
        price = 29.0
      } else if (clearValues.period === "year") {
        price = 348.0
      }
    }

    const currentSubscription = await Subscription.where({ user: userId, isCurrent: true }).fetch()

    let startDate = new Date()
    let willBeCurrent = true
    if (currentSubscription !== null) {
      // Delete other future subscriptions
      const futureSubscription = await Subscription.query(qb => {
        qb
          .where("user", "=", userId)
          .andWhere("isCurrent", "=", false)
          .andWhere("startDate", ">", currentSubscription.attributes.endDate)
      }).fetch()
      if (futureSubscription !== null) {
        console.log("found futuresubscription with", futureSubscription.attributes)
        await futureSubscription.destroy()
      }

      const oldPlan = currentSubscription.attributes.plan
      const oldPlanPeriod = currentSubscription.attributes.period

      // When the user tries to change into the same subscription that he already has
      if (oldPlan === clearValues.plan && oldPlanPeriod === clearValues.period) {
        throw new JsonApiError(
          "E_SAME_SUBSCRIPTION_ALREADY_ACTIVE",
          400,
          `Das Abo und die Abrechnungsperiode stimmen mit dem derzeitigen überein.`
        )
      }

      // Determine whether we have a downgrade scenario or change of payment period which will keep
      // the current plan intact while it continues
      if (
        (oldPlan === "premium" && ["basic", "startup"].includes(clearValues.plan)) ||
        (oldPlan === "basic" && clearValues.plan === "startup") ||
        (oldPlan === clearValues.plan && clearValues.period === "month")
      ) {
        // The new plan wont be the new current entry and will also only start after the current one finished
        willBeCurrent = false
        startDate = moment(currentSubscription.attributes.endDate)
          .add(1, "d")
          .toDate()
      } else {
        // Upgrades are done instantly

        // calculate discount
        if (clearValues.plan === "premium" && oldPlan === "basic") {
          let discount = 0
          if (oldPlanPeriod === "month") {
            discount = 9.0
          } else if (oldPlanPeriod === "year") {
            discount = 99.0
          }
          price = Math.round((price - discount) * 1e2) / 1e2
          console.log(`Granted discount of ${discount} €. Total price is now ${price}`)
        }

        // Change isCurrent from current subscription
        await currentSubscription.save({ isCurrent: false, endDate: new Date() }, { patch: true })
      }
    }

    let endDate
    if (clearValues.period === "month") {
      endDate = moment(startDate).endOf("month")
    } else if (clearValues.period === "year") {
      endDate = moment(startDate).add(1, "Y")
    }

    // Create a new subscription
    const newSubscription = await Subscription.forge({
      user: userId,
      plan: clearValues.plan,
      isCurrent: willBeCurrent,
      price,
      startDate,
      endDate,
      period: clearValues.period
    }).save()

    // TODO Create Lemon Way transaction
    /*const subscriptionFeeTransaction = await Transaction.forge({
      paymentType: "SUBSCRIPTION_FEE",
      paymentMethod: "directDebit",
      state: "pending",
      amount: price,
      beneficiary: userId
    }).save()
    */

    return { plan: clearValues.plan, endDate: newSubscription.attributes.endDate, period: clearValues.period }
  },
  /**
   * Cancels any future plans
   */
  keepCurrentPlan: async function(ctx) {
    const userId = ctx.session.passport.user.id
    const body = ctx.request.body

    const subscriptions = await Subscription.where({ user: userId })
      .orderBy("created_at", "DESC")
      .fetchAll()

    // Iterate through all subscription to find a future plan change
    for (let i = 0; i < subscriptions.models.length; i++) {
      const subscription = subscriptions.models[i]
      if (subscription.attributes.isCurrent === true && i > 0) {
        await subscriptions.models[i - 1].destroy()
        return {
          plan: subscription.attributes.plan,
          endDate: subscription.attributes.endDate,
          period: subscription.attributes.period
        }
      }
    }
    throw new JsonApiError(`E_NO_PLAN_CHANGE`, 400, "There is no change planned for the user")
  },
  getCurrentPlan: async function(ctx, date = moment().toDate()) {
    const body = ctx.request.body
    const userId = _.get(ctx, "session.passport.user.id")

    // validate data send to backend
    const schema = joi.object().keys({
      date: joi.date()
    })
    /*
    const result = joi.validate(body, schema, {
      allowUnknown: false,
      abortEarly: false
    })

    const clearValues = result.value
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    */
    let dateCheck = body.date || date

    // get userId send
    let userModel = await User.forge({ id: userId }).fetch()
    if (!userModel) {
      throw new JsonApiError("E_USER_NOT_EXIST", 400, `User not exist.`)
    }
    if (!userModel.attributes.isSeller) {
      throw new JsonApiError("E_USER_NOT_SELLER", 400, `User not seller.`)
    }

    let diffDate = moment(dateCheck).diff(moment(userModel.attributes.created_at))
    if (diffDate < 0) {
      throw new JsonApiError("E_DATE_INVALID", 400, `The date is less than date of created user.`)
    }

    const subscriptionModels = await Subscription.where({ user: userId })
      .query("orderBy", "endDate", "desc")
      .fetchAll()

    if (subscriptionModels.models.length === 0) {
      return { plan: "startup" }
    }

    let planData = {}
    for (let subscription of subscriptionModels.models) {
      // Add next plan
      // We can check like this without missing the next plan because we sorted the result subscriptions DESC by endDate
      if (subscription.attributes.isCurrent === false && moment(subscription.attributes.startDate).isAfter() === true) {
        planData.nextPlan = _.pick(subscription.attributes, ["plan", "startDate", "endDate", "period"])
      }

      // Add current plan
      if (
        subscription.attributes.isCurrent === true &&
        moment().isBetween(subscription.attributes.startDate, subscription.attributes.endDate)
      ) {
        return Object.assign(planData, _.pick(subscription.attributes, ["plan", "startDate", "endDate", "period"]))
      }
    }

    return { plan: "startup" }
  },
  getSettlementStatistic: async function(ctx) {
    const userId = ctx.session.passport.user.id
    const { type } = ctx.params

    let data = []
    if (type === "year") {
      let groupRaw = 'date_part(\'year\', "settlement"."billingPeriod")'
      let settlementModel = await Settlement.query(qb => {
        let rawSelect =
          'SUM("settlement"."amount") as amount, date_part(\'year\', "settlement"."billingPeriod") as year'
        qb.select(strapi.connections.default.raw(rawSelect))
        qb.where("owner", userId)
        qb.groupByRaw(groupRaw)
      }).fetchAll()
      data = (settlementModel && settlementModel.toJSON()) || []
    } else if (type === "month") {
      let groupRaw =
        'date_part(\'year\', "settlement"."billingPeriod"), date_part(\'month\', "settlement"."billingPeriod")'
      let settlementModel = await Settlement.query(qb => {
        let rawSelect =
          'SUM("settlement"."amount") as amount, date_part(\'year\', "settlement"."billingPeriod") as year, date_part(\'month\',"settlement"."billingPeriod") as month'
        qb.select(strapi.connections.default.raw(rawSelect))
        qb.whereRaw('"settlement"."billingPeriod" > (current_date - INTERVAL \'12 months\')')
        qb.andWhere("owner", userId)
        qb.groupByRaw(groupRaw)
      }).fetchAll()
      data = (settlementModel && settlementModel.toJSON()) || []
    }

    return data
  },
  activation: function*(ctx) {
    try {
      const formValues = ctx.params

      // Validate incoming data
      const activationCodeSchema = joi.object().keys({ activationCode: joi.string().required() })
      const activationCodeResult = joi.validate({ activationCode: formValues.activationCode }, activationCodeSchema, {
        allowUnknown: false,
        abortEarly: false
      })

      // Throw validate errors
      if (activationCodeResult.error) {
        let details = Array.from(activationCodeResult.error.details, el => {
          return { message: el.message }
        })
        throw Error("The activation code is required.")
      }

      const UserModel = yield User.where({ activationCode: formValues.activationCode }).fetch()
      if (!UserModel) {
        throw Error("Specified account does not exist.")
      }

      const userJson = UserModel.toJSON()
      if (!_.get(userJson, "id")) {
        throw Error("Specified account does not exist.")
      }

      // The activation code just allown within 48 hours
      const createdDate = moment(_.get(userJson, "created_at"))
      const now = moment().utc()
      const expiredActivation = createdDate.add(2, "day").utc()
      if (now.isAfter(expiredActivation)) {
        throw Error("The activation code just allow within 48 hours.")
      }

      if (!_.get(userJson, "id")) {
        throw Error("Specified account does not exist.")
      }

      const UserloginModel = yield Userlogin.forge({ user: _.get(userJson, "id") }).fetch()
      const UserloginJson = UserloginModel.toJSON()
      if (_.get(UserloginJson, "isVerified")) {
        throw Error("Specified account has been activated.")
      }

      yield UserloginModel.save({ isVerified: true }, { patch: true })

      return _.pick(UserloginJson, ["email", "passwordHash"])
    } catch (e) {
      throw new JsonApiError("ACCOUNT_ACTIVATION_ERROR", 400, e.message)
    }
  },
  updateNotValidatedUserInfo: async function(ctx) {
    const user = ctx.session.passport.user
    const body = ctx.request.body
    let values = body
    let schema = joi.object().keys({
      companyName: joi.object().keys({
        companyName: joi.string().required()
      }),
      userlogin: joi.object().keys({
        firstName: joi.string().required(),
        lastName: joi.string().required()
      }),
      address: joi.object().keys({
        street: joi.string().required(),
        postcode: joi.string().required(),
        city: joi.string().required()
      }),
      phone: joi.object().keys({
        phone: joi
          .string()
          .regex(/^[0-9()\/\-\#\*\_\|\+\ ]{6,23}[0-9()]{1}$/i)
          .required()
          .allow("")
      }),
      executiveName: joi.object().keys({
        executiveName: joi.string().required()
      }),
      vatOrTaxNumber: joi
        .object()
        .keys({
          valueAddedTaxId: joi.string().regex(common.VALUE_ADDED_TAXID_REGEX),
          taxIdentNumber: joi.string().regex(common.TAX_IDENT_NUMBER_REGEX)
        })
        .xor("valueAddedTaxId", "taxIdentNumber"),
      bankAccount: joi.object().keys({
        holderName: joi.string().required(),
        iban: joi
          .string()
          .required()
          .max(34)
          .regex(/^DE\d{2}\s*([\da-zA-Z]{4}\s*){4}[\da-zA-Z]{2}$/),
        bic: joi
          .string()
          .required()
          .min(11)
          .regex(/^[a-z]{6}[0-9a-z]{2}([0-9a-z]{3})?/i)
      }),
      tradeRegisterEntry: joi.object().keys({
        tradeRegisterNumber: joi.string().required(),
        registryCourt: joi.string().required()
      })
    })

    const result = joi.validate(values, schema, {
      allowUnknown: false,
      abortEarly: false
    })
    const clearValues = result.value
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })

      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }

    // Save the user
    let userModel = await User.forge({ id: user.id }).fetch()
    let userLoginModel = await Userlogin.forge({ id: user.userloginId }).fetch()
    if (
      clearValues.address ||
      clearValues.phone ||
      clearValues.vatOrTaxNumber ||
      clearValues.tradeRegisterEntry ||
      clearValues.executiveName ||
      clearValues.companyName
    ) {
      await userModel.save(
        _.assign(
          {},
          clearValues.address || {},
          clearValues.phone || {},
          clearValues.executiveName || {},
          clearValues.vatOrTaxNumber || {},
          clearValues.tradeRegisterEntry || {},
          clearValues.companyName || {}
        ),
        { patch: true }
      )
    }
    if (clearValues.userlogin) {
      await userLoginModel.save(clearValues.userlogin, { patch: true })
    }
    if (clearValues.bankAccount) {
      // find user bankacount
      let bankaccountModel = await Bankaccount.where({ user: user.id }).fetch()
      // if bankaccount or primaryBankaccount exist ignore this process
      if (!userModel.attributes.primaryBankaccount && !bankaccountModel) {
        clearValues.bankAccount.user = user.id
        let bankaccount = await Bankaccount.forge().save(
          _.pick(clearValues.bankAccount, ["iban", "bic", "holderName", "user"]),
          { method: "insert" }
        )
        clearValues.bankAccount = bankaccount.toJSON()
        userModel.save({ primaryBankaccount: bankaccount.id }, { patch: true })
      }
    }

    return clearValues
  },
  addNewUserBankaccount: async function(ctx) {
    const user = ctx.session.passport.user
    const body = ctx.request.body
    let values = body
    let schema = joi.object().keys({
      holderName: joi.string().required(),
      iban: joi
        .string()
        .required()
        .max(34)
        .regex(/^DE\d{2}\s*([\da-zA-Z]{4}\s*){4}[\da-zA-Z]{2}$/),
      bic: joi
        .string()
        .required()
        .min(11)
        .regex(/^[a-z]{6}[0-9a-z]{2}([0-9a-z]{3})?/i)
    })
    // validate data format
    const result = joi.validate(values, schema, {
      allowUnknown: false,
      abortEarly: false
    })
    const clearValues = result.value
    let ibanList = await Bankaccount.query(qb => {
      qb.select("bankaccount.iban")
    }).fetchAll()
    let ibanArray = ibanList.toJSON().map(obj => obj["iban"].replace(/ /g, ""))
    let ibanWithoutSpace = clearValues.iban.replace(/ /g, "")

    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })

      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    // validate new iban is not exists on database
    let bankaccountModel = await Bankaccount.where({ iban: clearValues.iban }).fetch()
    if (bankaccountModel || ibanArray.includes(ibanWithoutSpace)) {
      throw new JsonApiError(`E_IBAN_EXISTS`, 400)
    }
    // save Bankaccount info
    clearValues.user = user.id
    let bankAccountModel = await Bankaccount.forge().save(_.pick(clearValues, ["iban", "bic", "holderName", "user"]), {
      method: "insert"
    })

    return bankAccountModel
  },
  removeUserBankaccount: async function(ctx) {
    const user = ctx.session.passport.user
    const body = ctx.request.body
    let { id } = ctx.params
    let schema = joi.object().keys({
      id: joi
        .string()
        .guid()
        .required()
    })
    // validate data format
    const result = joi.validate({ id: id }, schema, {
      allowUnknown: false,
      abortEarly: false
    })
    const clearValues = result.value

    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })

      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    // validate new iban different with primaryBankaccount
    let userModel = await User.where({ primaryBankaccount: clearValues.id }).fetch()
    if (userModel) {
      throw new JsonApiError(`E_CANNOT_DELETE_PRIMARY_BANKACCOUNT`, 400)
    }
    // delete bankaccount
    await Bankaccount.where({ id: clearValues.id, user: user.id }).destroy()

    return {
      id: clearValues.id
    }
  },
  setUserPrimaryBankaccount: async function(ctx) {
    const user = ctx.session.passport.user
    const body = ctx.request.body
    let { id } = ctx.params
    let schema = joi.object().keys({
      id: joi
        .string()
        .guid()
        .required()
    })
    // validate data format
    const result = joi.validate({ id: id }, schema, {
      allowUnknown: false,
      abortEarly: false
    })
    const clearValues = result.value

    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })

      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    // validate new iban different with primaryBankaccount
    let bankaccountModel = await Bankaccount.where({ id: clearValues.id, user: user.id }).fetch()
    if (!bankaccountModel) {
      throw new JsonApiError(`E_BANKACCOUNT_NOT_USER_OWNER`, 400)
    }
    // update bankaccount
    let userModel = await User.where({ id: user.id }).fetch()
    // find old primaryBankaccount
    if (userModel.primaryBankAccountModel) {
      let primaryBankAccountModel = await Bankaccount.where({ id: userModel.primaryBankAccountModel }).fetch()
      // assign bankaccount for user if not it's not owned by any user
      if (primaryBankAccountModel && !primaryBankAccountModel.attributes.user) {
        await primaryBankAccountModel.save({ user: user.id }, { patch: true })
      }
    }
    await userModel.save({ primaryBankaccount: bankaccountModel.id }, { patch: true })

    return bankaccountModel
  },
  deleteSetting: co.wrap(function*(ctx) {
    let { id } = ctx.params
    const schema = joi.object().keys({
      id: joi.string().required()
    })
    const result = joi.validate({ id: id }, schema, {
      allowUnknown: false,
      abortEarly: false
    })
    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    let setting = yield Usersetting.forge({
      user: ctx.session.passport.user.id,
      id: id
    }).fetch()
    if (setting) {
      yield setting.destroy()
    }
    const setttings = yield Usersetting.query({
      where: { user: ctx.session.passport.user.id }
    }).fetchAll()
    return setttings
  })
}
