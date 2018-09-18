"use strict"

const co = require("co")
const JsonApiError = require("../../../utils/json-api-error")
/**
 * Lifecycle callbacks for the `Transaction` model.
 */
module.exports = {
  // Before saving a value.
  // Fired before an `insert` or `update` query.
  // beforeSave: (model, attrs, options) =>  {
  //  return;
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
    // Set execution date automatically to today
    if (model.attributes.executionDate === undefined) {
      model.attributes.executionDate = new Date()
    }

    // TODO check for collisions
    // Generate transaction Id if it was not supplied
    if (!model.attributes.transactionId) {
      model.attributes.transactionId = await strapi.services.transaction.generateTransactionId()
    } else {
      let transaction = await Transaction.forge({ transactionId: model.attributes.transactionId }).fetch()
      if (transaction) {
        throw new JsonApiError(`E_TRANSACTION_ID_EXISTS`, 406, "Transaction ID was exists")
      }
    }

    if (model.attributes.invoice) {
      const invoice = await model.related("invoice").fetch()
      if (invoice.attributes.isSeed === true) {
        console.log(`Skipped creating a transaction for a seed invoice`)
        throw new Error(`E_NO_TRANSACTION_FOR_SEED_INVOICES`)
      }
    }

    // TODO Check whether transaction ID is valid
    // yield transaction = Transaction.forge({ transactionId: model.attributes.transactionId, paymentType: model.attributes.paymentType})

    // switch (model.attributes.paymentType) {

    /* case 'buyerFee':
        debugger

        let userModel = yield User.query({where: {id: model.attributes.user}}).fetch({withRelated: 'userSettings'}).catch((err) => {
          debbuger
          console.log(err)
        })
        let userSettings = userModel.related('userSettings').models

        const mandateUserSetting = _.find(userSettings, (item) => { return item.attributes.key === 'directDebitMandate' })

        if (!mandateUserSetting) {
          console.log('Could not find user setting directDebitMandate')
          return
        } else if (mandateUserSetting.attributes.value.confirmed !== true) {
          console.log('The direct debit mandate has not been confirmed yet')
          return
        } else if (!mandateUserSetting.attributes.value.documentId) {
          console.log('The user setting did not contain documentId')
          return
        }

        let mandateId = mandateUserSetting.attributes.value.documentId

        let lemonWayResponse = yield moneyInSddInit(model.attributes.amount, model.attributes.transactionId, mandateId)

        break */
    // ############################
    //
    // Payment from debtor to buyer
    // ----------------------------
    /* case 'debtor':
        // retrieve invoice

        let invoice = yield Invoice.query({where: {id: this.invoice().relatedData.parentFk}}).fetch()

        postOptions = {
          method: 'POST',
          url: 'https://api.secupay.ag/payment/init',
          headers,
          body: {
            data: {
              apikey: '9c63a447ab68074a39c8ee9fcc055e51195e9b49',
              demo,
              payment_type: 'prepay',
              set_accrual: '1',
              amount: invoice.attributes.outstandingBalance * 100,
            }
          },
          json: true
        }

        break
      // ############################
      // Payment from buyer to seller
      // ----------------------------
      case 'payout':

        let debtorAmount = model.attributes.amount - model.attributes.fee
        let invoiceModel = yield Invoice.query({where: {id: this.invoice().relatedData.parentFk}}).fetch({withRelated: ['owner', 'invoicesale']}).catch((err) => console.log(err))
        let buyerModel = yield User.query({where: {id: invoiceModel.relations.invoicesale.attributes.buyer}}).fetch().catch((err) => console.log(err))

        postOptions = {
          method: 'POST',
          url: 'https://api.secupay.ag/payment/subscription',
          headers,
          body: {
            data: {
              apikey: '9c63a447ab68074a39c8ee9fcc055e51195e9b49',
              demo,
              subscription_id: buyerModel.attributes.subscriptionId,
              amount: invoiceModel.attributes.amount * 100,
              currency: 'EUR',
              purpose: `Ihr Erwerb von Rechnung Nr ${invoiceModel.attributes.invoiceNumber}`,
              basket: [{
                item_type: 'stakeholder_payment',
                apikey: invoiceModel.relations.owner.attributes.walletID,
                name: 'debtor payment',
                total: debtorAmount * 100
              }]
            }
          },
          json: true
        } */
    // }

    /*
    secupayResult = yield rpn(postOptions)

    if (secupayResult.errors !== null) {
      throw new Error(JSON.stringify(secupayResult.errors))
    }

    if (secupayResult.status === 'ok') {
      // Save subscription ID
      if (secupayResult.data.subscription_id !== undefined) {
        yield userModel.save({subscriptionId: secupayResult.data.subscription_id})
        strapi.log.info(`New SecuPay subscription with ID ${secupayResult.data.subscription_id} saved to user ${userModel.attributes.companyName}`)
      }
      // Write subscription ID to
      model.attributes.secupayHash = secupayResult.data.hash
      model.attributes.reference = `OPI/${secupayResult.data.hash}`

      strapi.log.info(`Succeefully created a Secupay transaction with hash ${secupayResult.data.hash}`)

      // TODO Send notifications to seller
    } else {
      strapi.log.error(JSON.stringify(secupayResult))
      throw new Error(JSON.stringify(secupayResult))
    } */

    // return
  },

  // After creating a value.
  // Fired after `insert` query.
  // afterCreate: (model, attrs, options) =>  {
  //   return new Promise();
  // },

  // Before updating a value.
  // Fired before an `update` query.
  // beforeUpdate: (model, attrs, options) => {
  //   return new Promise();
  // },

  // After updating a value.
  // Fired after an `update` query.
  afterUpdate: co.wrap(function*(model, attrs, options) {
    let { paymentType, state, amount, fee, invoice } = model.attributes

    // After finishDebtorTransaction
    // Add Stakeholder payment to buyer
    //
    /*
    if (paymentType === 'debtor' && options.previousAttributes.state === 'pending' && state === 'started') {

      let invoiceModel = yield Invoice.query({where: {id: invoice}}).fetch({withRelated: 'buyer'})
      let buyerModel = invoiceModel.relations.buyer
      let debtorAmount = amount - fee

      let postOptions = { method: 'POST',
        url: 'https://api.secupay.ag/payment/additem',
        headers,
        body: {
          data: {
            apikey: '9c63a447ab68074a39c8ee9fcc055e51195e9b49',
            hash: secupayHash,
            demo,
            basket: [{
              item_type: 'stakeholder_payment',
              apikey: buyerModel.attributes.walletID,
              name: 'debtor payment',
              total: debtorAmount * 100
            }]
          },
          json: true
        }
      }

      let secupayResult = yield rpn(postOptions)

      if (secupayResult.errors !== null) {
        throw new Error(secupayResult.errors)
      }

      // Remove accrual
      postOptions = { method: 'POST',
        url: 'https://api.secupay.ag/payment/reverseaccrual',
        headers,
        body: {
          demo,
          apikey: '9c63a447ab68074a39c8ee9fcc055e51195e9b49',
          hash: secupayHash
        }
      }

      secupayResult = yield rpn(postOptions)

      if (secupayResult.errors !== null) {
        throw new Error(secupayResult.errors)
      }
    }
  */
    // options.previousAttributes
    return model
  })

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
