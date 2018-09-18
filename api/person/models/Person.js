'use strict'

/**
 * Lifecycle callbacks for the `Debtor` model.
 */
const JsonApiError = require('../../../utils/json-api-error')
// const co = require('co')
const joi = require('joi')

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
  beforeSave: (model) => {
    const schema = joi.object().keys({
      'name': joi.string().required(),
      'gender': joi.string().required(),
      'phoneNo': joi.string().required(),
      'email': joi.string().required().email(),
      'note': joi.string()
    })

    const result = joi.validate(model.attributes, schema, {allowUnknown: true, abortEarly: false})

    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => { return { message: el.message } })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }

    return model
  }

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
