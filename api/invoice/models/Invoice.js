const _ = require("lodash")
const JsonApiError = require("../../../utils/json-api-error")
const worker = require("../../../utils/worker")
const ua = require("universal-analytics")
const common = require("../../../utils/common")

module.exports = {
  afterFetchCollection: async function(model, attrs, options) {
    //
  },
  afterSave: async function(model, attrs, options) {
    try {
      // Create debtor transaction either when invoice has been created directly or when its status was updated from to draft to created
      if (
        ((model.attributes.status === "created" && options.method === "insert") ||
          (model.attributes.status === "created" &&
            options.method === "update" &&
            options.previousAttributes.status !== "created")) &&
        model.attributes.paymentControl === true
      ) {
        console.log("payment control?", model.attributes.paymentControl)
        // let invoice = await Invoice.forge({id: model.attributes.invoice}).fetch()
        const faktooraUserModel = await User.where({
          walletID: strapi.config.environments[strapi.config.environment].lemonway.faktooraWalletId
        }).fetch()
        // Create Faktoora transaction
        await Transaction.forge({
          paymentType: "DEBTOR_TO_FAKTOORA",
          paymentMethod: "bankTransfer",
          amount: model.attributes.outstandingBalance,
          state: "pending",
          invoice: model.id,
          beneficiary: faktooraUserModel.id,
          benefactorDebtor: model.attributes.debtor
        }).save()
      }

      //sync status for document
      if (options.previousAttributes.status !== model.attributes.status && model.attributes.faktooraId) {
        if (_.includes(["draft", "created", "sent"], model.attributes.status)) {
          await Document.where({ faktooraId: model.attributes.faktooraId })
            .save({ status: model.attributes.status }, { patch: true })
            .catch(err => {
              console.log("Err: No Rows Updated")
            })
        } else {
          await Document.where({ faktooraId: model.attributes.faktooraId, reference_type: "invoice" })
            .save({ status: model.attributes.status }, { patch: true })
            .catch(err => {
              console.log("Err: No Rows Updated")
            })
        }
      }
      // Add status change
      const previousStatus = _.get(options, "previousAttributes.status") || ""
      if (model.attributes.status !== previousStatus) {
        await Statushistory.forge({
          reference_id: model.attributes.id,
          reference_type: "invoice",
          oldStatus: previousStatus || "",
          newStatus: model.attributes.status || ""
        }).save()
      }
    } catch (err) {
      console.log(`Error in afterSave of Invoice`, err)
    }
  },
  beforeSave: async function(model, attrs, options) {
    try {
      // Determine status
      let { data } = model.attributes
      if (!data) data = {}
      let hasBids = false
      let bought = false
      let status = model.attributes.status

      if (options.method === "update") {
        const invoicesaleId = model.attributes.invoicesale
        if (invoicesaleId) {
          let invoicesaleModel = await Invoicesale.forge({ id: invoicesaleId }).fetch()
          hasBids = invoicesaleModel.attributes.highestBid !== null
          bought = invoicesaleModel.attributes.buyer !== null
        }
      }

      let statuses = {}

      switch (status) {
        case "draft":
        case "created":
        case "sent":
        case "review":
        case "rejected":
        case "paidCash":
          statuses = {
            seller: status
          }
          break
        case "available":
          statuses = {
            seller: hasBids ? "receivedBids" : "available",
            buyer: "available"
          }
          break
        case "sold":
          statuses = {
            seller: status,
            buyer: status
          }
          break
        case "paid":
          // Only show paid status to the buyer/seller
          statuses = {
            seller: bought ? "sold" : "paid"
          }
          if (bought) {
            statuses.buyer = "paid"
          }
          break
        case "aborted":
          statuses = {
            seller: status,
            buyer: "notAvailableAnymore"
          }
          break
        case "overdue":
          let reminderStatus = ""
          const reminders = data.reminders || []
          switch (reminders.length) {
            case 0:
              reminderStatus = "overdue"
              break
            case 1:
              reminderStatus = "firstReminder"
              break
            case 2:
              reminderStatus = "secondReminder"
              break
            case 3:
              reminderStatus = "thirdReminder"
              break
            default:
              console.log(`Unhandled case for reminders length ${reminders.length} in beforeSave of Invoice`)
              return
          }

          statuses = {
            seller: bought ? "sold" : reminderStatus
          }
          if (bought) {
            statuses.buyer = reminderStatus
          }
          break
        case "inkasso":
          statuses = {
            seller: bought ? "sold" : "inkasso"
          }
          if (bought) {
            statuses.buyer = "inkasso"
          }
          break
        default:
          console.log(`Unhandled case for status ${status} in beforeSave of Invoice. Aborting.`)
          return
      }
      attrs.data = Object.assign(data, { statuses })
    } catch (err) {
      console.log(`An exception occured in beforeSave of Invoice: ${err}`)
    }
  },
  beforeCreate: async function(model, attrs, options) {
    if (!model.attributes.faktooraId) {
      model.attributes.faktooraId = await strapi.services.invoice.generateFaktooraId()
    } else {
      let invoice = await Invoice.forge({
        faktooraId: model.attributes.faktooraId
      }).fetch()
      if (invoice) {
        throw new JsonApiError(`E_FAKTOORA_ID_EXISTS`, 406, "Faktoora ID already exists. Aborting invoice creation.")
      }
    }
  },
  afterCreate: async function(model, attrs, options) {
    try {
      let current = await Invoice.forge({ id: model.id }).fetch({
        withRelated: ["debtor", "owner", "signature"]
      })
      current = current.toJSON()
      const invoicePositions = _.get(current, "data.invoicePositions")

      // Create invoice file?
      if (
        (current &&
          !current.isSeed &&
          !current.invoicesale &&
          !_.isEmpty(invoicePositions) &&
          current.status === "created") ||
        current.status === "paidCash"
      ) {
        const invoiceCount = await Invoice.where("owner", current.owner.id).count()

        await Notification.forge({
          type: "createdInvoice",
          data: {
            invoiceCount,
            invoiceNumber: current.invoiceNumber,
            faktooraId: current.faktooraId
          },
          recipient: current.owner.id
        }).save()
      }

      // GA log create invoice
      let visitor = ua(strapi.config.environments[strapi.config.environment].gaId, `${current.owner.id}`)
      visitor.event("Invoice", "Invoice Created", "User created an invoice", err => {
        if (err) console.log("err:", err)
      })
    } catch (err) {
      console.log("Error in afterCreate of invoice", err)
    }
  },
  beforeUpdate: async function(model, attrs, options) {
    const preStatus = options && options.previousAttributes && options.previousAttributes.status
    if (preStatus === "paidCash" && preStatus !== model.attributes.status) {
      throw new JsonApiError(`E_NOT_ALLOW`, 400, "Do not allow change status of invoice paid cash")
    }
  },
  afterUpdate: async function(model, attrs, options) {
    const invoice = await Invoice.forge({ id: model.id }).fetch({
      withRelated: ["debtor", "owner", "signature"]
    })
    let current = invoice.toJSON()
    const invoicePositions = _.get(current, "data.invoicePositions")
    const invoiceFilePre = options && options.previousAttributes && options.previousAttributes.invoiceFile
    const preStatus = options && options.previousAttributes && options.previousAttributes.status

    if (
      current &&
      !current.isSeed &&
      !_.isEmpty(invoicePositions) &&
      current.invoiceFile === invoiceFilePre &&
      current.status === "created"
    ) {
      if (current.owner && current.owner.companyLogo) {
        let uploadModel = await Upload.forge({
          id: current.owner.companyLogo
        }).fetch()
        current.owner.companyLogo = uploadModel ? uploadModel.attributes : null
      }
      let bankAccountModel = await Bankaccount.forge({
        id: current.owner.primaryBankaccount || ""
      }).fetch()
      current.owner.primaryBankaccount = bankAccountModel ? bankAccountModel.attributes : {}
      if (!_.isEmpty(current.owner.primaryBankaccount) && current.owner.primaryBankaccount.iban) {
        let bicInfo = await strapi.services.bankaccount.getbic(
          { params: { iban: current.owner.primaryBankaccount.iban } },
          true
        )
        current.owner.primaryBankaccount.bankName = !_.isEmpty(bicInfo) ? bicInfo.description : ""
      }
      // find userlogin
      let userloginModel = await Userlogin.forge({
        user: current.owner.id,
        isMain: true
      }).fetch()
      current.userlogin = userloginModel ? userloginModel.attributes : {}
      // find transaction
      let transactionModel = await Transaction.forge({
        invoice: model.id,
        paymentType: "DEBTOR_TO_FAKTOORA"
      }).fetch()
      current.transaction = transactionModel ? transactionModel.attributes : {}
    }

    const invoiceSaleModel = await Invoicesale.forge({
      invoice: model.id
    }).fetch()
    let { buyer, subrogationLetter } = (invoiceSaleModel && invoiceSaleModel.attributes) || {}
    let { debtor, id, owner, invoiceNumber, status, faktooraId } = invoice.attributes
    const correlationId = model.id

    /* =============================================>>>>>
      = An invoice has been sold =
      ===============================================>>>>> */

    if (status === "sold" && preStatus === "available") {
      let { highestBid } = invoiceSaleModel.attributes
      let highestBidAmount = _.isObject(highestBid) ? highestBid.attributes.amount : highestBid
      // const bid = await Bid.where({invoicesale: invoiceSaleModel.id, amount: highestBidAmount}).fetch()
    } else if (status === "review" && preStatus !== status) {
      const linkToInvoice = `${strapi.config.environments[strapi.config.environment].frontendUrl}/invoice/details/${model.attributes.faktooraId}`

      const invoiceCount = await Invoice.query(qb => {
        qb.whereNotNull("invoicesale")
        qb.andWhere("owner", current.owner.id)
      }).count()
      await Notification.forge({
        type: "invoiceSetSaleConditions",
        data: {
          invoiceNumber,
          invoiceCount,
          linkToInvoice
        },
        invoice: `${invoice.id}`,
        recipient: owner,
        skipEmail: true
      }).save()

      // Send notification to admin to review invoice
      // TODO Having to catch this is very special behaviour
      // It should be encapsulated in a service

      // send email to user need to be review
      await Email.forge({
        data: {
          subject: `app.notification.invoiceNeedsReview.summary`,
          content: `app.notification.invoiceNeedsReview.text`,
          invoiceNumber,
          faktooraId,
          linkToInvoice,
          name: `faktoora team`,
          sellerName: current.owner.companyName,
          debtor: current.debtor,
          amount: common.formatCurrency(current.amount),
          dueDate: common.formatDate(current.lastPaymentDate)
        },
        template: "notification",
        to: strapi.config.environments[strapi.config.environment].adminEmail
      }).save()

      /*
      if (strapi.config.environments[strapi.config.environment].worker.sendEmails === true) {
        strapi.rabbitmq.sendToQueue('Email_Task', {
          taskType: 'emailNotification',
          subject: 'A new invoice has been create',
          html: `A new invoice has been created and needs to verified. Please review the invoice at <a href='${link}'>${link}</a> and then approve it.`,
          to: `info@faktoora.com`,
          from: strapi.config.environments[strapi.config.environment].senderDefault
        }, {
          correlationId
        }).then(() => {
          console.log(`Sent email notification queue for id ${correlationId}`)
        })
      } else {
        console.log('Skipped sending E-Mail due to application configuration')
      }
      */
    } else if (status === "available" && preStatus === "review") {
      let notification = {
        type: "invoicePublished",
        data: {
          invoiceNumber: invoiceNumber,
          faktooraId: invoice.attributes.faktooraId
        },
        invoice: invoice.id,
        actionUrl: `/invoice/details/${invoice.attributes.faktooraId}`,
        recipient: owner
      }
      await Notification.forge(notification).save()
    } else if (status === "rejected" && preStatus !== "rejected") {
      await Notification.forge({
        type: "invoiceRejected",
        data: {
          invoiceNumber: invoiceNumber,
          faktooraId: invoice.attributes.faktooraId
        },
        invoice: invoice.id,
        recipient: owner
      }).save()
    }
    if ((status === "sold" && preStatus !== status) || (status === "sold" && !subrogationLetter)) {
      console.log(`Creating subrogation letter for invoice ${invoice.id}`)
      // send a message to rabbitmq
      let customerModel = await Customer.query({
        where: { id: debtor }
      }).fetch()
      let userBidderModel = await User.query({ where: { id: buyer } }).fetch()
      let userSellerModel = await User.query({ where: { id: owner } }).fetch()
      const dataInvoice = _.extend(invoice.attributes, _.omit(invoiceSaleModel.attributes, ["id"]))
      // create subrogationLetter for customer
      await worker.generateSubrogationLetter(
        {
          taskType: "createInvoicePdf",
          invoice: dataInvoice,
          debtor: customerModel.attributes,
          seller: userSellerModel.attributes,
          buyer: userBidderModel.attributes
        },
        correlationId
      )
      // create subrogationLetter for seller & buyer
      await worker.generateAssignmentAgreementLetter(
        {
          taskType: "generateAssignmentAgreementLetter",
          invoice: dataInvoice,
          debtor: customerModel.attributes,
          seller: userSellerModel.attributes,
          buyer: userBidderModel.attributes
        },
        correlationId
      )
    }
  }
}
