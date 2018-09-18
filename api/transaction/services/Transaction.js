"use strict"

/**
 * Module dependencies
 */
const Chance = require("chance")
const chance = new Chance()
const _ = require("lodash")
const joi = require("joi")
const moment = require("moment")
const {
  moneyInSddInit,
  getWalletDetails,
  sendPayment,
  getMoneyInIBANDetails,
  moneyOut
} = require("../../../utils/lemonway")
const builderQuery = require("../../../utils/builder-query")
// Public dependencies.
const JsonApiError = require("../../../utils/json-api-error")

/**----------------------------------------------------------
 * ----------------------------------------------------------
 *     OLD FUNCTIONS TO BE REMOVE AFTER 1st OF MARCH 2018
 * ----------------------------------------------------------
 -----------------------------------------------------------*/
function oldCalculateSaleInsertionFee() {
  const saleInsertionFee = 3.5
  const vat = Math.round(saleInsertionFee * 0.19 * 1e2) / 1e2
  return Math.round((saleInsertionFee + vat) * 1e2) / 1e2
}

function oldCalculateSellerFee(price) {
  const fee = Math.round((price * 0.01 + 3.5) * 1e2) / 1e2
  const vat = Math.round(fee * 0.19 * 1e2) / 1e2
  // What costs letter sending?
  return Math.round((fee + vat) * 1e2) / 1e2
}
function oldCalculateLetterSendingFee() {
  const letterSendingFee = 1.95
  const vat = Math.round(letterSendingFee * 0.19 * 1e2) / 1e2
  return Math.round((letterSendingFee + vat) * 1e2) / 1e2
}

/**----------------------------------------------------------
 * ----------------------------------------------------------
 * END OF OLD FUNCTIONS TO BE REMOVE AFTER 1st OF MARCH 2018
 * ----------------------------------------------------------
 -----------------------------------------------------------*/

/**
 * Used to add multiple currency values (two decimals)
 * @param {Number} a [description]
 * @param {Number} b [description]
 */
function addCurrency(a, b) {
  return Math.round((a + b) * 1e2) / 1e2
}

function calculateLetterSendingFee() {
  const letterSendingFee = 1.95
  const vat = Math.round(letterSendingFee * 0.19 * 1e2) / 1e2
  return Math.round((letterSendingFee + vat) * 1e2) / 1e2
}

/**
 * Calculates the fees the buyer has to pay
 * @param  {[type]} price [description]
 * @return {[type]}       [description]
 */
function calculateBuyerFee(price) {
  const fee = Math.round(price * 0.01 * 1e2) / 1e2
  const vat = Math.round(fee * 0.19 * 1e2) / 1e2
  return Math.round((fee + vat) * 1e2) / 1e2
}

/**
 * Calculate the fee a seller has to pay for an invoice
 * @param  {Number} price Price of invoice
 * @param  {String} plan Plan the user currently has. Can be 'startup', 'basic' or 'premium'
 */
function calculateSellerFee(price, plan) {
  let feePercentPerPayment = 0.0125
  if (plan === "basic") {
    feePercentPerPayment = 0.009
  } else if (plan === "premium") {
    feePercentPerPayment = 0.007
  }
  const fee = Math.round(price * feePercentPerPayment * 1e2) / 1e2
  const vat = Math.round(fee * 0.19 * 1e2) / 1e2
  return Math.round((fee + vat) * 1e2) / 1e2
}

function generateTransactionId() {
  return `T${chance.string({ length: 6, pool: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" })}`
}

/**
 * Returns the transaction ID or null
 */
function isTransactionId(message) {
  const match = /^T{1}[A-Z0-9]{6}/.exec(message)

  if (Array.isArray(match)) {
    return match[0]
  } else {
    return null
  }
}

/**
 * Returns the faktoora Id or null
 * @param {*} message
 */
function isFaktooraId(message) {
  const match = /^F{1}[A-Z0-9]{6}/.exec(message)

  if (Array.isArray(match)) {
    return match[0]
  } else {
    return null
  }
}

async function sendMoneyP2P(obj) {
  const schema = joi.object().keys({
    benefactor: joi.object().required(),
    beneficiary: joi.object().required(),
    amount: joi
      .number()
      .precision(2)
      .required(),
    fee: joi
      .number()
      .precision(2)
      .required(),
    invoice: joi.object().required(),
    benefactorMessage: joi.string().required(),
    benefactorPaymentType: joi.string().required(),
    feeMessage: joi.string().required(),
    feePaymentType: joi.string().required()
  })
  const result = joi.validate(obj, schema, { allowUnknown: false, abortEarly: false })
  if (result.error !== null) {
    console.log(`Error during validation for method sendMoneyP2P`, result.error.details)
  }

  const faktooraUserModel = await User.query({ where: { walletID: strapi.config.environments[strapi.config.environment].lemonway.faktooraWalletId } }).fetch()

  const amount = Number(obj.amount).toFixed(2)
  const fee = Number(obj.fee).toFixed(2)
  // 1. Send money from benefactor to beneficiary
  //
  console.log(`[Lemonway] Starting ${obj.benefactorPaymentType} transaction`)
  const benefactorDebtor =
    obj.benefactorPaymentType === "FAKTOORA_TO_BUYER" || obj.benefactorPaymentType === "FAKTOORA_TO_SELLER"
      ? obj.invoice.attributes.debtor
      : null

  let benefactorPayment = await sendPayment(
    obj.benefactor.attributes.walletID,
    obj.beneficiary.attributes.walletID,
    amount,
    obj.benefactorMessage
  )

  await Transaction.forge({
    paymentType: obj.benefactorPaymentType,
    paymentMethod: "p2p",
    amount: obj.amount,
    reference: benefactorPayment.HPAY.ID,
    state: "finished",
    invoice: obj.invoice.id,
    benefactor: obj.benefactor.id,
    beneficiary: obj.beneficiary.id,
    benefactorDebtor
  }).save()

  // 2. Send seller/buyer-fee to Faktoora
  //
  if (obj.fee !== 0) {
    console.log(`[Lemonway] Starting ${obj.feePaymentType} transaction`)
    let feePayment = await sendPayment(
      obj.beneficiary.attributes.walletID,
      faktooraUserModel.attributes.walletID,
      fee,
      obj.feeMessage
    )

    await Transaction.forge({
      paymentType: obj.feePaymentType,
      paymentMethod: "p2p",
      amount: obj.fee,
      reference: feePayment.HPAY.ID,
      state: "finished",
      invoice: obj.invoice.id,
      benefactor: obj.beneficiary.id,
      beneficiary: faktooraUserModel.id
    }).save()
  } else {
    console.log(`[Lemon Way] No fees were charged for the ${obj.benefactorPaymentType} transaction`)
  }
}

