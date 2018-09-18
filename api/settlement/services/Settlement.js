const joi = require("joi")
const _stripe = require("stripe")
const JsonApiError = require("../../../utils/json-api-error")

module.exports = {
  addPaymentMethod: async function(ctx) {
    const stripeConfig = strapi.config.environments[strapi.config.environment].stripe
    const stripe = _stripe(stripeConfig.apiKey)

    const userId = ctx.session.passport.user.id
    const userEmail = ctx.session.passport.user.email

    const values = ctx.request.body
    const schema = joi.object().keys({
      type: joi.string().required(),
      sourceId: joi.string().required(),
      source: joi.object().required()
    })

    const result = joi.validate(values, schema, { allowUnknown: false })
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    let clearValues = result.value
    console.log(clearValues)

    // 1. Save source to usersetting and create stripe customer
    const paymentSourcesModel = await Usersetting.where({
      user: userId,
      key: "paymentSources"
    }).fetch({ withRelated: ["user"] })

    const newSource = Object.assign({ id: clearValues.sourceId, type: clearValues.type }, clearValues.source)

    // Create new usersetting for payment source
    if (!paymentSourcesModel) {
      // Stripe: Create customer
      const newCustomer = await stripe.customers.create({
        email: userEmail,
        source: clearValues.sourceId
      })

      await Usersetting.forge({
        user: userId,
        value: {
          defaultSource: clearValues.sourceId,
          sources: [newSource],
          customerId: newCustomer.id
        },
        key: "paymentSources"
      }).save()
    } else {
      // Update existing payment sources, set new one as default
      const oldValue = paymentSourcesModel.attributes.value
      const sources = [newSource]

      // Stripe: Update default payment for customer
      await stripe.customers.update(oldValue.customerId, {
        source: clearValues.sourceId
      })

      await paymentSourcesModel.save(
        {
          value: {
            sources,
            defaultSource: clearValues.sourceId,
            customerId: oldValue.customerId
          }
        },
        { patch: true }
      )
    }

    return { success: true }
  },
  pay: async function(ctx) {
    const stripeConfig = strapi.config.environments[strapi.config.environment].stripe
    const stripe = _stripe(stripeConfig.apiKey)
    const userId = ctx.session.passport.user.id

    const values = ctx.request.body
    const schema = joi.object().keys({
      settlementId: joi.string().required(),
      paymentSourceId: joi.string().required()
    })

    const result = joi.validate(values, schema, { allowUnknown: false })
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    let clearValues = result.value
    console.log(clearValues)

    // Retrieve payment user
    const paymentSourcesModel = await Usersetting.where({
      user: userId,
      key: "paymentSources"
    }).fetch({ withRelated: ["user"] })
    const paymentSources = _.get(paymentSourcesModel, "attributes.value")
    console.log("payment sources", paymentSources)
    if (!paymentSourcesModel) {
      throw new JsonApiError(`E_ERROR`, 400, "Payment sources model does not exist")
    }

    // Retrieve settlement
    const settlementModel = await Settlement.where({
      owner: userId,
      id: clearValues.settlementId
    }).fetch()
    console.log("settlement model", settlementModel.attributes)
    if (!settlementModel) {
      throw new JsonApiError(`E_ERROR`, 400, "Settlement model does not exist")
    }

    // Stripe: Charge the user
    const charge = await stripe.charges.create({
      amount: parseInt(settlementModel.attributes.amount.replace(".", "")),
      currency: "eur",
      customer: paymentSources.customerId,
      description: `Charge for ${settlementModel.attributes.faktooraId}`
    })
    console.log("charge result")
    console.log(charge)

    await settlementModel.save(
      {
        paid: "paid"
      },
      { patch: true }
    )

    return { success: true }
  }
}
