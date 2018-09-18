'use strict';

/**
 * Lifecycle callbacks for the `Debtor` model.
 */
 const JsonApiError = require('../../../utils/json-api-error')
 const co = require('co')
 const joi = require('joi')

module.exports = {

  // Before saving a value.
  // Fired before an `insert` or `update` query.
   beforeSave: (model, attrs, options) =>  {

     // Set name automatically for private persons
     if (!model.attributes.isCompany) {
       model.attributes.name = `${model.attributes.firstName} ${model.attributes.lastName}`
     }
   },
  // After creating a value.
  // Fired after `insert` query.
  afterCreate: async function(model, attrs, options) {
    const statisticModel = await Usersetting.where({
      user: model.attributes.user,
      key: "userStatistics"
    }).fetch({ withRelated: ["user"] })

    if (!statisticModel) {
      let value = {customerCount: 1}
      await Usersetting.forge({
        user: model.attributes.user,
        value: value,
        key: "userStatistics"
      }).save()
    } else {
      let value = statisticModel.attributes.value || {}
      value.customerCount = value.customerCount && (parseInt(value.customerCount) + 1) || 1
      await statisticModel.save({value: value}, {patch: true})
    }
  }
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
}
