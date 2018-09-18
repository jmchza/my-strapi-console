"use strict"
const _ = require("lodash")
const common = require("../../../utils/common")
/**
 * Lifecycle callbacks for the `Email` model.
 */

module.exports = {
  // Before saving a value.
  // Fired before an `insert` or `update` query.
  // beforeSave: (model, attrs, options) => {
  //   return new Promise();
  // },

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
  afterCreate: (model, attrs, options) => {
    return new Promise((resolve, reject) => {
      // Create E-Mail sending task
      let email = model.attributes
      // default translation key should be according to notification type
      let content = (email.data && email.data.content) || ""
      let subject = email.subject || (email.data && email.data.subject) || ""

      // Exchanging app.notification.{type}.text with app.notification.{type}.mailText if it exists
      if (content.startsWith("app.notification")) {
        // The substituted value will be contained in the result variable
        const result = content.replace(/(app.notification.\w*.)(\w*)/g, `$1mailText`)

        console.log("Substitution result: ", result)
        console.log(`Checking whether there is mailText for ${content}`)

        const mailText = strapi.i18n.__(result)
        if (!mailText.startsWith("app.notification")) {
          console.log("Replacing content with mailText", mailText)
          content = mailText
        }
        if (strapi.i18n) {
          content = (content && common.fmt(strapi.i18n.__(content), email.data)) || ""
        }
      }

      if (subject.startsWith("app.notification") && strapi.i18n) {
        subject = (subject && common.fmt(strapi.i18n.__(subject), email.data)) || ""
      }

      email.data.subject = subject
      email.data.content = content
      email.template = email.template || "notification"
      if (strapi.config.environments[strapi.config.environment].bccEmail) {
        if (_.isArray(email.bcc)) {
          email.bcc.push(strapi.config.environments[strapi.config.environment].bccEmail)
        } else {
          email.bcc = strapi.config.environments[strapi.config.environment].bccEmail
        }
      }
      if (strapi.config.environments[strapi.config.environment].worker.sendEmails) {
        if (strapi.rabbitmq) {
          strapi.rabbitmq
            .sendToQueue("Email_Task", email)
            .then(result => {
              console.log("Success sent email id: ", email.id)
              resolve(result)
            })
            .catch(err => {
              console.log("error", err)
              reject(err)
            })
        } else {
          console.log("Did not send E-Mail because of rabbitmq error", strapi.rabbitmq)
          reject()
        }
      } else {
        strapi.log.info(`afterCreate Notification Skipped sending E-Mail due to application configuration`)
        resolve()
        return model
      }

      return model
    })
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
