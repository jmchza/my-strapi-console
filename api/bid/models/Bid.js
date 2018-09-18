"use strict"

const JsonApiError = require("../../../utils/json-api-error")
const common = require("../../../utils/common")
const co = require("co")
const _ = require("lodash")
const SOLD_STATUS = "sold"
/**
 * Lifecycle callbacks for the `Bid` model.
 */

module.exports = {
  // Before saving a value.
  // Fired before an `insert` or `update` query.
  // beforeSave: (model, attrs, options) =>  {
  //   return new Promise();
  // },

  // After saving a value.
  // Fired after an `insert` or `update` query.
  // afterSave: (model, response, options) =>  {
  //   return new Promise();
  // },

  // Before fetching a value.
  // Fired before a `fetch` operation.
  // beforeFetch: (model, columns, options) =>  {
  //   return new Promise();
  // },

  // After fetching a value.
  // Fired after a `fetch` operation.
  // afterFetch: (model, response, options) =>  {
  //   return new Promise();
  // },

  // Before creating a value.
  // Fired before `insert` query.
  beforeCreate: async function(model, attrs, options) {
    let { invoicesale, amount, bidder } = model.attributes
    amount = parseFloat(amount)
    // throw new JsonApiError(`E_BID_TOO_LOW`, 400)

    // No invoice field supplied
    if (invoicesale === undefined) {
      throw new JsonApiError(`E_VALIDATION`, 400, `Required argument invoice missing`)
    }
    let invoiceModel = await Invoice.query({ where: { invoicesale } }).fetch()
    let invoicesaleModel = await Invoicesale.forge({ id: invoicesale }).fetch()
    let bidderModel = await User.forge({ id: bidder }).fetch()
    // Invoice does not exist
    if (bidderModel === null || !bidderModel.attributes.isValidated) {
      throw new JsonApiError(`E_VALIDATION_USER_NOT_ACTIVE`, 400, `The Bidder is not active`)
    }
    if (invoiceModel === null || invoicesaleModel === null) {
      throw new JsonApiError(`E_VALIDATION`, 400, `The invoice does not exist`)
    }

    if (invoiceModel.attributes.owner === bidder) {
      throw new JsonApiError(`E_OWNER_BIDDING`, 400, `You cannot bid on your own invoice`)
    } else if (SOLD_STATUS === invoiceModel.attributes.status) {
      throw new JsonApiError(`E_BIDDING_SOLD_INVOICE`, 400, `You cannot bid on a sold invoice`)
    } else if (parseInt(amount * 100, 10) < parseInt(invoicesaleModel.attributes.minimumBid * 100, 10)) {
      throw new JsonApiError(`E_BID_TOO_LOW`, 400, `You have to bid at least the minimum invoice price`)
    } else if (invoiceModel.attributes.status !== "available") {
      throw new JsonApiError(
        `E_BIDDING_NOT_AVAIABLE_INVOICE`,
        400,
        `You cannot bid on an invoice which is not up for sale`
      )
    } else if (bidderModel.attributes.clientId !== invoiceModel.attributes.clientId) {
      throw new JsonApiError(`E_METHOD_NOT_ALLOWED`, 400, `You can't not bid on other clientId`)
    }

    let selloutBid = invoicesaleModel.attributes.selloutBid

    if (parseInt(amount * 100, 10) > parseInt(selloutBid * 100)) {
      throw new JsonApiError(`E_BID_GREATER_SELLOUT_PRICE`, 400, `You cannot bid higher than the instant sellout price`)
    }

    // Check for the current highest bid
    let { highestBid } = invoicesaleModel.attributes
    let highestBidAmount = _.isObject(highestBid) ? highestBid.attributes.amount : highestBid
    if (highestBidAmount >= amount) {
      throw new JsonApiError(`E_HIGHER_BID`, 400, `There is already a higher bid on this invoice`)
      /*    } else if (highestBid.attributes.bidder === bidder) {
      throw new JsonApiError(`E_ALREADY_HIGHEST_BIDDER`, 400, `You are already highest bidder`) */
    } else if (invoicesaleModel.attributes.amount < amount) {
      throw new JsonApiError(`E_BID_HIGHER_THAN_VALUE_OF_INVOICE`, 400, `Your bid is higher than value of the invoice`)
    }
    // Pass the invoice model to afterCreate
    this.invoice = invoiceModel
    this.invoicesale = invoicesaleModel

    return model
  },

  // After creating a value.
  // Fired after `insert` query.
  afterCreate: async function(model, attrs, options) {
    let { amount, bidder } = model.attributes
    amount = parseFloat(amount)
    // Add the just created bid as highestBid to the invoice
    let invoiceModel = this.invoice
    let invoicesale = this.invoicesale
    await invoicesale.save({ highestBid: amount })
    const bidderModel = await User.where("id", bidder).fetch()
    const seller = await invoiceModel.related("owner").fetch()

    // This user bought the invoice
    let selloutBid = invoicesale.attributes.selloutBid

    // TODO Check this properly using the Number type and rounding
    if (parseFloat(amount * 100).toFixed(0) === parseFloat(selloutBid * 100).toFixed(0)) {
      await invoicesale.save({ buyer: bidder, winningBid: model.id }, { patch: true })
      await invoiceModel.save({ status: SOLD_STATUS }, { patch: true })

      // Buying and selling notifications are sent here instead of in invoice lifecycle methods
      // because the notifications when the seller accepts a bid manually are different
      await Notification.forge({
        type: "invoiceBought",
        data: {
          invoiceNumber: invoiceModel.attributes.invoiceNumber,
          faktooraId: invoiceModel.attributes.faktooraId,
          invoiceId: invoiceModel.attributes.id,
          amount: model.attributes.amount
        },
        invoice: invoiceModel.id,
        actionUrl: `/invoice/details/${invoiceModel.attributes.faktooraId}`,
        recipient: model.attributes.bidder,
        skipEmail: true
      }).save()
      await Notification.forge({
        type: `invoiceSold`,
        data: {
          invoiceNumber: invoiceModel.attributes.invoiceNumber,
          faktooraId: invoiceModel.attributes.faktooraId,
          amount: model.attributes.amount
        },
        invoice: `${invoiceModel.id}`,
        actionUrl: `/invoice/details/${invoiceModel.attributes.faktooraId}`,
        recipient: invoiceModel.attributes.owner,
        skipEmail: true
      }).save()
    } else {
      // We need to touch the invoice to trigger its beforeSave hook which updates the status displayed to the seller "receivedBids"
      await strapi.services.invoice.touch(invoiceModel.id)

      // User did was not able to buy the invoice
      await Notification.forge({
        type: `bidCreated`,
        data: {
          invoiceNumber: invoiceModel.attributes.invoiceNumber,
          faktooraId: invoiceModel.attributes.faktooraId,
          amount: common.formatCurrency(amount),
          sellerName: seller.attributes.companyName
        },
        actionUrl: `/invoice/details/${invoiceModel.attributes.faktooraId}`,
        invoice: invoiceModel.id,
        recipient: bidder
      }).save()

      let invoiceAmount = Number(invoiceModel.attributes.amount)
      let bidAmount = Number(amount)
      let payoutInvoiceAmount = (invoiceAmount * 0.99 - 3.5).toFixed(2)
      let payoutBidAmount = (bidAmount * 0.99 - 3.5).toFixed(2)
      invoiceAmount = invoiceAmount.toFixed(2)
      bidAmount = bidAmount.toFixed(2)

      //
      await Notification.forge({
        type: `bidReceived`,
        data: {
          invoiceNumber: invoiceModel.attributes.invoiceNumber,
          faktooraId: invoiceModel.attributes.faktooraId,
          bidderName: bidderModel.attributes.companyName,
          invoiceAmount: common.formatCurrency(invoiceAmount),
          payoutInvoiceAmount: common.formatCurrency(payoutInvoiceAmount),
          linkToInvoice: `${strapi.config.environments[strapi.config.environment].frontendUrl}/invoice/details/${invoiceModel.attributes.faktooraId}`,
          selloutPrice: common.formatCurrency(selloutBid),
          bidAmount: common.formatCurrency(bidAmount),
          payoutBidAmount: common.formatCurrency(payoutBidAmount)
        },
        invoice: invoiceModel.id,
        actionUrl: `/invoice/details/${invoiceModel.attributes.faktooraId}`,
        recipient: invoiceModel.attributes.owner
      }).save()
    }

    return model
  }

  // Before updating a value.
  // Fired before an `update` query.
  // beforeUpdate: (model, attrs, options) => {
  //   return new Promise();
  // },

  // After updating a value.
  // Fired after an `update` query.
  // afterUpdate: (model, attrs, options) =>  {
  //   return new Promise();
  // },

  // Before destroying a value.
  // Fired before a `delete` query.
  // beforeDestroy: (model, attrs, options) => {
  //   return new Promise();
  // },

  // After destroying a value.
  // Fired after a `delete` query.
  // afterDestroy: (model, attrs, options) => {
  //   return new Promise();
  // }
}
