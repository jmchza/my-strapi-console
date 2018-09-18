/* eslint-disable no-undef */ /*, no-unused-vars */
const assign = require("lodash/assign")
const pick = require("lodash/pick")
const omit = require("lodash/omit")
const joi = require("joi")
const JsonApiError = require("../../../utils/json-api-error")

module.exports = {
  createErrorReporting: async function(ctx) {
    const values = ctx.request.body
    const userId = ctx.session.passport.user.id
    const validateSchema = joi.object().keys({
      message: joi.string().required(),
      platform: joi.string().required(),
      osVersion: joi.string()
    })

    const clearValues = joi.validate(assign({}, values), validateSchema, { allowUnknown: false, abortEarly: false })
    // Throw validate errors
    if (clearValues.error !== null) {
      const details = Array.from(clearValues.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError("E_VALIDATION", 400, details)
    }

    let contactModel
    try {
      contactModel = await Contact.forge(
        assign(pick(clearValues.value, ["message", "platform", "osVersion"]), {
          user: userId
        })
      ).save()
      if (contactModel) {
        Notification.forge({
          type: "createErrorReporting",
          recipient: userId
        }).save()
      }
    } catch (e) {
      throw new JsonApiError("E_CONTACT_SAVING", 400, "An error occurred")
    }

    return {
      errors: null,
      data: contactModel ? omit(contactModel.toJSON(), ["id", "language"]) : {}
    }
  }
}
