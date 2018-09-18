"use strict"

/**
 * Module dependencies
 */

// Public dependencies.
const joi = require("joi")
const co = require("co")
const JsonApiError = require("../../../utils/json-api-error")
/**
 * A set of functions called "actions" for `Email`
 */

module.exports = {
  createFeedback: async ctx => {
    let values = ctx.request.body

    const telephoneNumber = values.phone
    delete values.phone

    const schema = joi.object().keys({
      from: joi
        .string()
        .required()
        .email(),
      fullname: joi.string().required(),
      subject: joi.string().required(),
      content: joi.string().required()
    })
    const result = joi.validate(values, schema, { allowUnknown: false, abortEarly: false })
    let clearValues = result.value
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })

      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    clearValues.data = {
      content: clearValues.content,
      name: clearValues.fullname,
      title: values.subject,
      phone: telephoneNumber
    }
    clearValues.subject = `Contactform: ${clearValues.subject}`
    clearValues.to = "info@faktoora.com"
    clearValues.template = "feedback"
    delete clearValues.content
    delete clearValues.fullname
    let email = await new Email(clearValues).save()
    if (email && email.id) {
      return ""
    } else {
      throw new JsonApiError(`E_DATABASE`, 401, "Cant store data to database")
    }
  }
}
