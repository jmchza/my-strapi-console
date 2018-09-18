"use strict"

/**
 * Module dependencies
 */

// Public dependencies.
const fs = require("fs")
const path = require("path")
const joi = require("joi")
const parseNumber = require("libphonenumber-js").parseNumber
const callDecimoApi = require("../../../utils/decimoApi")
const JsonApiError = require("../../../utils/json-api-error")

/**
 * A set of functions called "actions" for `App`
 */

module.exports = {
  callBackDecimoOrder: async function(ctx) {
    const body = ctx.request.body
    const decimoId = body.order_id
    const status = callDecimoApi.getStatus(body.status)
    if (status && decimoId) {
      const invoice = await Invoice.query(function(qb) {
        qb.whereRaw("data ->> ? = ?", ["decimoId", decimoId])
      }).fetch()
      if (invoice) {
        await invoice.save({ status }, { patch: true })
      }
    }
  },
  editSettingByAdmin: async function(ctx) {
    const body = ctx.request.body
    let values = body
    const schema = joi.object().keys({
      key: joi.string().required(),
      value: joi.object().required(),
      user: joi
        .string()
        .guid()
        .required()
    })
    const result = joi.validate(values, schema, { allowUnknown: false, abortEarly: false })
    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    const user = await User.forge({ id: values.user }).fetch()
    if (!user) {
      throw new JsonApiError(`E_VALIDATION`, 400, "missing user!")
    }
    const setting = await Usersetting.forge({ user: values.user, key: values.key }).fetch()
    if (setting) {
      await setting.save({ value: Object.assign({}, setting.attributes.value, values.value) })
    } else {
      await strapi.services.jsonapi.add(strapi.models.usersetting, values)
    }
    return values
  },
  resetCountStats: async function(key, attrs) {
    const settings = await Usersetting.where("key", key).fetchAll()
    if (settings && settings.models) {
      settings.models.forEach(setting => {
        let newSetting = setting.attributes.value
        attrs.forEach(attr => {
          newSetting[attr] = 0
        })
        setting.save({ value: newSetting })
      })
    }
  },
  createLemonWayAccounts: async function(key, attrs) {
    strapi.log.info("create LemonWay Account")
    const userModel = await User.query(qb => {
      qb.select("id", "postcode", "city", "street", "companyName")
      qb.whereNull("walletID")
      qb.whereNotNull("companyName")
      qb.whereNotNull("postcode")
      qb.whereNotNull("city")
      qb.whereNotNull("street")
      //qb.debug(true)
    }).fetchAll()
    let users = userModel.toJSON() || []
    for (let i in users) {
      let user = users[i]
      try {
        if (user.companyName && user.postcode && user.city && user.street) {
          await strapi.services.user.createOrUpdateLemonWayAccount(user.id)
        } else {
          strapi.log.info(`userId: ${user.id} not complete profile.`)
        }
      } catch (err) {
        strapi.log.err(err)
      }
    }
  },
  version: function() {
    const versionPath = path.join(process.cwd(), "data", "commit.json")
    try {
      fs.accessSync(versionPath, fs.F_OK)
    } catch (e) {
      return {
        error: "No version information could be found"
      }
    }
    let version = fs.readFileSync(versionPath, "utf-8")
    return JSON.parse(version)
  },
  verifyPhoneNumber: async function(ctx) {
    const body = ctx.request.body
    const { phoneNo } = body
    const defaultCountry = "DE"
    const phoneInfomation = parseNumber(phoneNo, defaultCountry, { extended: true })
    if (phoneInfomation) {
      if (phoneInfomation.valid && phoneInfomation.possible) {
        return { result: true }
      }
    }
    return { result: false }
  }
}
//
