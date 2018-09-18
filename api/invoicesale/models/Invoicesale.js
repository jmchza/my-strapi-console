"use strict"

const co = require("co")
const JsonApiError = require("../../../utils/json-api-error")
const common = require("../../../utils/common")
const path = require("path")

module.exports = {
  // Before saving a value.
  // Fired before an `insert` or `update` query.
  // beforeSave: (model, attrs, options) =>  {
  //   return new Promise();
  // },

  // After saving a value.
  // Fired after an `insert` or `update` query.
  // afterSave: async (model, response, options) => {

  // Nothing happens on insert because the invoice needs to be reviewed first
  // if (options.method === 'update' && options.previousAttributes.buyer && model.attributes.buyer !== null) {
  // }
  // newStatus = 'factored'
  // oldStatus = 'review'
  // } else if {

  // }
  // else if (mode.attributes.buyer)
  /* if (model.attributes.status !== model.previousAttributes.status) {
      await Statushistory.forge({
        reference_id: model.attributes.id,
        reference_type: 'invoice',
        oldStatus: model.previousAttributes.status || '',
        newStatus: model.attributes.status || ''
      }).save()
    } */
  // },

  // Before fetching a value.
  // Fired before a `fetch` operation.
  // beforeFetch: (model, columns, options) =>  {
  //   return new Promise();
  // },

  // After fetching a value.
  // Fired after a `fetch` operation.
  // afterFetch: (model, response, options) =>  {
  //  return new Promise();
  // },
  afterFetch: async function(model, attrs, options) {
    let { sendInvoice, highestBid, id, buyer } = model.attributes

    if (buyer) {
      model.attributes.highestBid = await Bid.forge({ bidder: buyer, invoicesale: id, amount: highestBid })
        .orderBy("amount", "DESC")
        .fetch()
    } else {
      model.attributes.highestBid = await Bid.forge({ invoicesale: id, amount: highestBid })
        .orderBy("amount", "DESC")
        .fetch()
    }
    return model
  },

  // Before creating a value.
  // Fired before `insert` query.
  /* beforeCreate: (model, attrs, options) =>  {
    console.log(model.attributes)
    return
  }, */

  // After creating a value.
  // Fired after `insert` query.
  // afterCreate: (model, attrs, options) =>  {
  //   return new Promise();
  // },
  beforeCreate: async function(model, attrs, options) {
    const invoiceModel = await Invoice.forge({ id: model.attributes.invoice }).fetch()
    if (invoiceModel === null) {
      throw new JsonApiError(`E_VALIDATION`, 400, `The invoice does not exist`)
    }
    const ownerModel = await User.forge({ id: invoiceModel.attributes.owner }).fetch()
    // Invoice does not exist
    if (ownerModel === null || !ownerModel.attributes.isValidated) {
      throw new JsonApiError(`E_VALIDATION_USER_NOT_ACTIVE`, 400, `The user is not active`)
    }
  },
  afterCreate: async function(model, attrs, options) {
    //
  },
  afterUpdate: async function(model, attrs, options) {
    const { subrogationLetter, assignmentAgreement } = model.attributes
    // The invoice has been sold
    if (options.previousAttributes.buyer === null && model.attributes.buyer !== null) {
      const invoice = await Invoice.forge({ id: model.attributes.invoice }).fetch()

      if (invoice.attributes.isSeed === false) {
        strapi.log.info(`SERVICE Calling createBuyerPayment`)
        await strapi.services.transaction.createBuyerPayment(model)
      } else {
        console.log(
          `Skipping creating a buyer payment because invoice ${invoice.attributes.faktooraId} is a seed invoice`
        )
      }
    }
    // send mail to user after subrogationLetter create
    const previousSubrogationLetter =
      options && options.previousAttributes && options.previousAttributes.subrogationLetter
    if (subrogationLetter && subrogationLetter !== previousSubrogationLetter) {
      // find invoice info
      let invoiceModel = await Invoice.forge({ id: model.attributes.invoice }).fetch()
      let { debtor, id, owner, invoiceNumber, status, invoiceFile } = invoiceModel.attributes
      // if (status === "sold") {
      let issueDate = common.formatDate(invoiceModel.attributes.issueDate, "DD.MM.YYYY")
      let soldDate = common.formatDate(invoiceModel.attributes.updated_at, "DD.MM.YYYY")
      let attachments = []
      // find attachment file on invoice
      let uploadInvoiceModel = await Upload.forge({ id: invoiceFile }).fetch()
      let invoiceFileObj = uploadInvoiceModel && uploadInvoiceModel.toJSON()
      const invoiceFilePatch =
        invoiceFileObj &&
        invoiceFileObj.filename &&
        invoiceFileObj.path &&
        path.join(strapi.config.environments[strapi.config.environment].uploadFolder, invoiceFileObj.path, invoiceFileObj.filename)
      if (invoiceFilePatch) {
        attachments.push({ path: invoiceFilePatch, filename: invoiceFileObj.filename })
      }
      // subrogationletter file
      let uploadModel = await Upload.forge({ id: subrogationLetter }).fetch()
      let subrogationFile = uploadModel && uploadModel.toJSON()
      const subrogationPatch =
        subrogationFile &&
        subrogationFile.filename &&
        subrogationFile.path &&
        path.join(strapi.config.environments[strapi.config.environment].uploadFolder, subrogationFile.path, subrogationFile.filename)
      if (subrogationPatch) {
        attachments.push({ path: subrogationPatch, filename: subrogationFile.filename })
      }
      // find owner
      let userModel = await User.forge({ id: owner }).fetch()
      let customerModel = await Customer.forge({ id: debtor }).fetch()
      await Email.forge({
        data: {
          subject: `app.notification.debtorSubrogation.summary`,
          content: `app.notification.debtorSubrogation.text`,
          debtorName: customerModel.attributes.name,
          sellerCompanyName: userModel.attributes.companyName,
          issueDate,
          soldDate,
          invoiceNumber
        },
        to: customerModel.attributes.email,
        attachments: JSON.stringify(attachments),
        template: "notification"
      }).save()
      //}
    }
    const previousAssignmentAgreementLetter =
      options && options.previousAttributes && options.previousAttributes.assignmentAgreement
    if (assignmentAgreement && assignmentAgreement !== previousAssignmentAgreementLetter) {
      // get invoice infor
      let invoiceModel = await Invoice.forge({ id: model.attributes.invoice }).fetch()
      // get seller
      let seller = await User.query(function(qb) {
        qb.innerJoin(`userlogin`, `userlogin.user`, `user.id`)
        qb.where(`user.id`, "=", invoiceModel.attributes.owner)
        qb.andWhere("userlogin.isMain", "=", true)
      }).fetch({
        columns: [
          "user.isSeller",
          "user.isBuyer",
          "user.companyName",
          "userlogin.email",
          "userlogin.firstName",
          "userlogin.lastName"
        ]
      })
      // get buyer
      let buyer = await User.query(function(qb) {
        qb.innerJoin(`userlogin`, `userlogin.user`, `user.id`)
        qb.where(`user.id`, "=", model.attributes.buyer)
        qb.andWhere("userlogin.isMain", "=", true)
      }).fetch({
        columns: [
          "user.isSeller",
          "user.isBuyer",
          "user.companyName",
          "userlogin.email",
          "userlogin.firstName",
          "userlogin.lastName"
        ]
      })
      // assignmentAgreement file
      let attachments = []
      let uploadModel = await Upload.forge({ id: assignmentAgreement }).fetch()
      let assignmentAgreementFile = uploadModel && uploadModel.toJSON()
      const assignmentAgreementPatch =
        assignmentAgreementFile &&
        assignmentAgreementFile.filename &&
        assignmentAgreementFile.path &&
        path.join(strapi.config.environments[strapi.config.environment].uploadFolder, assignmentAgreementFile.path, assignmentAgreementFile.filename)
      if (assignmentAgreementPatch) {
        attachments.push({ path: assignmentAgreementPatch, filename: assignmentAgreementFile.filename })
      }
      // send email to buyer
      await Email.forge({
        data: {
          subject: `app.notification.invoiceBought.summary`,
          content: `app.notification.invoiceBought.text1`,
          name: buyer.attributes.firstName,
          invoiceNumber: invoiceModel.attributes.invoiceNumber,
          faktooraId: invoiceModel.attributes.faktooraId,
          invoiceId: invoiceModel.attributes.id,
          amount: model.attributes.amount
        },
        to: buyer.attributes.email,
        from: strapi.config.environments[strapi.config.environment].senderDefault,
        attachments: JSON.stringify(attachments),
        template: "notification"
      }).save()
      // send email to seller
      await Email.forge({
        data: {
          subject: `app.notification.invoiceSold.summary`,
          content: `app.notification.invoiceSold.text`,
          invoiceNumber: invoiceModel.attributes.invoiceNumber,
          faktooraId: invoiceModel.attributes.faktooraId,
          invoiceId: invoiceModel.attributes.id,
          amount: model.attributes.amount,
          name: seller.attributes.firstName,
          buyerName: buyer.attributes.companyName
        },
        to: seller.attributes.email,
        from: strapi.config.environments[strapi.config.environment].senderDefault,
        attachments: JSON.stringify(attachments),
        template: "notification"
      }).save()
    }
  }
}
