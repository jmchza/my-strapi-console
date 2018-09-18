'use strict'
const worker = require('../../../utils/worker')
const common = require('../../../utils/common')

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
      model.attributes.faktooraId = await strapi.services.invoice.generateFaktooraId(null, 'FKT')
    }
    return model
  },
  /*
  afterCreate: async (model, attrs, options) => {
    const offer = await Settlement.forge({id: model.id}).fetch({
      withRelated: ['signature', 'owner']
    })
    let current = offer.toJSON()
    if (current) {
      if (current.owner && current.owner.companyLogo) {
        let uploadModel = await Upload.forge({id: current.owner.companyLogo}).fetch()
        current.owner.companyLogo = (uploadModel) ? uploadModel.attributes : null
      }
      // find userlogin
      let userloginModel = await Userlogin.forge({user: current.owner.id, isMain: true}).fetch()
      current.userlogin = (userloginModel) ? userloginModel.attributes : {}
      worker.generateLetter(Object.assign({type: 'settlement'}, current))
    }
  }*/
}
