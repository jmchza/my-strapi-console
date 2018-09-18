"use strict"

/**
 * Lifecycle callbacks for the `Notification` model.
 */
const uuid = require("node-uuid")
const _ = require("lodash")
const joi = require("joi")

/**
 * Replaces variables in str specified like this `{var1}` from hash
 */
const fmt = (str, hash) => {
  let string = str
  for (let key in hash) string = string.replace(new RegExp("\\{" + key + "\\}", "gm"), hash[key])
  return string
}

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
  beforeCreate: async function(model, attrs, options) {
    let { data, actionUrl, recipient, type, skipEmail, cc, attachments } = model.attributes

    // Make sure data is defined as its used later
    if (typeof data === "undefined") data = {}

    try {
      // Remove skipemail from attributes because it won't be persisted
      model.attributes = _.omit(model.attributes, ["skipEmail", "cc", "attachments", "template"])

      skipEmail = skipEmail || false
      const template = type === "registrationEasyComplete" && "confirmregistration" || type || "notification"

      // 1. Send notification via Socket.io
      // ----------------------------------
      io.to(recipient).emit("notification", {
        id: uuid.v4(),
        data,
        type,
        actionUrl
      })

      // 2. send email for notification
      let invoice = null
      if (model.attributes.invoice !== undefined) {
        invoice = await model.related("invoice").fetch()
      }

      if (invoice && invoice.attributes.isSeed) {
        // for test
        console.log(
          `Skipped sending E-Mail for invoice ${invoice.attributes.invoiceNumber} because it belongs to seed data`
        )
        return
      }

      // Don't send mail when it was skipped
      if (skipEmail === true) {
        console.log(`Skipped sending E-Mail for notification ${type} because skipEmail was set`)
        return
      }

      let recipientModel
      const schema = joi.object().keys({
        recipientId: joi
          .string()
          .required()
          .guid()
      })

      const isUser = joi.validate({ recipientId: recipient }, schema, { allowUnknown: true })
      if (isUser.error === null) {
        recipientModel = await User.query(function(qb) {
          qb.innerJoin(`userlogin`, `userlogin.user`, `user.id`)
          qb.where(`user.id`, "=", recipient)
          qb.andWhere("userlogin.isMain", "=", true)
        }).fetch({
          columns: ["user.isSeller", "user.isBuyer", "userlogin.email", "userlogin.firstName", "userlogin.lastName"]
        })
      } else {
        model.attributes.recipient = null
        // E-Mail-Adress was probided
        recipientModel = {
          id: "NOUSER",
          attributes: {
            isBuyer: false,
            isSeller: false,
            recipient, // TODO Check whether this has any impact whatsoever
            email: recipient
          }
        }
      }

      let summary = `app.notification.${type}.summary`
      let text = `app.notification.${type}.text`
      let subject = summary
      data.subject = data.subject || subject
      data.content = data.content || text
      data.name = recipientModel.attributes.firstName || data.name || ""
      data.isBuyer = recipientModel.attributes.isBuyer
      data.isSeller = recipientModel.attributes.isSeller
      data.type = type

      let emailModel = await Email.forge({
        template,
        data,
        to: recipientModel.attributes.email,
        cc,
        from: strapi.config.environments[strapi.config.environment].senderDefault
      }).save()

      // 2. Send notification via mail
      // -----------------------------

      /*
      if (strapi.config.environments[strapi.config.environment].worker.sendEmails === false) {
        strapi.log.info(`afterCreate Notification Skipped sending E-Mail due to application configuration`)
        return
      } */

      // Don't send mails for seed data
      /*
      let invoice = null
      if (model.attributes.invoice !== undefined) {
        invoice = await model.related("invoice").fetch()
      }

      if (invoice && invoice.attributes.isSeed) {
        // for test
        console.log(
          `Skipped sending E-Mail for invoice ${invoice.attributes.invoiceNumber} because it belongs to seed data`
        )
        return
      }

      // Don't send mail when it was skipped
      if (skipEmail === true) {
        console.log(`Skipped sending E-Mail for notification ${type} because skipEmail was set`)
        return
      }
      let recipientModel
      const schema = joi.object().keys({
        recipientId: joi
          .string()
          .required()
          .guid()
      })

      const isUser = joi.validate({ recipientId: recipient }, schema, { allowUnknown: true })
      if (isUser.error === null) {
        recipientModel = await User.query(function(qb) {
          qb.innerJoin(`userlogin`, `userlogin.user`, `user.id`)
          qb.where(`user.id`, "=", recipient)
          qb.andWhere("userlogin.isMain", "=", true)
        }).fetch({
          columns: ["user.isSeller", "user.isBuyer", "userlogin.email", "userlogin.firstName", "userlogin.lastName"]
        })
      } else {
        model.attributes.recipient = null
        // E-Mail-Adress was probided
        recipientModel = {
          id: "NOUSER",
          attributes: {
            isBuyer: false,
            isSeller: false,
            recipient, // TODO Check whether this has any impact whatsoever
            email: recipient
          }
        }
      }
      if (attachments !== undefined) {
        console.log(`Found attachments ${attachments}`)
      }

      if (recipientModel && strapi.rabbitmq) {
        // default translation key should be according to notification type
        const name = recipientModel.attributes.firstName || data.name || ""
        let summary = `app.notification.${type}.summary`
        let text = `app.notification.${type}.text`
        let subject = strapi.i18n.__(`app.notification.${type}.subject`)
        if (strapi.i18n) {
          summary = fmt(strapi.i18n.__(summary), data)
          text = fmt(strapi.i18n.__(text), data)
          // Use summary as E-Mail subject if it was specified
          subject = subject === `app.notification.${type}.subject` ? summary : (subject = fmt(subject, data))
        }

        data.subject = data.subject || subject
        data.content = text

        // Remove this as soon as possible (check the else clause whether data is sufficient)
        if (template === "notification") {
          strapi.rabbitmq
            .sendToQueue(
              "Email_Task",
              {
                taskType: "emailNotification",
                template,
                data: {
                  subject,
                  content: text,
                  name,
                  isBuyer: recipientModel.attributes.isBuyer,
                  isSeller: recipientModel.attributes.isSeller
                },
                to: recipientModel.attributes.email,
                cc,
                from: strapi.config.environments[strapi.config.environment].senderDefault,
                attachments
              },
              {}
            )
            .then(() => {
              console.log(`Sent email notification queue for id ${recipientModel.id}`)
            })
        } else {
          strapi.rabbitmq
            .sendToQueue(
              "Email_Task",
              {
                taskType: "emailNotification",
                template,
                data,
                to: recipientModel.attributes.email,
                cc,
                from: strapi.config.environments[strapi.config.environment].senderDefault,
                attachments
              },
              {}
            )
            .then(() => {
              console.log(`Sent email notification queue for id ${recipientModel.id}`)
            })
        }
      }
    */
    } catch (err) {
      console.log("Error in beforeCreate of Notification", err)
    }

    return model
  },

  // After creating a value.
  // Fired after `insert` query.
  afterCreate: async function(model, attrs, options) {}

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
