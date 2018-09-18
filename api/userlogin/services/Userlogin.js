"use strict"

/**
 * Module dependencies
 */
const bcrypt = require("bcrypt")
const co = require("co")
const joi = require("joi")
const Chance = require("chance")
const chance = new Chance()
const JsonApiError = require("../../../utils/json-api-error")

/**
 * A set of functions called "actions" for `Userlogin`
 */

module.exports = {
  /**
   * Retrieves a user from username and password
   * @param  {[type]} email [description]
   * @param  {[type]} password [description]
   * @return {[type]}          [description]
   */
  getVerifiedUser: function(email, password, compareRawPwd = false) {
    return new Promise((resolve, reject) => {
      Userlogin.query({ where: { email: email, isVerified: true } })
        .fetch({ withRelated: "user" })
        .then(model => {
          if (model === null) {
            reject({ reason: "user not found", model: model })
          }

          // Check PW hash
          let isPwdValid = false
          if (compareRawPwd) {
            isPwdValid = password === model.attributes.passwordHash
          } else {
            isPwdValid = bcrypt.compareSync(password, model.attributes.passwordHash) === true
          }

          if (isPwdValid) {
            resolve(model)
          } else {
            reject({ reason: "wrong password" })
          }
        })
        .catch(err => {
          reject(err)
        })
    })
  },

  hashPassword: function(user) {
    return new Promise((resolve, reject) => {
      bcrypt.hash(user, 10, (err, hash) => {
        if (err) reject(err)
        resolve(hash)
      })
    })
  },

  forgotPassword: async function(ctx) {
    const values = ctx.request.body
    const schema = joi.object().keys({
      email: joi
        .string()
        .required()
        .email()
    })

    const clearValues = joi.validate(values, schema, { allowUnknown: false, abortEarly: false })

    // Throw validate errors
    if (clearValues.error !== null) {
      let details = Array.from(clearValues.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }

    let userloginModel = await Userlogin.query({ where: { email: values.email } }).fetch({ withRelated: ["user"] })
    if (userloginModel === null) {
      throw new JsonApiError("E_RESOURCE_NOT_EXISTS", 400, `user with email ${values.email} does not exist`)
    }
    const userModel = userloginModel.related("user")

    let expireDate = new Date(Date.now() + 2 * 86400000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ") // 86400000 = 1 days
    let token = chance.hash({ length: 32 })
    await userloginModel.save({ resetToken: token, resetTokenExpires: expireDate }, { path: true })
    // find userlogin info
    let recipientModel = await User.query(function(qb) {
      qb.innerJoin(`userlogin`, `userlogin.user`, `user.id`)
      qb.where(`user.id`, "=", userModel.id)
      qb.andWhere("userlogin.isMain", "=", true)
    }).fetch({
      columns: ["user.isSeller", "user.isBuyer", "userlogin.email", "userlogin.firstName", "userlogin.lastName"]
    })
    // send email with password reset token to user
    await Email.forge({
      data: {
        subject: `app.notification.${`forgotPassword`}.summary`,
        content: `app.notification.${`forgotPassword`}.text`,
        name: recipientModel.attributes.firstName,
        resetPwdLink: `${strapi.config.environments[strapi.config.environment].frontendUrl}/reset/${token}`
      },
      template: "notification",
      to: recipientModel.attributes.email
    }).save()

    return {}
  },

  changePassword: async function(ctx) {
    const values = ctx.request.body
    const schema = joi.object().keys({
      token: joi.string().required(),
      password: joi.string().required()
    })

    const clearValues = joi.validate(values, schema, { allowUnknown: false, abortEarly: false })
    // Throw validate errors
    if (clearValues.error !== null) {
      let details = Array.from(clearValues.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }

    let userloginModel = await Userlogin.query({ where: { resetToken: values.token } }).fetch()
    if (userloginModel === null) {
      throw new JsonApiError("E_RESOURCE_NOT_EXISTS", 400, `Token is invalid`)
    }
    let currentDate = new Date().getTime()
    let expireDate = new Date(userloginModel.attributes.resetTokenExpires).getTime()
    if (expireDate < currentDate) {
      throw new JsonApiError("E_TOKEN_EXPIRE", 400, `Token is expired`)
    }

    // Lift the blocked status from the user
    await userloginModel.save(
      { resetToken: null, resetTokenExpires: null, passwordHash: values.password },
      { path: true }
    )
    await new User({ id: userloginModel.attributes.user }).save({ loginAttempts: 0, isBlocked: false }, { path: true })

    return {}
  },
  addUserlogin: async function(ctx) {
    let userId = ctx.session.passport.user.id
    const body = ctx.request.body
    let values = body
    const schema = joi.object().keys({
      firstName: joi.string().required(),
      lastName: joi.string().required(),
      gender: joi
        .string()
        .valid(["male", "female", ""])
        .allow(""),
      title: joi.string().allow(""),
      email: joi
        .string()
        .email()
        .required(),
      phone: joi
        .string()
        .regex(/^[0-9()\/\-\#\*\_\|\+\ ]{6,23}[0-9()]{1}$/i)
        .allow(""),
      role: joi.string().allow("")
    })
    const result = joi.validate(values, schema, { abortEarly: false })
    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    let data = result.value
    if (!data.gender) {
      data.gender = null
    }
    let userLoginExistModel = await Userlogin.forge({ email: data.email }).fetch()
    if (userLoginExistModel) {
      throw new JsonApiError(`E_EMAIL_EXISTS`, 400)
    }

    data.user = userId
    let userloginModel = await Userlogin.forge(result.value).save()
    let userlogin = userloginModel.toJSON()
    delete userlogin.passwordHash

    return userlogin
  },
  updateUserlogin: async function(ctx) {
    let userId = ctx.session.passport.user.id
    let id = ctx.params.id
    const body = ctx.request.body
    let values = body
    const schema = joi.object().keys({
      firstName: joi.string(),
      lastName: joi.string(),
      email: joi.string().email(),
      phone: joi
        .string()
        .regex(/^[0-9()\/\-\#\*\_\|\+\ ]{6,23}[0-9()]{1}$/i)
        .allow(""),
      role: joi.string().allow(""),
      gender: joi
        .string()
        .valid(["male", "female", ""])
        .allow(""),
      title: joi.string().allow("")
    })
    const result = joi.validate(values, schema, { abortEarly: false })
    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    let data = result.value
    if (!data.gender) {
      data.gender = null
    }
    // check userlogin is link to userid
    let userloginModel = await Userlogin.forge({ id: id, user: userId }).fetch()
    if (!userloginModel) {
      throw new JsonApiError("E_USERLOGINID_NOT_EXIST", 400, `Id is not exist`)
    }

    // check email exist
    if (data.email) {
      let userLoginExistModel = await Userlogin.query(function(qb) {
        qb.where("email", data.email)
        qb.andWhere("id", "<>", id)
      }).fetch()
      if (userLoginExistModel) {
        throw new JsonApiError(`E_EMAIL_EXISTS`, 400)
      }
    }
    await userloginModel.save(data, { path: true })
    let userlogin = userloginModel.toJSON()
    delete userlogin.passwordHash

    return userlogin
  },
  deleteUserlogin: async function(ctx) {
    let id = ctx.params.id
    let userId = ctx.session.passport.user.id

    // check userlogin is link to userid
    let userloginModel = await Userlogin.forge({ id: id, user: userId }).fetch()
    if (!userloginModel) {
      throw new JsonApiError("E_USERLOGINID_NOT_EXIST", 400, `Id is not exist`)
    }
    if (userloginModel.attributes.isMain) {
      throw new JsonApiError("E_CANNOT_DELETE_MAIN_USER", 400, `You cannot delete the main user.`)
    }
    await userloginModel.destroy()
    return { id }
  }
}
