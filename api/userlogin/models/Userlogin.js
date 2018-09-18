"use strict"
const _ = require("lodash")

/**
 * Lifecycle callbacks for the `Userlogin` model.
 */

module.exports = {
  // validatePassword: ()

  // Before saving a value.
  // Fired before an `insert` or `update` query.
  beforeSave: (model, attrs, options) => {
    // return new Promise();
    let oldPasswordHash = (model._previousAttributes && model._previousAttributes.passwordHash) || ""
    let newPwd = model.attributes.passwordHash || ""
    if (model.attributes.email && _.isString(model.attributes.email)) {
      model.attributes.email = model.attributes.email.toLowerCase()
    }
    if (newPwd && oldPasswordHash !== newPwd) {
      return strapi.services.userlogin.hashPassword(newPwd).then(passwordHash => {
        model.attributes.passwordHash = passwordHash
      })
    }
    return model
  },

  // After saving a value.
  // Fired after an `insert` or `update` query.
  // afterSave: (model, response, options) => {
  //   return new Promise();
  // },

  // Before fetching a value.
  // Fired before a `fetch` operation.
  // beforeFetch: (model, columns, options) => {
  //   return new Promise();
  // },

  // After fetching a value.
  // Fired after a `fetch` operation.
  // afterFetch: (model, response, options) => {
  //   return new Promise();
  // },

  // Before creating a value.
  // Fired before `insert` query.
  // beforeCreate: (model, attrs, options) => {
  //   return new Promise();
  // },

  // After creating a value.
  // Fired after `insert` query.
  // afterCreate: (model, attrs, options) => {
  //   return new Promise();
  // },
  afterCreate: async function(model, attrs, options) {
    let correlationId = model.id

    // All seed userlogins use the mail address @test.com
    // TODO Are test accounts still excluded after the changes to the notification system
    if (model.attributes.email.includes("@test.com") || model.attributes.email === "info@faktoora.com") {
      console.log(`Skipped sending registration E-mail because ${model.attributes.email} is a seed account`)
      return
    }
  }

  // Before updating a value.
  // Fired before an `update` query.
  // beforeUpdate: (model, attrs, options) => {
  //   return new Promise();
  // },

  // After updating a value.
  // Fired after an `update` query.
  // afterUpdate: (model, attrs, options) => {
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
