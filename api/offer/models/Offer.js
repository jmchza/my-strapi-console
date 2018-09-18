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
  // afterCreate: async (model, attrs, options) => {},
  afterSave: async (model, response, options) => {
    //sync status for document
    if (model.attributes.status) {
      let offer = await Offer.forge({ id: model.id }).fetch()
      if (_.includes(["draft", "created", "sent"], model.attributes.status)) {
        await Document.where({ faktooraId: offer.attributes.faktooraId })
          .save({ status: model.attributes.status }, { patch: true })
          .catch(err => {
            console.log("Err: No Rows Updated")
          })
      } else {
        await Document.where({ faktooraId: offer.attributes.faktooraId, reference_type: "offer" })
          .save({ status: model.attributes.status }, { patch: true })
          .catch(err => {
            console.log("Err: No Rows Updated")
          })
      }
    }

    return model
  },
  beforeDestroy: async (model, attrs, options) => {
    // delete the merge file
    let promise = []
    if (model.id) {
      /*
      // with draft we don't have merge file so I disabled it
      const filename = `FILE_${model.attributes.id}_FULL.pdf`
      const offer = await Offer.forge({id: model.id}).fetch({
        withRelated: ['customer', 'owner']
      })
      let current = offer.toJSON()
      promise.push(Upload.where({filename, user: current.owner.id}).destroy())
      */
      // delete all the cover letter with the same faktooraId
      let letterModel = await Letter.where({ category: "letter", faktooraId: model.attributes.faktooraId }).fetch()
      promise.push(letterModel.destroy())
      await promise
    }
    return model
  }
}
