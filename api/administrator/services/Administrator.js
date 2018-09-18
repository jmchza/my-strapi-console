"use strict"

const { getWalletDetails } = require("../../../utils/lemonway")
const JsonApiError = require("../../../utils/json-api-error")
const joi = require("joi")
const _ = require("lodash")
const uuid = require("node-uuid")
const maxSendmailItem = 20

module.exports = {
  getTransactions: async function(ctx) {
    let queryModel = global["Transaction"].forge()

    const userId = ctx.params.id

    if (userId.length !== 36) {
      return "-"
    }

    // Keep this in case we want to filter for ALL user
    // if (searchterm !== null) {
    queryModel.query(qb => {
      qb.where("benefactor", "=", userId).orWhere("beneficiary", "=", userId)
    })
    // }

    const queryResult = await queryModel.fetchAll({
      withRelated: ["benefactor", "beneficiary", "invoice", "benefactorDebtor"]
    })

    let user = await global["User"].forge({ id: userId }).fetch({
      withRelated: ["primaryBankaccount"]
    })
    user = user.toJSON()

    let walletBalance = 0
    if (user.walletID !== null) {
      try {
        const walletDetails = await getWalletDetails(user.walletID, null)
        walletBalance = walletDetails.BAL
      } catch (err) {
        console.log(`LemonWay error during retrieval of wallet details for ${user.walletID}`)
      }
    }

    const result = {
      data: queryResult.models,
      user,
      balance: walletBalance
    }

    return result
  },
  acceptDunningContract: async function(ctx) {
    const userId = ctx.params.userid
    const schema = joi.object().keys({
      userid: joi
        .string()
        .required()
        .guid()
    })
    const { taskId } = ctx.request.body || {}
    const result = joi.validate(ctx.params, schema, { allowUnknown: false })
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    // find usersetting
    let usersettingModel = await Usersetting.forge({ user: userId, key: "dunningContract" }).fetch()
    if (!usersettingModel) {
      throw new JsonApiError(`E_NOT_HAVE_DUNNING_CONTRACT`, 400, "You don't have any contract submit")
    }
    let usersetting = usersettingModel.toJSON()
    // show error if user already confirmed dunning contract
    if (!_.isEmpty(usersetting.value) && usersetting.value.confirmed) {
      throw new JsonApiError(`E_DUNNING_CONTRACT_ALREADY_CONFIRMED`, 400, "Dunning contract has already been confirmed")
    }
    // get user info
    let userModel = await User.forge({ id: userId }).fetch()
    // confirm dunning contract
    let value = usersetting.value
    value.confirmed = true
    await usersettingModel.save({ value: value }, { patch: true })
    // update support task
    await Supporttask.forge({ id: taskId }).save({ status: "closed" }, { patch: true })
    // send notification to user
    await Notification.forge({
      type: "dunningContractAccepted",
      data: {},
      recipient: userId
    }).save()
    return { user: userModel || userModel.toJSON() || {} }
  },
  rejectDunningContract: async function(ctx) {
    const userId = ctx.params.userid
    const schema = joi.object().keys({
      userid: joi
        .string()
        .required()
        .guid()
    })
    const { taskId, message } = ctx.request.body || {}
    // const {isSendMail} = ctx.query || {}
    const result = joi.validate(ctx.params, schema, { allowUnknown: false })
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    // find usersetting
    let usersettingModel = await Usersetting.forge({ user: userId, key: "dunningContract" }).fetch()
    if (!usersettingModel) {
      throw new JsonApiError(`E_NOT_HAVE_DUNNING_CONTRACT`, 400, "You don't have any contract submit")
    }

    // update support task
    await Supporttask.forge({ id: taskId }).save({ status: "closed" }, { patch: true })
    // send mail to main user login
    let recipientModel = await Userlogin.where({ user: userId, isMain: true }).fetch()
    await Email.forge({
      data: {
        subject: `Ihr Inkassovertrag wurde abgelehnt`,
        content: message,
        name: recipientModel.attributes.firstName
      },
      template: "notification",
      cc: recipientModel.attributes.email
    }).save()
    /*
    // send notification to user
    await Notification.forge({
      type: "dunningContractRejected",
      data: {},
      recipient: userId
    }).save()
    */
    // get user info
    let userModel = await User.forge({ id: userId }).fetch()
    return { user: userModel || userModel.toJSON() || {} }
  },
  editUserDetail: async function(ctx) {
    const id = ctx.params.id
    const { user, bank, userlogin } = ctx.request.body
    const userEdit = await User.forge({ id }).fetch()
    if (!userEdit) {
      throw new JsonApiError(`E_NOT_EXITS`, 400, "User do not exits")
    }
    if (user) {
      await userEdit.save(user, { patch: true })
    }
    if (bank && userEdit.attributes.primaryBankaccount) {
      await Bankaccount.forge({ id: userEdit.attributes.primaryBankaccount }).save(bank, { patch: true })
    }
    if (userlogin && userlogin.id) {
      await Userlogin.forge({ id: userlogin.id }).save(userlogin, { patch: true })
    }
    return {}
  },
  sendNewsletter: async function(ctx) {
    const body = ctx.request.body
    let { isTest } = ctx.query || {}
    isTest = isTest === "true"
    const schema = joi.object().keys({
      subject: joi.string().required(),
      content: joi.string().allow("")
    })
    let values = body
    const result = joi.validate(values, schema, {
      allowUnknown: false,
      abortEarly: false
    })

    const clearValues = result.value
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })

      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }

    let email = { data: {} }
    email.data.subject = clearValues.subject
    email.data.content = clearValues.content
    let emailList = []
    let emailArrList = []
    if (isTest) {
      email.to = "steffen.garbisch@storyxag.com"
      emailList.push(email.to)
      emailArrList.push(emailList)
    } else {
      // find all seller
      let usersModel = await Userlogin.query(qb => {
        qb.select("userlogin.email")
        qb.innerJoin(`user`, `user.id`, `userlogin.user`)
        qb.where("isMain", true)
        qb.andWhere("isSeller", true)
        qb.andWhere("isBlocked", false)
      }).fetchAll()
      let users = usersModel && usersModel.toJSON()

      // Create batches to send to 20 recipients at a time
      for (let idx in users) {
        emailList.push(users[idx].email)
        if (emailList.length >= maxSendmailItem) {
          emailArrList.push(emailList)
          emailList = []
        }
      }
    }
    email.id = uuid.v4()
    email.template = "default"

    email.from = "faktoora GmbH<test@faktoora.com>"
    for (let idx in emailArrList) {
      email.bcc = emailArrList[idx] || []
      email.to = []
      if (strapi.config.environments[strapi.config.environment].bccEmail) {
        email.bcc.push(strapi.config.environments[strapi.config.environment].bccEmail)
      }
      console.log({ emails: emailArrList[idx] })
      console.log(`Sending newsletter to ${email.bcc.length} recipients`)
      if (strapi.config.environments[strapi.config.environment].worker.sendEmails) {
        if (strapi.rabbitmq) {
          await strapi.rabbitmq
            .sendToQueue("Email_Task", email)
            .then(result => {
              console.log("Success sent email id: ", email.id)
            })
            .catch(err => {
              console.log("error", err)
            })
        } else {
          console.log("Did not send E-Mail because of rabbitmq error", strapi.rabbitmq)
        }
      } else {
        strapi.log.info(`Skipped sending E-Mail due to application configuration`)
        return
      }
    }

    return {}
  },
  /**
   *
   */
  retrieveFaktooraStats: async function(ctx) {
    //const users = await User.fetchAll()
    //const invoices = await Invoice.fetchAll()

    let stats = {}

    // 1. Determine registrations
    //
    const users = await User.query(qb => {
      qb.select(
        strapi.connections.default.raw('date_trunc(\'day\', "created_at") AS "date" , count(*) AS "value"')
      )
      qb.groupBy(strapi.connections.default.raw(1))
      qb.orderBy(strapi.connections.default.raw(1))
    }).fetchAll()

    const userJson = users.toJSON()

    // 2. Determine created invoices
    //
    const invoices = await Invoice.query(qb => {
      qb.select(
        strapi.connections.default.raw('date_trunc(\'day\', "created_at") AS "date" , count(*) AS "value"')
      )
      qb.groupBy(strapi.connections.default.raw(1))
      qb.orderBy(strapi.connections.default.raw(1))
    }).fetchAll()

    const invoiceJson = invoices.toJSON()

    return {
      registeredUsers: userJson,
      createdInvoices: invoiceJson
    }

    /*const mappedUsers = userJson.map(item => {
      return { timestamp: +new Date(item.date), registrations: item.registrations }
    })*/

    /*
    const groupedResults = _(userJson)
      .groupBy("date")
      .map(item => {
        return {
          date: moment(item["date"])
            .startOf("isoWeek")
            .toString(),
          registrations: _.sumBy(item, "registrations")
        }
      })
      .value()

    return groupedResults*/
  }
}