module.exports = {
  /**
   * [payMonthlyBuyerFee description]
   * @type {[type]}
   */
  payMonthlyBuyerFee: async function(user) {
    // Create transaction
    // Generate transaction Id if it was not supplied
    let transactionId = await strapi.services.transaction.generateTransactionId()
    let amount = 39.0

    let userModel = await User.query({ where: { id: user.id } }).fetch({ withRelated: "userSettings" })
    const walletId = userModel.attributes.walletID

    let faktooraUserModel = await User.query({ where: { walletID: strapi.config.environments[strapi.config.environment].lemonway.faktooraWalletId } }).fetch()
    let userSettings = userModel.related("userSettings").models

    const mandateUserSetting = _.find(userSettings, item => {
      return item.attributes.key === "directDebitMandate"
    })

    if (!mandateUserSetting) {
      console.log("Could not find user setting directDebitMandate")
      return
    } else if (mandateUserSetting.attributes.value.confirmed !== true) {
      console.log("The direct debit mandate has not been confirmed yet")
      return
    } else if (!mandateUserSetting.attributes.value.documentId) {
      console.log("The user setting did not contain documentId")
      return
    }

    let mandateId = mandateUserSetting.attributes.value.documentId

    let lemonWayResponse
    try {
      lemonWayResponse = await moneyInSddInit(walletId, transactionId, mandateId, amount)
    } catch (err) {
      console.log("Error during creation of direct debit")
      console.log(err.details)
    }

    await Transaction.forge({
      paymentType: "MONTHLY_BUYER_FEE",
      paymentMethod: "directDebit",
      transactionId,
      amount,
      reference: lemonWayResponse.HPAY.ID,
      state: "pending",
      beneficiary: faktooraUserModel.id
    }).save()

    // faktooraUserModel.id
  },

  /* =============================================>>>>>
  = Pay for a purchased invoice =
  ===============================================>>>>> */
  createBuyerPayment: async function(invoiceSale) {
    try {
      // 1. Check buyer wallet
      // Todo synchronize
      let buyerModel = await User.query({ where: { id: invoiceSale.attributes.buyer } }).fetch({
        withRelated: "userSettings"
      })
      let buyerSettings = buyerModel.related("userSettings").models
      let faktooraUserModel = await User.query({ where: { walletID: strapi.config.environments[strapi.config.environment].lemonway.faktooraWalletId } }).fetch()
      let winningBid = await Bid.query({ where: { id: invoiceSale.attributes.winningBid } }).fetch()
      let invoice = await Invoice.query({ where: { id: invoiceSale.attributes.invoice } }).fetch({
        withRelated: "owner"
      })

      const buyerWalletDetails = await getWalletDetails(buyerModel.attributes.walletID, null)
      const invoicePrice = Number(Number(winningBid.attributes.amount).toFixed(2))
      const walletBalance = buyerWalletDetails.BAL

      // 2. If there is enough money on the wallet, pay directly
      if (parseFloat(walletBalance) >= parseFloat(invoicePrice)) {
        // Send money from buyer to seller
        let buyerWalletPayment = await sendPayment(
          buyerModel.attributes.walletID,
          faktooraUserModel.attributes.walletID,
          invoicePrice,
          `Buyer paying for invoice ${invoice.attributes.faktooraId}`
        )

        await Transaction.forge({
          paymentType: "BUYER_FULL_PAYMENT",
          paymentMethod: "p2p",
          amount: invoicePrice,
          reference: buyerWalletPayment.HPAY.ID,
          state: "finished",
          invoice: invoice.id,
          benefactor: buyerModel.id,
          beneficiary: faktooraUserModel.id
        }).save()

        // Send money to seller
        await strapi.services.transaction.sendSellerMoney(invoice.id)

        // 3. Withdraw required money from bankaccount
      } else {
        const difference = Math.round((invoicePrice - walletBalance) * 1e2) / 1e2 // This has to be withdrawn from the bankaccount
        const mandateUserSetting = _.find(buyerSettings, item => item.attributes.key === "directDebitMandate")

        if (!mandateUserSetting) {
          console.log("Could not find user setting directDebitMandate")
          return
        } else if (mandateUserSetting.attributes.value.confirmed !== true) {
          console.log("The direct debit mandate has not been confirmed yet")
          return
        } else if (!mandateUserSetting.attributes.value.documentId) {
          console.log("The user setting did not contain documentId")
          return
        }
        const mandateId = mandateUserSetting.attributes.value.documentId
        let lemonWayResponse
        const transactionId = await strapi.services.transaction.generateTransactionId()

        try {
          console.log("before moneyInSddInit")
          lemonWayResponse = await moneyInSddInit(buyerModel.attributes.walletID, transactionId, mandateId, difference)
          console.log("after moneyInSddInit")

          await Transaction.forge({
            paymentType: "DEPOSIT_FOR_INVOICE",
            paymentMethod: "directDebit",
            transactionId,
            amount: difference,
            reference: lemonWayResponse.HPAY.ID,
            state: "pending",
            invoice: invoice.id,
            benefactor: null,
            beneficiary: buyerModel.id
          }).save()
        } catch (err) {
          console.log("Error during creation of direct debit")
          console.log(err.details)
        }

        // 4. Send wallet balance
        if (parseFloat(walletBalance) > 0) {
          console.log(`Difference was ${difference}. Sending wallet balance to wallet ${walletBalance}`)
          // Send wallet balance to society wallet as a part payment
          let partPayment = await sendPayment(
            buyerModel.attributes.walletID,
            faktooraUserModel.attributes.walletID,
            walletBalance,
            `Part payment for ${invoice.attributes.faktooraId}`
          )

          await Transaction.forge({
            paymentType: "BUYER_PART_PAYMENT",
            paymentMethod: "p2p",
            amount: walletBalance,
            reference: partPayment.HPAY.ID,
            state: "finished",
            invoice: invoice.id,
            benefactor: buyerModel.id,
            beneficiary: faktooraUserModel.id
          }).save()

          console.log(
            `${difference}€ were missing on buyer wallet ${
              buyerModel.attributes.walletID
            }. We transferred the wallet balance ${walletBalance}€ to the society wallet`
          )
        } else {
          console.log(`Debited the whole buying amount of ${invoicePrice}€ from bank account.`)
        }
      }
    } catch (err) {
      console.log(err)
    }
  },

  createDebtorTransaction: async function(invoice) {
    await Transaction.forge({
      paymentType: "DEBTOR",
      paymentMethod: "bankTransfer",
      invoice: invoice.id,
      amount: invoice.attributes.outstandingBalance,
      state: "pending"
    }).save()
  },

  finishDebtorTransaction: async function(invoice) {
    let transactionModel = await Transaction.query({ where: { invoice: invoice.id } }).fetch()
    // caculate fee 0.5%
    if (transactionModel) {
      let fee = (invoice.attributes.outstandingBalance * 0.005).toFixed(2)
      await transactionModel.save(
        {
          state: "started",
          fee
        },
        { patch: true }
      )
    }
  },

  /**
   * The user accepted the direct debit mandate
   * @param  {[type]} ctx [description]
   * @return {[type]}     [description]
   */
  acceptDirectDebitMandate: async function(ctx) {
    try {
      let user = ctx.session.passport.user
      const settingDebit = await Usersetting.query({
        where: { user: ctx.session.passport.user.id, key: "directDebitMandate" }
      }).fetch()
      if (
        settingDebit &&
        settingDebit.attributes &&
        settingDebit.attributes.value &&
        !settingDebit.attributes.value.confirmed
      ) {
        const newValue = Object.assign(settingDebit.attributes.value, { confirmed: true })
        // Use to Register and sign direct debit mandate //
        /* let userModel = await strapi.services.jsonapi.fetch(strapi.models.user, {id: user.id}, {includes: ['primaryBankaccount']})
        const mandate = await registerSddMandate(userModel.toJSON(), ctx.ip)
        const signDocumentData = await signDocumentInit(userModel.toJSON(), mandate, ctx.ip)
        const newValue = {
          confirmed: true,
          mandateId: mandate.ID,
          mandateStatus: mandate.S,
          directDebitMandate: signDocumentData
        } */
        await settingDebit.save({ value: JSON.stringify(newValue) }, { path: true })
        // TODO: This way of refreshing user session data seems counter-intuitive. Let's create a general method to do it altogether.
        const newSettings = await Usersetting.query({ where: { user: ctx.session.passport.user.id } }).fetchAll()
        user.userSettings = newSettings.toJSON()
        ctx.session.passport.user = user
        return {
          success: true
        }
      } else {
        throw new JsonApiError(`E_SETTING_DEBIT`, 406, { success: false })
      }
    } catch (err) {
      throw err
    }
  },

  moneyReceived: async function(ctx) {
    try {
      const body = ctx.request.body
      console.log("moneyReceived called with data")
      console.log(body)
      const amountReceived = parseFloat(body.Amount)
      const walletId = body.ExtId
      const reference = body.IdTransaction
      const notificationCategory = body.NotifCategory
      const status = Number(body.Status)
      // Pbody["Payment method"] ex. "14"  <- what does this mean?

      if (status !== 0) {
        console.log(`Transaction status was ${status}. Only '0' is handled right now`)
        console.log(`Transaction details`, JSON.stringify(body))
        return
      }
      // 1. Determine transaction and matching wallet
      let transaction = await Transaction.query(qb => {
        qb.whereIn("paymentType", ["DEPOSIT_FOR_INVOICE", "MONTHLY_BUYER_FEE"])
        qb.andWhere("reference", "=", reference)
      }).fetch({ withRelated: "invoice.invoicesale" })

      if (transaction === null) {
        console.log(`Transaction with reference ${reference} could not be found. Check your data!`)
        return
      }

      // const transactionAmount = transaction.attributes.amount
      switch (notificationCategory) {
        // Received direct debit mandate
        case "11":
          const faktooraUserModel = await User.query({
            where: { walletID: strapi.config.environments[strapi.config.environment].lemonway.faktooraWalletId }
          }).fetch()

          console.log(`Received ${amountReceived}€ via direct debit on wallet ID ${walletId} (reference: ${reference})`)
          console.log(`Payment type: ${_.get(transaction, "attributes.paymentType")}`)

          if (transaction.attributes.paymentType === "DEPOSIT_FOR_INVOICE") {
            let invoice = transaction.related("invoice")
            let invoiceSale = invoice.related("invoicesale")
            let winningBid = await Bid.where("id", invoiceSale.attributes.winningBid).fetch()
            let winningBidAmount = parseFloat(winningBid.attributes.amount)

            let buyer = await User.where("id", invoiceSale.attributes.buyer).fetch({ withRelated: "userSettings" })

            // 2. Book money from wallet to society wallet
            //
            let lemonwayComment = `2nd part payment for invoice ${invoice.attributes.faktooraId}`
            let paymentType = "BUYER_PART_PAYMENT"

            if (winningBidAmount === amountReceived) {
              lemonwayComment = `Full payment for invoice ${invoice.attributes.faktooraId}`
              paymentType = "BUYER_FULL_PAYMENT"
            }

            let buyerWalletPayment = await sendPayment(
              buyer.attributes.walletID,
              faktooraUserModel.attributes.walletID,
              amountReceived,
              lemonwayComment
            )

            await Transaction.forge({
              paymentType,
              paymentMethod: "p2p",
              amount: amountReceived,
              reference: buyerWalletPayment.HPAY.ID,
              state: "finished",
              invoice: invoice.id,
              benefactor: buyer.id,
              beneficiary: faktooraUserModel.id
            }).save()

            // Send money to seller
            await strapi.services.transaction.sendSellerMoney(invoice.id)

            console.log(
              `Changing status of transaction ID ${
                transaction.attributes.transactionId
              } to finished and invoice to paid`
            )
            await invoiceSale.save({ buyerStatus: "paid", paymentDate: moment().toDate() }, { patch: true })
            await transaction.save({ state: "finished" }, { patch: true })

            // this was a split transaction because the buyer did not have enough money on his wallet
            if (winningBidAmount > amountReceived) {
              console.log(`amount received (${amountReceived}) was less than buy amount.`)
            } else if (amountReceived > winningBidAmount) {
              console.log(
                `amountReceived can never be greater than winningBidAmount. This is an error. amountReceived ${amountReceived}, winningBidAmount ${winningBidAmount}`
              )
            }
          } else if (transaction.attributes.paymentType === "MONTHLY_BUYER_FEE") {
            // Send money from benefactor to beneficiary
            const faktooraUserModel = await User.query({
              where: { walletID: strapi.config.environments[strapi.config.environment].lemonway.faktooraWalletId }
            }).fetch()
            const buyerModel = await User.query({ where: { id: transaction.attributes.beneficiary } }).fetch()
            let transferMonthlyFee = await sendPayment(
              buyerModel.attributes.walletID,
              strapi.config.environments[strapi.config.environment].lemonway.faktooraWalletId,
              amountReceived.toFixed(2),
              `Monthy buyer fee`
            )
            console.log(`Received monthly fee for ${buyerModel.attributes.companyName}`)

            await Transaction.forge({
              paymentType: "TRANSFER_MONTHLY_FEE",
              paymentMethod: "p2p",
              amount: amountReceived,
              reference: transferMonthlyFee.HPAY.ID,
              state: "finished",
              invoice: transaction.attributes.invoice,
              benefactor: buyerModel.id,
              beneficiary: faktooraUserModel.id
            }).save()
          } else {
            console.log(
              `You received money for the paymentType ${
                transaction.attributes.paymentType
              } but this case is not handled right now.`
            )
          }

          break
        // Unhandled notification category
        default:
          console.log(`The notificationCategory ${notificationCategory} is currently unhandled.`)
      }
    } catch (err) {
      console.log(err)
    }
  },

  /* ==========================================================>>>>>
  = Checks whether a Support task for an unrecognized bank transfer
  = exists and creates it if necessary
  ============================================================>>>>> */
  createSupportTaskForUnknownBanktransfer: async function(reference, comment) {
    // Look up whether a supporttask already exists for this banktransfer
    const supportTasks = await Supporttask.where("type", "unassigned-banktransfer").fetchAll()
    const banktransferAlreadyAssigned = supportTasks.models.find(
      item => String(_.get(item, "data.reference")) === String(reference)
    )

    // There is already a supporttask for the banktransfer
    if (banktransferAlreadyAssigned !== undefined) {
      console.log(`Supporttask for reference ${reference} already exists. Skipping`)
      return
    }

    // create task for unassigned banktransfer
    await Supporttask.forge({
      type: "unassigned-banktransfer",
      data: {
        reference,
        comment
      }
    }).save()
    console.log(`New Supporttask for reference ${reference} has been created.`)
  },

  /* ==========================================================>>>>>
  = Checks whether Lemon Way registered new bank transfers
  ============================================================>>>>> */
  checkBankTransfers: async function(timestamp = null) {
    try {
      let timeToCheck
      let lastBankTransferCheck
      let printDate
      if (timestamp !== null) {
        timeToCheck = timestamp
        printDate = new Date(timestamp * 1000)
        console.log(`Using timestamp ${timestamp} (${printDate}) for bank transfer check)`)
      } else {
        // When was banktransfer checked for the last time
        lastBankTransferCheck = await Setting.where("key", "bankTransferCheck").fetch()

        // This function has never been executed before so create the setting
        if (lastBankTransferCheck === null) {
          lastBankTransferCheck = await Setting.forge({
            key: "bankTransferCheck",
            value: {
              lastCheck: new Date("2017-01-01")
            }
          }).save()
          console.log(`Created Setting bankTransferCheck with last check set to ${new Date("2017-01-01")}`)
        }
        printDate = lastBankTransferCheck.attributes.value.lastCheck
        timeToCheck = lastBankTransferCheck.attributes.value.lastCheck
      }

      const ibanDetails = await getMoneyInIBANDetails(timeToCheck)
      console.log(JSON.stringify({ ibanDetails }))
      if (ibanDetails.length > 0) {
        console.log(`Found ${ibanDetails.length} new bank transfers since ${printDate}`)
        for (let transfer of ibanDetails) {
          // Query for matching transaction
          const amount = transfer.CRED
          const reference = transfer.ID
          const status = transfer.STATUS

          // Example why the following text transformations are necessary FKTR-FACTORING TQB8ENZ-AWV-Meldepflichtbeachten-
          let message = transfer.MSG
          message = message.toUpperCase()
          let message2 = message // TODO get rid of copy
          let fktrPos = message.indexOf("FKTR")

          // Could not find position of "FKTR" but there are other ways to determine it
          if (fktrPos === -1) {
            fktrPos = 0
          }
          message = message
            .substr(fktrPos, 22)
            .replace(/FKTR-FACTORING/g, "")
            .replace(/(\s|-|_)+/g, "")
            .substr(0, 7)
          let transactionId = isTransactionId(message)

          // Check status code of bank transfer
          //
          if (status !== "3") {
            console.log(`Status of bank transfer is not successful, it is ${status}
            Error: ${transfer.INT_MSG}`)
            continue
          }

          // Different Money-In wallet than FACTORING
          //
          if (transfer.REC !== "FACTORING") {
            console.log(`Only the wallet FACTORING is allowed for money in, yet ${transfer.REC} was supplied.
                         You need to handle this manually`)
            await strapi.services.transaction.createSupportTaskForUnknownBanktransfer(
              reference,
              `Wallet for money-in was not FACTORING, it was ${transfer.REC}`
            )
            continue
          }

          // Could not extract transaction ID from message so we try to determine it by faktoora ID
          if (transactionId === null) {
            // Determine transaction by faktoora ID
            let faktooraId = isFaktooraId(message)

            // Could not determine faktoora ID, trying another schema
            // This mattches this: RE.Nr.:2000F12 Referenz:F5P0SIP
            if (faktooraId === null) {
              let match = /F{1}[A-Z0-9]{6}/.exec(message2)
              if (Array.isArray(match)) {
                faktooraId = isFaktooraId(match[0])
              }
            }

            if (faktooraId === null) {
              console.log(
                `Could not extract transaction ID or faktoora ID from transfer message, raw message was ${
                  transfer.MSG
                }, reference ${reference}`
              )
              await strapi.services.transaction.createSupportTaskForUnknownBanktransfer(
                reference,
                `Could not determine transaction ID or faktoora ID from transfer message, raw message was ${
                  transfer.MSG
                }`
              )
              continue
            } else {
              console.log(`Extracted faktoora ID ${message} from ${transfer.MSG}`)
              // find invoice
              let invoice = await Invoice.where("faktooraId", faktooraId).fetch({
                withRelated: ["transactions"]
              })

              if (invoice === null) {
                console.log(`Could not find invoice with faktoora ID ${faktooraId}. Skipping.`)
                continue
              }

              // Find debtor to faktoora transaction
              const transactions = invoice.related("transactions")
              let debtorToFaktooraTransaction = transactions.models.find(
                item => item.attributes.paymentType === "DEBTOR_TO_FAKTOORA"
              )

              // Could not find the DEBTOR_TO_FAKTOORA transaction
              if (debtorToFaktooraTransaction === undefined) {
                console.log(
                  `Out of ${
                    transactions.length
                  } transaction(s) for ${faktooraId} none is of paymentType DEBTOR_TO_FAKTOORA. There must be an error`
                )
                continue
              }

              transactionId = debtorToFaktooraTransaction.attributes.transactionId
            }
          } else {
            console.log(`Extracted transaction ID ${message} from ${transfer.MSG}`)
          }

          // Retrieve the transaction
          // For debtor to faktoora transaction determined via faktoora ID it is retrieved again here in order to include the related entities invoice and invoicesale
          let transaction = await Transaction.where("transactionId", transactionId).fetch({
            withRelated: ["invoice.invoicesale"]
          })

          // Transaction not found in DB
          //
          if (transaction === null) {
            console.log(`Could not find transaction with transactionId ${transactionId} in database`)
            continue
          }

          if (transaction.attributes.state === "finished") {
            console.log(`Skipping ${transaction.attributes.transactionId}. The transaction  has been processed already`)
            continue
          }

          // Note: It's comparing strings here but that is fine because the transaction amount needs to be exactly the same
          // as the amount in the database
          if (amount !== transaction.attributes.amount) {
            console.log(
              `Bank transfer amount of ${amount} does not match transaction amount of ${transaction.attributes.amount}`
            )
            continue
          }

          let invoice = transaction.related("invoice")
          let invoiceSale = invoice.related("invoicesale")

          // Set transaction status and reference
          await transaction.save({ state: "finished", reference: reference }, { patch: true })
          // Invoice has been paid by debtor
          await invoice.save({ status: "paid", paymentDate: moment().toDate() }, { patch: true })

          // tranfer money received from FACTORING to Society wallet
          const amountReceived = Number(amount).toFixed(2)
          const faktooraUserModel = await User.query({
            where: { walletID: strapi.config.environments[strapi.config.environment].lemonway.faktooraWalletId }
          }).fetch()
          const internalTransfer = await sendPayment(
            "FACTORING",
            faktooraUserModel.attributes.walletID,
            amountReceived,
            `transfer of debtors bankwire for ${invoice.attributes.faktooraId}`
          )

          await Transaction.forge({
            paymentType: "BANKWIRE_TRANSFER",
            paymentMethod: "p2p",
            amount: amountReceived,
            reference: internalTransfer.HPAY.ID,
            state: "finished",
            invoice: invoice.id,
            benefactor: faktooraUserModel.id,
            beneficiary: faktooraUserModel.id
          }).save()

          // Invoice has been sold already so we can send the money to the buyer or seller depending on whether it has been sold already
          let receiverOfPaidNotification
          let notificationType
          if (invoiceSale.id !== undefined && invoiceSale.attributes.buyer !== null) {
            await strapi.services.transaction.sendBuyerMoney(invoiceSale.id)
            receiverOfPaidNotification = invoiceSale.attributes.buyer
            notificationType = "invoiceFactoredPaid"
          } else {
            // abort selling the invoice
            await strapi.services.transaction.sendSellerMoney(invoice.id)
            receiverOfPaidNotification = invoice.attributes.owner
            notificationType = "invoiceNotFactoredPaid"
          }

          // Send notification to buyer or seller
          // TODO DOES NOT WORK
          await Notification.forge({
            type: notificationType,
            data: {
              invoiceNumber: invoice.attributes.invoiceNumber,
              faktooraId: invoice.attributes.faktooraId
            },
            invoice: invoice.id,
            recipient: receiverOfPaidNotification
          }).save()

          if (invoiceSale.attributes.buyer === null) {
            console.log(`Invoice ID ${invoice.id} has not been bought yet.`)
            continue
          } else {
            // TODO WHAT HAPPENED HERE?
          }
        }
      } else {
        console.log(`Skipping. No new bank transfers since last check`)
      }

      const updateDateTime = new Date()
      if (timestamp === null) {
        lastBankTransferCheck.save({ value: { lastCheck: updateDateTime } }, { patch: true })
      }
      console.log(`Executed bankTransferCheck at ${updateDateTime}`)
    } catch (err) {
      console.log("An error occured during checkBankTransfers")
      console.log(err)
    }
  },
  /* ==========================================================>>>>>
  = Sends the money to the seller once the invoice has been paid
  = before being bought
  ============================================================>>>>> */
  sendSellerMoney: async function(invoiceId) {
    console.log(`sendSellerMoney was called for ${invoiceId}`)
    try {
      let invoice = await Invoice.where("id", invoiceId).fetch({ withRelated: ["owner", "invoicesale.winningBid"] })
      let invoicesale = invoice.related("invoicesale")
      const faktooraUserModel = await User.query({
        where: { walletID: strapi.config.environments[strapi.config.environment].lemonway.faktooraWalletId }
      }).fetch()
      const seller = invoice.related("owner")
      let faktooraServices = []

      // Determine whether user registered until 5th of February
      const useOldFeeModel = new Date("2018-02-05T23:59") > new Date(seller.attributes.created_at)
      if (useOldFeeModel) {
        console.log("Old user detected, Applying OLD fee model")
      } else {
        console.log("New user detected, Applying NEW fee model")
      }

      // Determine fees and invoice amount
      let sendAmount = invoice.attributes.outstandingBalance // default value is invoice amount when invoice was not up for sale or has not been sold
      let fee = 0.0 // default value when invoice was not up for sale at all
      let invoiceState = "not factored"

      // Get subscription of seller
      const currentSubscription = await Subscription.where({ user: seller.id, isCurrent: true }).fetch()
      let plan = "startup"

      if (currentSubscription !== null) {
        plan = currentSubscription.attributes.plan
        console.log(`Current subscription of seller is ${plan}`)
      } else {
        console.log("Could not find a subscription for seller, assuming startup plan")
      }

      // When the invoice has been sold
      if (invoicesale.id !== undefined && invoicesale.attributes.buyer !== null) {
        // Determine amount of winning bid
        invoiceState = "factored"
        let winningBid = invoicesale.related("winningBid")
        sendAmount = Math.round(winningBid.attributes.amount * 1e2) / 1e2

        if (useOldFeeModel === true) {
          fee = oldCalculateSellerFee(sendAmount)
          console.log(`Applying old fee model, adding seller fee, fee = ${fee}`)
        }
        faktooraServices.push("transaction charge")
        // When the invoice is up for sale we chage the insertionfee
      } else if (invoice.attributes.invoicesale !== null) {
        if (useOldFeeModel === true) {
          faktooraServices.push("sale insertion")
          fee = oldCalculateSaleInsertionFee()
          console.log(`Applying old fee model, adding sale insertion fee, fee = ${fee}`)
        }
      }

      // Add postal fee if the invoice has been sent via EPost
      if (invoice.attributes.data.sendPost === true && useOldFeeModel === true) {
        faktooraServices.push("letter sending")
        fee = addCurrency(fee, oldCalculateLetterSendingFee())
        console.log(`Adding letter sending fee, fee = ${fee}`)
      }

      // Calculate fee on ALL invoices in NEW fee model
      if (useOldFeeModel === false) {
        fee = calculateSellerFee(sendAmount, plan)
        console.log(`Applying new fee model, fee = ${fee}`)
      }

      // Send payment from  to seller
      await sendMoneyP2P({
        benefactor: faktooraUserModel,
        beneficiary: seller,
        amount: sendAmount,
        fee,
        invoice,
        benefactorMessage: `Seller payment for invoice ${invoice.attributes.faktooraId} (${invoiceState})`,
        benefactorPaymentType: `FAKTOORA_TO_SELLER`,
        feeMessage: `Seller fee for invoice ${invoice.attributes.faktooraId} (${faktooraServices.join(" + ")})`,
        feePaymentType: "SELLER_FEE"
      })

      // Calculate invoice sum - fee
      let beneficiaryAmount = Math.round((sendAmount - fee) * 1e2) / 1e2

      // Transfer seller money to bank account
      let sellerPayout = await moneyOut(
        seller.attributes.walletID,
        beneficiaryAmount,
        `Payout from invoice ${invoice.attributes.faktooraId}`
      )

      console.log(`Response from sellerPayout ${JSON.stringify(sellerPayout)}`)
      await Transaction.forge({
        paymentType: "SELLER_PAYOUT",
        paymentMethod: "bankTransfer",
        amount: beneficiaryAmount,
        reference: sellerPayout.ID,
        state: "finished",
        invoice: invoice.id,
        benefactor: seller.id
      }).save()

      console.log(
        `[Lemon Way] Issued payout of ${beneficiaryAmount}€ to seller from wallet ${seller.attributes.walletID}`
      )

      // Also generate the invoice and send it to the seller when fees have been deducted
      // This is either the case when he put the invoice up for sale or he at least sent it via post
      /*if (invoice.attributes.invoicesale !== null || invoice.attributes.data.sendPost === true) {
        Promise.resolve(strapi.services.invoice.createSellerInvoice(invoice.id))
      }*/
    } catch (err) {
      console.log(err)
    }
  },
  /* ==========================================================>>>>>
  = Sends the money to a buyer once an invoice is sold
  ============================================================>>>>> */
  sendBuyerMoney: async function(invoiceSaleId) {
    try {
      let invoiceSale = await Invoicesale.where("id", invoiceSaleId).fetch({
        withRelated: ["invoice", "buyer", "winningBid"]
      })
      let invoice = invoiceSale.related("invoice")
      let buyer = invoiceSale.related("buyer")
      const winningBid = invoiceSale.related("winningBid")

      const faktooraUserModel = await User.query({
        where: { walletID: strapi.config.environments[strapi.config.environment].lemonway.faktooraWalletId }
      }).fetch()

      const buyerFee = calculateBuyerFee(Math.round(winningBid.attributes.amount * 1e2) / 1e2)

      console.log(`Sending money from debtor for invoice ID ${invoice.attributes.faktooraId} to buyer`)

      // Send payment from FACTORING wallet to buyer
      await sendMoneyP2P({
        benefactor: faktooraUserModel,
        beneficiary: buyer,
        amount: invoice.attributes.outstandingBalance,
        fee: buyerFee,
        invoice,
        benefactorMessage: `Payment to buyer for invoice ${invoice.attributes.faktooraId}`,
        benefactorPaymentType: `FAKTOORA_TO_BUYER`,
        feeMessage: `Buyer fee for invoice ${invoice.id}`,
        feePaymentType: `BUYER_FEE`
      })

      let beneficiaryAmount = Math.round((invoice.attributes.outstandingBalance - buyerFee) * 1e2) / 1e2

      console.log(
        `[Lemon Way] Issued payout of ${beneficiaryAmount}€ to buyer from wallet ${buyer.attributes.walletID}`
      )
    } catch (err) {
      console.log(err)
    }
  },
  generateTransactionId: async function() {
    let tryGenerateTime = 0
    do {
      let transactionId = generateTransactionId()
      let transaction = await Transaction.forge({ transactionId }).fetch()
      if (!transaction) return transactionId
      ++tryGenerateTime
    } while (tryGenerateTime <= 10)

    throw new JsonApiError(`E_GENERATE_TRANSACTION_ID`, 406, "The service was unable to create a unique transaction ID")
  },
  createWithdrawal: async function(user, amount) {
    let userModel = await User.query({ where: { id: user && user.id } }).fetch({ withRelated: "userSettings" })
    if (!userModel || !userModel.attributes.isValidated) {
      throw new JsonApiError(`E_USER_NOT_VALIDATE`, 400)
    }

    // Generate transaction Id if it was not supplied
    let transactionId = await strapi.services.transaction.generateTransactionId()
    amount = parseFloat(amount).toFixed(2)
    const walletId = userModel.attributes.walletID
    let payout
    try {
      payout = await moneyOut(walletId, amount, `Auszahlung faktoora Wallet-Guthaben`)
    } catch (err) {
      // console.log('err:', err)
      console.log("err.details", err.details)
      let isOver = false
      err.details &&
        err.details.map(e => {
          if (e.code === "E_SERVICE_LEMONWAY_110") isOver = true
        })
      if (isOver) {
        throw new JsonApiError(`E_BALANCE_NOT_ENOUGHT`, 400, `Der eingegebene Wert übersteigt das verfügbare Guthaben.`)
      } else {
        throw new JsonApiError(`E_ISSUE_PAYOUT`, 400, `Issued payout of ${amount}€ to buyer from wallet ${walletId}`)
      }
    }

    await Transaction.forge({
      paymentType: "WITHDRAWAL",
      paymentMethod: "bankTransfer",
      transactionId,
      amount,
      reference: payout.ID,
      state: "finished",
      benefactor: user.id
    })
      .save()
      .catch(err => {
        console.log("err:", err)
      })

    await Notification.forge({
      type: `moneyWithdrawal`,
      data: {
        amount
      },
      recipient: user.id,
      skipEmail: true
    }).save()

    return { amount: amount }
  },
  createDeposit: async function(user, amount) {
    let userModel = await User.query({ where: { id: user && user.id } }).fetch({ withRelated: "userSettings" })
    if (!userModel || !userModel.attributes.isValidated) {
      throw new JsonApiError(`E_USER_NOT_VALIDATE`, 400)
    }

    // Create transaction
    // Generate transaction Id if it was not supplied
    amount = parseFloat(amount).toFixed(2)
    let transactionId = await strapi.services.transaction.generateTransactionId()
    const walletId = userModel.attributes.walletID
    let userSettings = userModel.related("userSettings").models

    const mandateUserSetting = _.find(userSettings, item => {
      return item.attributes.key === "directDebitMandate"
    })

    if (!mandateUserSetting) {
      throw new JsonApiError(`E_USER_NOT_CONNECT_TO_WALLET`, 400, "Could not find user setting directDebitMandate")
    } else if (mandateUserSetting.attributes.value.confirmed !== true) {
      throw new JsonApiError(`E_USER_NOT_CONFIRM_WALLET`, 400, "The direct debit mandate has not been confirmed yet")
    } else if (!mandateUserSetting.attributes.value.documentId) {
      throw new JsonApiError(`E_USER_NOT_HAVE_DOCUMENT`, 400, "The user setting did not contain documentId")
    }

    let mandateId = mandateUserSetting.attributes.value.documentId

    let lemonWayResponse
    try {
      lemonWayResponse = await moneyInSddInit(walletId, transactionId, mandateId, amount)
    } catch (err) {
      console.log("err:", err)
      throw new JsonApiError(`E_ISSUE_PAYIN`, 400, "Error during creation of direct debit")
    }

    await Transaction.forge({
      paymentType: "DEPOSIT",
      paymentMethod: "directDebit",
      transactionId,
      amount,
      reference: lemonWayResponse.HPAY.ID,
      state: "pending",
      beneficiary: user.id
    })
      .save()
      .catch(err => {
        console.log("err:", err)
      })

    await Notification.forge({
      type: `moneyDeposit`,
      data: {
        amount
      },
      recipient: user.id,
      skipEmail: true
    }).save()

    return { amount: amount }
  },
  getTransactions: async function(ctx) {
    const user = ctx.session.passport.user
    let params = ctx.query
    // parsing param
    let parsedParams = {}
    _.keys(params).forEach(key => {
      _.set(parsedParams, key, params[key])
    })
    // Pagination
    let pageOptions = parsedParams.page || {}
    let page = parseInt(pageOptions.number, 10) || 1
    let pageSize = parseInt(pageOptions.size, 10) || 25
    // sorting
    if (parsedParams.sort && parsedParams.sort.indexOf(",") > 0) {
      parsedParams.sort = parsedParams.sort.split(",")
    } else {
      parsedParams.sort = parsedParams.sort ? [parsedParams.sort] : []
    }
    let sortItems = parsedParams.sort || []
    // filter
    let filterParams = parsedParams.filter

    // build query
    let transactionTable = strapi.models.transaction.collectionName
    let invoiceTable = strapi.models.invoice.collectionName
    let userTable = strapi.models.user.collectionName
    let queryModel = Transaction.query(function(qb) {
      let distinctFields = [`${transactionTable}.*`]
      if (!_.isEmpty(sortItems)) {
        sortItems.forEach(sortItem => {
          let sortOption = sortItem
            .replace("-", "")
            .replace("+", "")
            .replace(" ", "")
          if (sortOption.indexOf(".") >= 0) {
            // join field order
            distinctFields.push(sortOption)
          } else {
            distinctFields.push(`${transactionTable}.${sortOption}`)
          }
        })
      }
      qb.leftJoin(`${invoiceTable}`, `${transactionTable}.invoice`, `${invoiceTable}.id`)
      qb.leftJoin(`${userTable}`, `${invoiceTable}.owner`, `${userTable}.id`)

      let whereParams = (filterParams && filterParams.where) || {}
      let andWhereParams = (filterParams && filterParams.andwhere) || []
      andWhereParams = !_.isArray(andWhereParams) ? [andWhereParams] : andWhereParams
      let orWhereParams = filterParams && filterParams.orwhere
      if (_.isEmpty(andWhereParams) && _.isEmpty(orWhereParams)) {
        andWhereParams.push({ orwhere: whereParams })
      } else {
        andWhereParams.push({ orwhere: orWhereParams })
      }

      qb.distinct(distinctFields)
      if (_.isArray(andWhereParams)) {
        andWhereParams.map(andWhere => {
          if (andWhere.orwhere) {
            let subOrWhere = andWhere.orwhere
            qb.andWhere(function() {
              // process mutiple orWhere only
              if (_.isArray(subOrWhere)) {
                subOrWhere.map(orWhere => {
                  this.orWhere(function() {
                    builderQuery(this, _.assign({}, whereParams, orWhere), transactionTable)
                  })
                })
              } else {
                this.orWhere(function() {
                  builderQuery(this, _.assign({}, whereParams, subOrWhere), transactionTable)
                })
              }
            })
          }
        })
      }
      // debug
      // qb.debug(true)
    })

    // add sort
    !_.isEmpty(sortItems) &&
      sortItems.forEach(sortItem => {
        let _sort
        if (sortItem && sortItem.indexOf("-") === 0) {
          _sort = sortItem.slice(1)
        } else if (sortItem) {
          _sort = sortItem
        }
        const _order = sortItem && sortItem.indexOf("-") === 0 ? "DESC" : "ASC"
        queryModel = queryModel.orderBy(_sort, _order)
      })

    let transactionModel = await queryModel.fetchPage({
      pageSize: pageSize,
      page: page,
      withRelated: ["invoice", "benefactor", "beneficiary", "benefactorDebtor", "invoice.owner"]
    })

    return transactionModel
  }
}
