"use strict"

/**
 * Lifecycle callbacks for the `User` model.
 */
const Chance = require("chance")
const chance = new Chance()
const { beneficialAvailable, getTasks } = require("../../../utils/lemonway")

module.exports = {
  // Before saving a value.
  // Fired before an `insert` or `update` query.
  // beforeSave: (model, attrs, options) =>  {
  //   return new Promise();
  // },

  // After saving a value.
  // Fired after an `insert` or `update` query.
  afterSave: async (model, response, options) => {
    // Add status change
    // 1. one = method insert
    /* if (options.method === 'insert') {
      const oldStatus = ''
      const userId = options.attributes.id
      await Statushistory.forge({
        reference_id: userId,
        reference_type: 'user',
        oldStatus: '',
        newStatus: 'easy'
      })
    } */
  },

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
  afterCreate: async (model, attrs, options) => {
    const legalformModel = await Legalform.query({
      where: { id: model.attributes.legalform }
    }).fetch()
    let taskSetting = { key: "identificationData", value: {} }
    const tasks = getTasks(legalformModel.attributes.key)
    taskSetting.value.tasks = tasks.slice()
    taskSetting.value.beneficials = beneficialAvailable(legalformModel.attributes.key) ? [] : false
    await model.userSettings().create(taskSetting)
  },
  // beforeUpdate: async function(model, attrs, options) {},
  // After updating a value.
  // Fired after an `update` query.
  // afterUpdate: (model, attrs, options) =>  {
  //   return new Promise();
  // },
  // afterCreate: async function (model, attrs, options) {},
  afterUpdate: async function(model, attrs, options) {
    let { isValidated, isBlocked, hasValidDirectDebitMandate } = model.attributes
    let summary, text, actionText, actionUrl, type

    let userModel = await User.forge({ id: model.id }).fetch({ withRelated: ["primaryBankaccount"] })

    // User became validated
    // TODO dirty workaround
    if (isValidated === "true") {
      isValidated = true
    }

    if (hasValidDirectDebitMandate === "true") {
      hasValidDirectDebitMandate = true
    }
    if (isValidated === true && options.previousAttributes.isValidated === false) {
      let { isBuyer, isSeller } = userModel.attributes

      // User registered as buyer
      if (isBuyer) {
        type = "validatedBuyer"
        actionUrl = `${strapi.config.environments[strapi.config.environment].frontendUrl}/home`
        // User registered as seller
      } else if (isSeller) {
        type = "validatedSeller"
        actionUrl = `${strapi.config.environments[strapi.config.environment].frontendUrl}/invoice/create`
      }

      await Notification.forge({
        type,
        actionUrl,
        recipient: model.id
      }).save()
    }

    if (hasValidDirectDebitMandate === true && options.previousAttributes.hasValidDirectDebitMandate === false) {
      await strapi.services.transaction.payMonthlyBuyerFee(userModel)
    }

    // User has been blocked for too many attempts to login
    if (isBlocked === "true") {
      isBlocked = true
    }
    if (isBlocked && options.previousAttributes.isBlocked === false) {
      let expireDate = new Date(Date.now() + 2 * 86400000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ") // 86400000 = 1 days
      let token = chance.hash({ length: 32 })
      let userLoginModel = await Userlogin.query({ where: { user: model.id } }).fetch()
      await userLoginModel.save({ resetToken: token, resetTokenExpires: expireDate }, { path: true })
      // find userlogin info
      let recipientModel = await User.query(function(qb) {
        qb.innerJoin(`userlogin`, `userlogin.user`, `user.id`)
        qb.where(`user.id`, "=", userModel.id)
        qb.andWhere("userlogin.isMain", "=", true)
      }).fetch({
        columns: ["user.isSeller", "user.isBuyer", "userlogin.email", "userlogin.firstName", "userlogin.lastName"]
      })
      // Send E-Mail with reset link
      await Email.forge({
        data: {
          subject: `app.notification.${`userBlockedTooManyLoginAttempts`}.summary`,
          content: `app.notification.${`userBlockedTooManyLoginAttempts`}.text`,
          name: recipientModel.attributes.firstName,
          linkPasswordReset: `${strapi.config.environments[strapi.config.environment].frontendUrl}/reset/${token}`
        },
        template: "notification",
        to: recipientModel.attributes.email
      }).save()
    }
  }
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
