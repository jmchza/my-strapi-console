"use strict"

const IBAN = require("iban")
const JsonApiError = require("../../../utils/json-api-error")
const RESTClient = require("../../../utils/RESTClient")
const IBAN_SERVICE_URL = "https://fintechtoolbox.com/bankcodes/[code].json"

/**
 * Lifecycle callbacks for the `Bankaccount` model.
 */

module.exports = {
  // Before saving a value.
  // Fired before an `insert` or `update` query.
  beforeSave: async (model, attrs, options) => {
    const ibanWithoutSpace = model.attributes.iban.replace(/ /g, "")
    const ibanValid = IBAN.isValid(ibanWithoutSpace)

    if (!ibanValid) {
      throw new JsonApiError("E_IBAN_INVALID", 400, `IBAN ${model.attributes.iban} is invalid`)
    }
    let bankCode = ibanWithoutSpace.substring(4, 12)
    let result = await RESTClient.get(IBAN_SERVICE_URL.replace("[code]", bankCode))
    if (result && result.bank_code && result.bank_code.bic && result.bank_code.bank_name) {
      model.attributes.bankName = result.bank_code.bank_name
    } else {
      model.attributes.bankName = null
    }
    return model
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
