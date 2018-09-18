"use strict"
const worker = require("../../../utils/worker")
const common = require("../../../utils/common")
const _ = require("lodash")
/**
 * Lifecycle callbacks for the `Settings` model.
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
  // beforeCreate: (model, attrs, options) =>  {
  //   return new Promise();
  // },

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
  beforeCreate: async (model, attrs, options) => {
    if (!model.attributes.faktooraId) {
      model.attributes.faktooraId = common.generateFaktooraId()
    }
    return model
  },
  // afterCreate: async (model, attrs, options) => {}
  afterSave: async (model, response, options) => {
    // Update status of document
    if (model.attributes.status) {
      let letter = await Letter.forge({ id: model.id }).fetch()
      // only update status by faktooraId if user not reminder
      if (letter.attributes.category !== "reminder") {
        await Document.query(qb => {
          qb.where("faktooraId", letter.attributes.faktooraId)
          qb.andWhere("documentType", "<>", "reminder")
        })
          .save({ status: model.attributes.status }, { patch: true })
          .catch(() => {
            console.log("Err: No Rows Updated")
          })
      } else {
        await Document.where({ reference_id: letter.id, reference_type: "letter" })
          .save({ status: model.attributes.status }, { patch: true })
          .catch(() => {
            console.log("Err: No Rows Updated")
          })
      }
    }

    // Create upload if necessary
    if (
      model.attributes.status === "created" &&
      _.get(options, "previousAttributes.status") !== model.attributes.status
    ) {
      const letter = await Letter.forge({ id: model.id }).fetch({
        withRelated: ["customer", "user.legalform", "signature"]
      })
      let current = letter.toJSON()
      if (current) {
        if (current.user && current.user.companyLogo) {
          let uploadModel = await Upload.forge({ id: current.user.companyLogo }).fetch()
          current.user.companyLogo = uploadModel ? uploadModel.attributes : null
        }
        // find primary bankAccount
        if (current.user && current.user.primaryBankaccount) {
          let primaryBankaccountModel = await Bankaccount.forge({ id: current.user.primaryBankaccount }).fetch()
          current.user.primaryBankaccount = primaryBankaccountModel ? primaryBankaccountModel.attributes : null
        }
        // find userlogin
        let userloginModel = await Userlogin.forge({ user: current.user.id, isMain: true }).fetch()
        current.userlogin = userloginModel ? userloginModel.attributes : {}
        current.type = "letter"
        if (current.category === "reminder" && current.invoice) {
          let invoice = await Invoice.forge({ id: current.invoice }).fetch({
            withRelated: ["letters", "owner.companyLogo", "debtor"]
          })
          current.invoice = invoice.toJSON()
          current.invoice.signature = current.signature
        }
        //get document config
        let usersettingModel = await Usersetting.forge({ user: current.user.id, key: "documentConfig" }).fetch()
        if (usersettingModel) {
          current.documentSetting = usersettingModel.attributes.value || {
            footer: common.getDefaultFooterFieldTemplate(current.user.legalform.key)
          }
        } else {
          current.documentSetting = { footer: common.getDefaultFooterFieldTemplate(current.user.legalform.key) }
        }
        current.documentSetting.footer = common.bindingDataForFooter(current.documentSetting.footer, {
          user: current.owner || current.user,
          userlogin: current.userlogin,
          primaryBankaccount: current.user.primaryBankaccount || {}
        })
        await worker.generateLetter(current)
      }
    }

    return model
  },
  beforeDestroy: async (model, attrs, options) => {
    // remove all document
    let promise = []
    if (model.id) {
      let documentModel = await Document.where({ reference_type: "letter", reference_id: model.id }).fetch()
      documentModel && promise.push(documentModel.destroy())
      await promise
    }

    return model
  }
}
