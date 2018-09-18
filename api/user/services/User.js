"use strict"

/**
 * Module dependencies
 */
const path = require("path")

const parse = require("co-busboy")
const JsonApiError = require("../../../utils/json-api-error")
const worker = require("../../../utils/worker")

const bcrypt = require("bcrypt")

// Public dependencies.
const _ = require("lodash")
const joi = require("joi")
const co = require("co")
const { registerLemonWay, registerIbanLemonWay, getWalletDetails } = require("../../../utils/lemonway")
const common = require("../../../utils/common")
const callDecimoApi = require("../../../utils/decimoApi")
const mapLegalType = require("../../../utils/decimoApi").mapLegalType

const schemaDecimo = joi.object().keys({
  companyName: joi.string().required(),
  firstName: joi.string().required(),
  lastName: joi.string().required(),
  valueAddedTaxId: joi.string().regex(common.VALUE_ADDED_TAXID_REGEX),
  taxIdentNumber: joi.string().regex(common.TAX_IDENT_NUMBER_REGEX),
  street: joi.string().required(),
  address: joi.string(),
  birthday: joi.date(),
  postcode: joi
    .string()
    .required()
    .min(4)
    .max(5),
  city: joi.string().required(),
  phone: joi
    .string()
    .regex(/^[0-9()\/\-\#\*\_\|\+\ ]{6,23}[0-9()]{1}$/i)
    .required()
    .allow(""),
  country: joi.string()
})

/**
 * A set of functions called "actions" for `User`
 */

module.exports = {
  transferDecimo: async ctx => {
    const user = ctx.session.passport.user
    const userModel = await User.forge({ id: user.id }).fetch({ withRelated: "legalform" })
    const userLoginModel = await Userlogin.forge({ id: user.userloginId }).fetch()
    const legalform = userModel.related("legalform")
    const values = ctx.request.body
    let clearValues = joi.validate(values, schemaDecimo, { allowUnknown: false, abortEarly: false })
    // Throw validate errors
    if (clearValues.error !== null) {
      let details = Array.from(clearValues.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    clearValues = clearValues.value

    // 3333 - Fix tax ident number before sending it to decimo
    let taxIdentNumber = _.isString(clearValues.taxIdentNumber) ? clearValues.taxIdentNumber : ""
    if (taxIdentNumber) {
      taxIdentNumber = taxIdentNumber.replace(/\//g, "")
      const taxLen = taxIdentNumber.length
      if (taxLen > 13 || taxLen < 10) {
        throw new JsonApiError("E_VALIDATION", 400, "Die St.-Nr. muss aus 10 - 13 Ziffern bestehen")
      }

      if (taxLen === 11) {
        taxIdentNumber = taxIdentNumber.substr(1)
      }

      let segments = taxIdentNumber.split("")
      if (taxIdentNumber.length === 10) {
        segments.splice(2, 0, "/")
        segments.splice(6, 0, "/")
      }

      taxIdentNumber = segments.join("")
    }

    const pathUserData = _.assign(
      _.pick(clearValues, [
        "companyName",
        "valueAddedTaxId",
        "taxIdentNumber",
        "street",
        "postcode",
        "city",
        "country",
        "phone",
        "address",
        "birthday"
      ]),
      { executiveName: `${clearValues.firstName} ${clearValues.lastName}` }
    )
    await User.forge({ id: user.id }).save(pathUserData, { patch: true })
    const decimoData = _.assign(
      _.pick(clearValues, ["city", "country", "phone"]),
      {
        email: userLoginModel.get("email"),
        line1: clearValues.street,
        line2: clearValues.address,
        first_name: clearValues.firstName,
        last_name: clearValues.lastName,
        zip: clearValues.postcode,
        date_of_birth: common.formatDate(clearValues.birthday, "YYYY-MM-DD"),
        vat_number: clearValues.valueAddedTaxId,
        tax_number: taxIdentNumber
      },
      mapLegalType(_.get(legalform, "attributes.key"))
    )
    const result = await callDecimoApi({ name: "/principals", body: decimoData })
    return result
  },
  updateUserProfileImage: co.wrap(function*(ctx) {
    let userId = ctx.session.passport.user.id
    const promises = []
    let part
    const parts = parse(ctx, {
      autoFields: true,
      // Validadon used by `co-busboy`
      checkFile: function(fieldname, file, filename) {
        const acceptedExtensions = [".png", ".jpg", ".gif", ".jpeg"]
        if (!acceptedExtensions.includes(path.extname(filename))) {
          var err = new Error("invalid filetype. Only PNG,JPG, GIF are allowed")
          err.status = 400
          return new JsonApiError(`E_VALIDATION`, 400, "invalid filetype. Only PNG,JPG, GIF are allowed")
        }
      }
    })

    let userModel = yield User.forge({ id: userId }).fetch()
    let companyLogo = (userModel && userModel.attributes.companyLogo) || null
    while ((part = yield parts)) {
      const fileUpload = yield strapi.services.upload.upload(part, this, "image", "userprofile")
      // update user
      yield User.forge({ id: userId }).save({ companyLogo: fileUpload.id }, { patch: true })
      // promises.push(`${strapi.services.upload.defaultUploadFolder}/${fileUpload.attributes.path}/${fileUpload.attributes.filename}`)
      promises.push(fileUpload)
    }

    if (companyLogo) {
      yield Upload.forge({ id: companyLogo }).destroy()
    }

    return promises
  }),
  changePassword: async function(ctx) {
    const values = ctx.request.body
    let userId = ctx.session.passport.user.id
    const schema = joi.object().keys({
      oldPassword: joi.string().required(),
      passwordConfirmation: joi
        .string()
        .required()
        .min(8),
      password: joi
        .string()
        .required()
        .min(8)
    })

    const clearValues = joi.validate(values, schema, { allowUnknown: false, abortEarly: false })
    // Throw validate errors
    if (clearValues.error !== null) {
      let details = Array.from(clearValues.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }

    let userloginModel = await Userlogin.query({ where: { user: userId } }).fetch()
    if (userloginModel === null) {
      throw new JsonApiError("E_RESOURCE_NOT_EXISTS", 400, `User login exist`)
    }

    return new Promise(function(resolve, reject) {
      bcrypt.compare(values.oldPassword, userloginModel.attributes.passwordHash, (err, isMatch) => {
        if (!isMatch) {
          reject(new JsonApiError("E_OLD_PWD_NOT_CORRECT", 400, `Old password is not correctly`))
        } else {
          userloginModel.save({ passwordHash: values.password }, { path: true }).then(function() {
            // Notify the user
            Notification.forge({
              type: "changedPassword",
              recipient: userId
            }).save()
            resolve({ id: userId })
          })
        }
      })
    })
  },
  getCustomers: co.wrap(function*(ctx) {
    let userId = ctx.session.passport.user.id
    let pageSize = ctx.query["page[size]"] || 10
    let page = ctx.query["page[number]"] || 1
    let sortBy = ctx.query["sort"] || "updated_at"

    let customerTableName = strapi.models.customer.collectionName
    let invoiceTableName = strapi.models.invoice.collectionName
    return new Promise((resolve, reject) => {
      Customer.query(function(qb) {
        qb.distinct()
        qb.leftJoin(`${invoiceTableName}`, `${invoiceTableName}.debtor`, `${customerTableName}.id`)
        qb.where(`${invoiceTableName}.owner`, "=", userId).orWhere(`${customerTableName}.user`, "=", userId)
        // qb.debug(true)
      })
        .orderBy(sortBy)
        .fetchPage({
          pageSize: pageSize,
          page: page
        })
        .then(function(results) {
          resolve(results)
        })
        .catch(err => {
          reject(err)
        })
    })
  }),
  udpateUserBankAccount: co.wrap(function*(ctx) {
    const values = ctx.request.body
    let userId = ctx.session.passport.user.id
    const schema = joi.object().keys({
      holderName: joi.string(),
      iban: joi
        .string()
        .max(34)
        .regex(/^DE\d{2}\s*([\da-zA-Z]{4}\s*){4}[\da-zA-Z]{2}$/),
      bic: joi
        .string()
        .min(11)
        .regex(/^[a-z]{6}[0-9a-z]{2}([0-9a-z]{3})?/i)
    })

    const result = joi.validate(values, schema, { allowUnknown: false, abortEarly: false })
    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }

    // find user
    const userModel = yield User.forge({ id: userId }).fetch()
    if (!userModel) {
      throw new JsonApiError("E_RESOURCE_NOT_EXISTS", 400)
    }

    let data = _.omit(result.value, _.isEmpty)

    // check iban duplicated
    if (data.iban) {
      let bankAccountDuplicatedModel = yield Bankaccount.where(qb => {
        qb.where("id", "<>", userModel.attributes.primaryBankaccount).andWhere("iban", "=", data.iban)
      }).fetch()

      if (bankAccountDuplicatedModel) {
        throw new JsonApiError("E_RESOURCE_ALREADY_EXISTS", 400, `Bank with IBAN ${data.iban} already exist`)
      }
    }

    if (userModel.attributes.primaryBankaccount) {
      let BankAccountModel = yield Bankaccount.forge({ id: userModel.attributes.primaryBankaccount }).fetch()
      if (!data.iban) {
        data.iban = BankAccountModel.attributes.iban
      }
      if (!data.bic) {
        data.bic = BankAccountModel.attributes.bic
      }
      if (!data.holderName) {
        data.holderName = BankAccountModel.attributes.holderName
      }
      yield Bankaccount.forge({ id: userModel.attributes.primaryBankaccount }).save(data, { path: true })
    } else {
      yield Bankaccount.forge(data).save()
    }

    return result.value
  }),
  updateUserField: co.wrap(function*(ctx) {
    const body = ctx.request.body
    let values = body
    let userId = ctx.session.passport.user.id

    // Validate incoming data
    const schema = joi.object().keys({
      companyName: joi.string().allow(""),
      street: joi.string().allow(""),
      postcode: joi
        .string()
        .min(4)
        .max(5),
      city: joi.string(),
      phone: joi
        .string()
        .regex(/^[0-9()\/\-\#\*\_\|\+\ ]{6,23}[0-9()]{1}$/i)
        .allow(""),
      industry: joi
        .string()
        .guid()
        .allow(null),
      legalform: joi.string().guid(),
      name: joi.string().allow(""),
      valueAddedTaxId: joi.string().allow(""),
      taxIdentNumber: joi.string().allow(""),
      email: joi.string().email(),
      executiveName: joi.string().allow(""),
      country: joi.string().allow(""),
      tradeRegisterNumber: joi.string().allow(""),
      registryCourt: joi.string().allow("")
    })
    if (values.industry === "") {
      values.industry = null
    } else if (values.legalform === "") {
      values.industry = null
    }
    const result = joi.validate(values, schema, { allowUnknown: false, abortEarly: false })
    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }

    let data = _.omit(result.value, _.isEmpty)
    if (!_.isUndefined(data.valueAddedTaxId)) {
      data.valueAddedTaxId = data.valueAddedTaxId || null
    }
    if (!_.isUndefined(data.taxIdentNumber)) {
      data.taxIdentNumber = data.taxIdentNumber || null
    }
    /*
    // check email duplicated
    if (data.email) {
      let userDuplicatedModel = yield User.where(qb => {
        qb.where('id', '<>', userId)
          .andWhere('email', '=', data.email)
      }).fetch()

      if (userDuplicatedModel) {
        throw new JsonApiError('E_RESOURCE_ALREADY_EXISTS', 400, `User with email ${data.email} already exist`)
      }
    }
    */
    if (data.email && data.email !== "") {
      console.log("saving userlogin")
      yield Userlogin.forge({ user: userId, isMain: true }).save({ email: data.email }, { path: true })
    } else {
      console.log("saving user")
      yield User.forge({ id: userId }).save(data, { path: true })
    }
    return data
  }),
  createMonthlyBuyerInvoices: async function(dryRun = false) {
    // Create a monthly invoice for every buyer
    let users = await User.where("isBuyer", true).fetchAll({ withRelated: ["userlogins"] })

    // Execute code for every buyer
    for (let user of users.models) {
      // look for main userlogin

      for (var userlogin of user.related("userlogins").models) {
        if (userlogin.attributes.isMain === true) {
          break
        }
      }
      if (userlogin.attributes.isMain !== true) {
        console.log(`Skipped creating invoice for ${userlogin.attributes.email} because he has no main userlogin`)
      }

      let invoicesBought = await Invoicesale.query(qb => {
        qb.select(["bid.created_at", "invoice.faktooraId", "bid.amount"])
        qb.innerJoin("bid", "bid.id", "invoicesale.winningBid")
        qb.innerJoin("invoice", "invoice.id", "invoicesale.invoice")
        qb.where("buyer", "=", user.id)
        qb.andWhere(
          strapi.connections.default.raw("bid.created_at >= date_trunc('month', current_date - interval '1' month)")
        )
        qb.andWhere(strapi.connections.default.raw("bid.created_at < date_trunc('month', current_date)"))
        qb.orderBy("bid.created_at", "ASC")
      }).fetchAll()

      if (invoicesBought.length > 0) {
        // Calculate fees

        const invoicesJson = invoicesBought.toJSON()

        // Calculate and sum all buyer fees
        let totalFees = 0
        for (let invoice of invoicesJson) {
          invoice.fee = Number((Number(invoice.outstandingBalance) * 0.01).toFixed(2))
          totalFees += invoice.fee
        }

        await worker.generateInvoice({
          type: "monthlyBuyerStatement",
          userlogin: userlogin.toJSON(),
          user: user.toJSON(),
          invoices: invoicesJson,
          totalFees
        })
      }
    }
  },
  deleteUserImage: async function(ctx) {
    const { type } = ctx.params
    let userId = ctx.session.passport.user.id
    let imageId = null
    if (type === "logo") {
      let userModel = await User.forge({ id: userId }).fetch()
      // remove logo field
      let user = userModel.toJSON()
      if (user.companyLogo) {
        await userModel.save({ companyLogo: null }, { patch: true })
        imageId = user.companyLogo
      }
    } else if (type === "signature") {
      await Usersetting.where({ key: "signature", user: userId }).destroy()
    } else {
      throw new JsonApiError(`E_VALIDATION`, 400, "Wrong type")
    }
    /*
    TODO: We need to temporary disable this because invoices and other documents hold references to these uploads so it cant be deleted anyways

    if (imageId) {
      let uploadModel = await Upload.forge({ id: imageId }).fetch()
      await uploadModel.destroy()
    }*/
    return { type: type }
  },
  userOverview: async function(ctx) {
    let queryModel = global["User"].forge()

    const pageNumber = ctx.query["page[number]"] || 1
    const pageSize = 50
    const searchterm = ctx.query["searchterm"] !== undefined ? `%${ctx.query["searchterm"]}%` : null
    const sort = ctx.query["sort"] || null

    // 1. Filtering (full text search)
    if (searchterm !== null) {
      queryModel.query(qb => {
        qb
          .where("companyName", "ILIKE", searchterm)
          .orWhere("walletID", "ILIKE", searchterm)
          .orWhere("executiveName", "ILIKE", searchterm)
      })
    }

    // 2. Sorting
    if (sort !== null) {
      const sortDirection = sort.substr(0, 1) === "-" ? "desc" : "asc"
      const sortColumn = sort.replace(/[+-]/g, "").trim()
      queryModel.orderBy(sortColumn, sortDirection)
    }

    const queryResult = await queryModel.fetchPage({
      pageSize,
      page: pageNumber,
      withRelated: ["invoices.invoicesale"]
    })

    const result = {
      data: queryResult.models,
      pagination: queryResult.pagination
    }

    return result
  },
  saveTax: async function(ctx) {
    try {
      let values = ctx.request.body
      let userId = ctx.session.passport.user.id

      // Validate incoming data
      const schema = joi
        .object()
        .keys({
          valueAddedTaxId: joi.string().regex(common.VALUE_ADDED_TAXID_REGEX),
          taxIdentNumber: joi.string().min(10)
        })
        .xor("valueAddedTaxId", "taxIdentNumber")

      const result = joi.validate(values, schema, { allowUnknown: false, abortEarly: false })

      // Throw validate errors
      if (result.error !== null) {
        let details = Array.from(result.error.details, el => {
          return { message: el.message }
        })
        throw new JsonApiError("E_VALIDATION", 400, details)
      }

      const data = _.omit(result.value, _.isEmpty)
      let user = await User.forge({ id: userId }).fetch()

      await user.save(data, { patch: true })

      return data
    } catch (e) {
      throw e
    }
  },
  createOrUpdateLemonWayAccount: async function(userId) {
    let userModel = await User.forge({ id: userId }).fetch({ withRelated: ["userlogins"] })
    const userModelJson = userModel.toJSON()
    let wallet
    // Create wallet if it does not exist yet
    if (!userModelJson.walletID) {
      const reuseExistingWallets = strapi.config.environments[strapi.config.environment].lemonway.reuseExistingWallets || false
      let walletDoesExist = false
      if (userModelJson.postcode && userModelJson.city && userModelJson.street) {
        if (reuseExistingWallets === true) {
          try {
            wallet = await getWalletDetails(null, userModelJson.userlogins[0].email)
            console.log(`Found Lemon Way wallet with ID ${wallet.ID}`)
            walletDoesExist = true
          } catch (err) {
            strapi.log.error(err)
            if (err.details[0].code === "E_SERVICE_LEMONWAY_147") {
              // 147 = Non-existent login
              console.log(`Wallet does not exist yet for ${userModelJson.userlogins[0].email}`)
            } else {
              console.log(`Unhandled error when looking for existing Lemon Way user`, err)
            }
          }
        }
        try {
          if (walletDoesExist === false) {
            console.log("creating new wallet")
            wallet = await registerLemonWay(userModelJson)
          }
          // model.set("walletID", wallet.ID)
          // userModelJson.walletID = wallet.ID
          userModel.save({ walletID: wallet.ID }, { patch: true })
        } catch (error) {
          strapi.log.error(error)
          console.error("Error when registerLemonWay", error)
        }
      }
    }
    // When the user saves a primary bankaccount --> register it with LemonWay
    // only using if we need to upgrade lemonway
    if (userModelJson.walletID !== null && userModelJson.primaryBankaccount) {
      const bankaccountModel = await Bankaccount.forge({ id: userModelJson.primaryBankaccount }).fetch()
      console.log("Registering IBAN with LemonWay")
      try {
        await registerIbanLemonWay(userModelJson.toJSON(), userModelJson.walletID, "1.1.1.1", bankaccountModel.toJSON())
      } catch (error) {
        strapi.log.error(error)
        console.error("Error register Iban of LemonWay", error)
      }
    }
    return wallet && wallet.ID
  }
}
