"use strict"

/**
 * Module dependencies
 */

// Public dependencies.
const _ = require("lodash")
const path = require("path")
const joi = require("joi")
const moment = require("moment")
const findState = require("german-postcode-to-state")
const JsonApiError = require("../../../utils/json-api-error")
const json2csv = require("json2csv")
const excel = require("node-excel-export")
const common = require("../../../utils/common")
const padLeft = common.padLeft
const worker = require("../../../utils/worker")
const ua = require("universal-analytics")
const callDecimoApi = require("../../../utils/decimoApi")
const fs = require("fs")

/**
 * The schema an invoice draft is evaluated aainst
 */
const invoiceSchemaDraft = joi.object().keys({
  fixing: joi.object().keys({
    id: joi
      .string()
      .guid()
      .required(),
    type: joi
      .string()
      .valid(["cancellation", "crediting", "correction"])
      .required()
  }),
  totaldiscount: joi.object().keys({
    type: joi
      .string()
      .valid(["percent", "currency"])
      .required(),
    value: joi.number().required()
  }),
  deduction: joi.object().keys({
    label: joi.string(),
    value: joi.number().required()
  }),
  introduction: joi.string().allow(""),
  postscript: joi.string().allow(""),
  faktooraId: joi.string().allow(["", null]),
  paymentterm: joi.string().allow(""),
  invoiceOrderNumber: joi.string().allow(""),
  invoiceNumber: joi.string().allow(""),
  issueDate: joi.date().allow(""),
  lastPaymentDate: joi.date().allow(""),
  deliveryDate: joi.date().allow(""),
  debtor: joi
    .string()
    .guid()
    .allow(""),
  subject: joi.string().allow(""),
  salutation: joi.string().allow(""),
  greeting: joi.string().allow(""),
  taxExemptHint: joi.string(),
  email: joi.string().allow(""),
  telephone: joi
    .string()
    .regex(/^[0-9()\/\-\#\*\_\|\+\ ]{6,23}[0-9()]{1}$/i)
    .allow(""),
  signature: joi
    .string()
    .guid()
    .allow(""),
  signatureName: joi.string().allow(""),
  paidCash: joi.boolean().allow(""),
  paymentControl: joi.boolean().allow(""),
  invoicePositions: joi.array().items(
    joi.object().keys({
      description: joi.string().required(),
      customDescription: joi.string(),
      unit: joi.string(),
      articleNumber: joi.string().allow(""),
      quantity: joi
        .number()
        .required()
        .positive(),
      price: joi
        .number()
        .required()
        .unit("€")
        .max(999999.99),
      tax: joi
        .number()
        .valid([0, 7, 19, -7, -19])
        .required()
    })
  ),
  hasArticleNumber: joi.boolean().allow(""),
  isTaxExemptUser: joi.boolean().allow(""),
  template: joi.object().keys({
    style: joi.string().allow(""),
    color: joi.string().allow(""),
    templateTextColor: joi.string().allow("")
  }),
  formatting: joi.object().keys({
    lineSpacing: joi.string().allow("")
  }),
  invoiceNumberTemplate: joi.object().keys({
    template: joi.string().allow(""),
    date: joi.date().allow(""),
    number: joi.string().allow("")
  }),
  letter: joi.object().keys({
    customer: joi
      .string()
      .guid()
      .allow(""),
    signature: joi.string().guid(),
    subject: joi.string().required(),
    salutation: joi.string().required(),
    content: joi.string().required(),
    greeting: joi.string().required(),
    signatureName: joi.string(),
    signatures: joi.array().allow("")
  }),
  valueAddedTaxId: joi.string().allow(["", null]),
  signatures: joi.array().allow(""),
  isDecimoMode: joi.boolean()
})

/**
 * The schema an invoice is evaluated aainst
 */
const invoiceSchema = joi.object().keys({
  fixing: joi.object().keys({
    id: joi
      .string()
      .guid()
      .required(),
    type: joi
      .string()
      .valid(["cancellation", "crediting", "correction"])
      .required()
  }),
  cancelationId: joi.string(),
  totaldiscount: joi.object().keys({
    type: joi
      .string()
      .valid(["percent", "currency"])
      .required(),
    value: joi.number().required()
  }),
  deduction: joi.object().keys({
    label: joi.string(),
    value: joi.number().required()
  }),
  introduction: joi.string(),
  postscript: joi.string(),
  faktooraId: joi.string().required(),
  paymentterm: joi.string(),
  invoiceOrderNumber: joi.string(),
  invoiceNumber: joi.string().required(),
  issueDate: joi.date().required(),
  lastPaymentDate: joi.date(),
  deliveryDate: joi.date().allow(""),
  debtor: joi.string().guid(),
  subject: joi.string().required(),
  salutation: joi.string().required(),
  greeting: joi.string().required(),
  taxExemptHint: joi.string(),
  signature: joi.string().guid(),
  signatureName: joi.string(),
  paidCash: joi.boolean(),
  paymentControl: joi.boolean().allow(""),
  email: joi.string(),
  telephone: joi
    .string()
    .regex(/^[0-9()\/\-\#\*\_\|\+\ ]{6,23}[0-9()]{1}$/i)
    .allow(""),
  invoicePositions: joi
    .array()
    .min(1)
    .items(
      joi.object().keys({
        description: joi.string().required(),
        customDescription: joi.string(),
        unit: joi.string(),
        articleNumber: joi.string().allow(""),
        quantity: joi
          .number()
          .required()
          .positive(),
        price: joi
          .number()
          .required()
          .unit("€")
          .max(999999.99),
        tax: joi
          .number()
          .valid([0, 7, 19, -7, -19])
          .required()
      })
    ),
  hasArticleNumber: joi.boolean().allow(""),
  isTaxExemptUser: joi.boolean().allow(""),
  template: joi.object().keys({
    style: joi.string().allow(""),
    color: joi.string().allow(""),
    templateTextColor: joi.string().allow("")
  }),
  formatting: joi.object().keys({
    lineSpacing: joi.string().allow("")
  }),
  invoiceNumberTemplate: joi.object().keys({
    template: joi.string().allow(""),
    date: joi.date().allow(""),
    number: joi.string().allow("")
  }),
  letter: joi.object().keys({
    customer: joi
      .string()
      .guid()
      .required(),
    signature: joi.string().guid(),
    subject: joi.string().required(),
    salutation: joi.string().required(),
    content: joi.string().required(),
    greeting: joi.string().required(),
    signatureName: joi.string(),
    signatures: joi.array().allow("")
  }),
  valueAddedTaxId: joi.string().required(),
  signatures: joi.array().allow(""),
  isDecimoMode: joi.boolean()
})

/**
 * A set of functions called "actions" for `Invoice`
 */
const operatorMap = {
  gt: ">",
  eq: "=",
  neq: "!=",
  lt: "<",
  gte: ">=",
  lte: "<=",
  between: "between",
  like: "like"
}

const builderQuery = (context, params) => {
  if (params) {
    let firstWhere = true
    for (let prop in params) {
      let objFilter = params[prop]
      for (let idx in objFilter) {
        let field, key, value
        let obj = objFilter[idx]
        key = Object.keys(objFilter)[0]

        if (operatorMap[key]) {
          value = obj
          field = prop
        } else {
          const columnConfig = _.find(strapi.models.invoice.associations, o => o.alias === prop)
          const modelRelate = columnConfig && strapi.models[columnConfig.model]
          key = Object.keys(obj)[0]
          field = `${(modelRelate && modelRelate.collectionName) || prop}.${idx}`
          value = obj[key]
        }
        switch (key) {
          case "neq": {
            context.whereRaw(`${field} is distinct from ?`, [value])
            break
          }
          case "gt":
          case "lt":
          case "eq":
          case "gte":
          case "lte":
          case "like":
            if (firstWhere === true) {
              context.where(field, operatorMap[key], value)
            } else {
              context.andWhere(field, operatorMap[key], value)
            }
            break
          case "between":
          case "notbetween":
            // console.log('between for', prop, obj[key])
            if (Array.isArray(value) && value.length === 2) {
              let and = firstWhere ? "where" : "andWhere"
              let not = key === "notbetween" ? "Not" : ""
              context[`${and}${not}Between`](field, value)
            } else {
              throw new Error(`The ${key} filter needs two arguments`)
            }

            break
          default:
            throw new Error(`${key} is not a valid operator`)
        }
      }
    }
  }
}

module.exports = {
  builderQuery,

  /**
   * Generate an unused faktoora ID
   */
  generateFaktooraId: async function(ctx, prefix) {
    let tryGenerateTime = 0
    do {
      let faktooraId = common.generateFaktooraId(prefix)
      let invoice = await Invoice.forge({ faktooraId }).fetch()
      let offer = await Offer.forge({ faktooraId }).fetch()
      let settlement = await Settlement.forge({ faktooraId }).fetch()

      if (!invoice && !offer && !settlement) return faktooraId
      ++tryGenerateTime
    } while (tryGenerateTime <= 10)

    throw new JsonApiError(
      `E_GENERATE_FAKTOORA_ID`,
      406,
      "The service was unable to create a unique faktoora ID for an invoice"
    )
  },
  /**
   * Generate an unused faktoora ID
   */
  createDecimoInvoice: async function(ctx) {
    const invoiceId = ctx.params.id
    const invoice = await Invoice.forge({ id: invoiceId }).fetch({ withRelated: ["invoiceFile", "owner"] })
    const invoiceFile = invoice.related("invoiceFile")
    const user = invoice.related("owner")
    const calculateAmount = strapi.services.invoice.calculateAmount(
      _.get(invoice, "attributes.data.invoicePositions"),
      _.get(invoice, "attributes.data.totaldiscount.value")
    )
    const filepath = `${strapi.config.environments[strapi.config.environment].uploadFolder}/${invoiceFile.attributes.path}/${invoiceFile.attributes.filename}`
    let formData = {
      invoice: JSON.stringify({
        number: invoice.attributes.invoiceNumber,
        date: common.formatDate(invoice.attributes.issueDate, "YYYY-MM-DD"),
        amount: invoice.attributes.amount,
        taxes: calculateAmount.taxes,
        target: 30,
        agency_internal_invoice_id: invoice.id,
        factoring_type: "full_service",
        to: {
          name: "decimo gmbh",
          zip: "10405",
          city: "Berlin",
          country: "DE",
          phone: "+4940284683220",
          email: "test@test.com",
          line1: "Saarbrücker Straße 38a"
        }
      }),
      document: fs.createReadStream(filepath)
    }
    let result = await callDecimoApi({
      name: `/principals/${_.get(user, "attributes.principalDecimoId")}/invoices`,
      formData
    })
    const status = callDecimoApi.getStatus(result.state)
    await invoice.save(
      { data: _.assign(_.get(invoice, "attributes.data"), { decimoId: result.id }), status },
      { patch: true }
    )
    return result
  },

  /**
   * Create a invoice or a draf of an invoice
   */
  create: async function(ctx) {
    const body = ctx.request.body
    let { isDraft } = ctx.query || {}
    isDraft = isDraft === "true"
    let values = body
    const schema = isDraft ? invoiceSchemaDraft : invoiceSchema
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
    if (!clearValues.invoiceFile) {
      const calculateAmount = strapi.services.invoice.calculateAmount(
        clearValues.invoicePositions,
        (clearValues.totaldiscount && clearValues.totaldiscount.value) || 0,
        clearValues.deduction && clearValues.deduction.value
      )
      clearValues.amount = calculateAmount && calculateAmount.amount
      if (clearValues.status !== "paidCash" && clearValues.status !== "paid") {
        clearValues.outstandingBalance = calculateAmount && calculateAmount.outstandingBalance
      }
    } else {
      clearValues.amount = clearValues.invoiceAmount
    }
    // Check whether debtor exists
    let customerModel = await Customer.forge({
      id: clearValues.debtor || null
    }).fetch() // or null
    if (customerModel === null && !isDraft) {
      throw new JsonApiError("E_RESOURCE_NOT_EXISTS", 400, `Debtor with ID ${clearValues.debtor} does not exist`)
    }

    // Look up the region for a debtor
    let debtorRegion = findState(customerModel && customerModel.get("postcode"))
    if (debtorRegion !== -1) {
      clearValues.debtorRegion = debtorRegion
    }

    clearValues.owner = ctx.session.passport.user.id
    clearValues.clientId = ctx.session.passport.user.clientId
    // Assign industry
    let user = await User.forge({ id: clearValues.owner }).fetch({
      withRelated: ["legalform", "userlogins", "primaryBankaccount"]
    })
    const legalform = user.related("legalform")
    /* let templateArr = ['standard', 'classic', 'creative']
    let templateColorArr = ['#007990', '#e7d900', '#b70f0a', '#72bb53', '#ffffff']
    clearValues.template = {
      style: _.sampleSize(templateArr, 1)[0],
      color: _.sampleSize(templateColorArr, 1)[0]
    }*/

    // Handle signature data
    let signatureIds = _.get(clearValues, "signatures", []).filter(s => s !== null)
    let signatures = (await common.generateSignatureData(signatureIds, user)) || []

    clearValues.data = _.pick(clearValues, [
      "totaldiscount",
      "deduction",
      "introduction",
      "postscript",
      "paymentterm",
      "greeting",
      "signatureName",
      "email",
      "telephone",
      "paidCash",
      "template",
      "formatting",
      "valueAddedTaxId",
      "deliveryDate",
      "hasArticleNumber",
      "isTaxExemptUser",
      "taxExemptHint",
      "fixing",
      "isDecimoMode"
    ])
    clearValues.data.signatures = signatures
    clearValues.invoiceNumberTemplate && (clearValues.data.invoiceNumber = clearValues.invoiceNumberTemplate)
    // fill in the invoicepositions
    let invoicePositions = []
    for (let invoicePosition of clearValues.invoicePositions) {
      invoicePosition.product = invoicePosition.description
      invoicePositions.push(
        _.pick(invoicePosition, ["product", "price", "quantity", "tax", "customDescription", "unit", "articleNumber"])
      )
    }
    clearValues.data.invoicePositions = invoicePositions

    // Assign status
    if (isDraft) {
      clearValues.status = "draft"
    } else {
      clearValues.status = clearValues.paidCash ? "paidCash" : "created"
    }

    // Paid cash invoices cant have payment control no matter what the frontend delivers
    if (clearValues.paidCash) {
      clearValues.paymentControl = false
    }

    let invoice = await Invoice.forge(
      _.pick(clearValues, [
        "debtor",
        "invoiceNumber",
        "lastPaymentDate",
        "issueDate",
        "paymentDate",
        "amount",
        "outstandingBalance",
        "industry",
        "owner",
        "invoiceFile",
        "data",
        "invoiceOrderNumber",
        "status",
        "subject",
        "salutation",
        "greeting",
        "signature",
        "signatureName",
        "paymentControl",
        "faktooraId",
        "clientId"
      ])
    ).save()
    // Create document for invoice
    //
    let document = await Document.forge({
      user: invoice.attributes.owner,
      category: "invoice",
      customer: invoice.attributes.debtor || null,
      status: invoice.attributes.status,
      faktooraId: invoice.attributes.faktooraId,
      documentType: "invoice",
      reference_type: "invoice",
      reference_id: invoice.id
    }).save()

    // Create cover letter if necessary
    let letterSignatureIds = _.get(clearValues, "letter.signatures", []).filter(s => s !== null)
    let letterSignatures = (await common.generateSignatureData(letterSignatureIds, user)) || []
    let letterExtrasData = _.pick(clearValues, ["email", "telephone", "template", "formatting"])
    letterExtrasData.signatures = letterSignatures

    let letterModel
    if (clearValues.letter) {
      letterModel = await Letter.forge(
        _.assign({}, _.omit(clearValues.letter, "signatures"), {
          invoice: invoice.id,
          category: "letter",
          user: user.id,
          status: clearValues.status === "paidCash" ? "created" : clearValues.status,
          faktooraId: invoice.attributes.faktooraId,
          extras: letterExtrasData,
          clientId: invoice.attributes.clientId
        })
      ).save()

      await Document.forge({
        user: user.id,
        customer: letterModel.attributes.customer,
        category: "letter",
        documentType: "invoice",
        status: letterModel.attributes.status,
        reference_type: "letter",
        reference_id: letterModel.id,
        faktooraId: letterModel.attributes.faktooraId
      }).save()
    }
    if (_.includes(["created", "paid", "paidCash"], invoice.attributes.status)) {
      // Retrieve the invoice again because we need its related entities
      const current = await Invoice.forge({ id: invoice.id }).fetch({
        withRelated: ["debtor", "owner.companyLogo", "signature"]
      })
      let dataSentToWorker = current.toJSON()
      let userlogins = (user && user.toJSON().userlogins) || []
      dataSentToWorker.userlogin = _.find(userlogins, obj => obj.isMain)
      user && user.toJSON().legalform && (dataSentToWorker.owner.legalform = user && user.toJSON().legalform)
      //get document config
      let usersettingModel = await Usersetting.where({ user: user.id, key: "documentConfig" }).fetch()
      if (usersettingModel) {
        dataSentToWorker.documentSetting = usersettingModel.attributes.value || {
          footer: common.getDefaultFooterFieldTemplate(legalform.attributes.key)
        }
      } else {
        dataSentToWorker.documentSetting = { footer: common.getDefaultFooterFieldTemplate(legalform.attributes.key) }
      }
      dataSentToWorker.documentSetting.footer = common.bindingDataForFooter(dataSentToWorker.documentSetting.footer, {
        user: user.toJSON(),
        userlogin: dataSentToWorker.userlogin,
        primaryBankaccount: user && user.toJSON().primaryBankaccount
      })
      if (letterModel) {
        dataSentToWorker.letter = letterModel.toJSON()
        dataSentToWorker.letter.user = user.toJSON()
        dataSentToWorker.letter.customer = customerModel.toJSON()
        dataSentToWorker.letter.invoice = current.toJSON()
        dataSentToWorker.letter.template = dataSentToWorker.template
        dataSentToWorker.letter.documentSetting = dataSentToWorker.documentSetting
      }
      worker.makeInvoiceFile(dataSentToWorker)
      // add invoiceCount
      const statisticModel = await Usersetting.where({
        user: user.id,
        key: "userStatistics"
      }).fetch({ withRelated: ["user"] })

      if (!statisticModel) {
        let value = { invoiceCount: 1 }
        await Usersetting.forge({
          user: user.id,
          value: value,
          key: "userStatistics"
        }).save()
      } else {
        let value = statisticModel.attributes.value || {}
        value.invoiceCount = (value.invoiceCount && parseInt(value.invoiceCount) + 1) || 1
        await statisticModel.save({ value: value }, { patch: true })
      }
    }

    // save recent data
    user = ctx.session.passport.user
    let promises = []
    promises.push(
      common.savePreviousData({
        user,
        key: "previousProductName",
        content: invoicePositions.map(position => position.product)
      })
    )
    promises.push(
      common.savePreviousData({
        user,
        key: "previousUnitName",
        content: invoicePositions.map(position => position.unit)
      })
    )
    promises.push(common.savePreviousData({ user, key: "paymentTerms", content: clearValues.paymentterm }))
    promises.push(common.savePreviousData({ user, key: "postscriptText", content: clearValues.postscript }))
    if (_.isEmpty(_.get(clearValues, "fixing"))) {
      promises.push(
        common.savePreviousData({
          user,
          key: "introductionText",
          content: clearValues.introduction
        })
      )
    }
    // Overwrite default setting about template for all doccument
    promises.push(
      common.overwritePreviousData({
        user,
        key: "DocumentTemplateStyleAndColor",
        value: _.get(clearValues, "template")
      })
    )
    if (signatureIds) {
      let lastSignatureData = {
        user: user.id,
        key: "invoiceCreateLastUsedSignatures",
        value: JSON.stringify(signatureIds)
      }
      let lastSignature = await Usersetting.forge({ user: user.id, key: "invoiceCreateLastUsedSignatures" }).fetch()
      if (lastSignature) {
        await lastSignature.save(lastSignatureData, { patch: true })
      } else {
        await Usersetting.forge(lastSignatureData).save()
      }
    }
    await promises
    if (!clearValues.paidCash) {
      await common.overwritePreviousData({
        user,
        key: "paymentControl",
        value: _.get(clearValues, "paymentControl") || false
      })
    }

    document = await strapi.services.jsonapi.fetch(strapi.models.document, { id: document.id })

    // generated_document socket message must not be sent when there is a cover letter which needs merging first
    if (!clearValues.letter) {
      io.to(invoice.attributes.owner).emit("generated_document", document.toJSON())
    }
    return strapi.services.jsonapi.fetch(strapi.models.invoice, {
      id: invoice.id
    })
  },

  /**
   * Update an invoice
   */
  updateInvoice: async function(ctx) {
    const values = ctx.request.body
    const { id } = ctx.params
    let { isDraft } = ctx.query || {}
    isDraft = isDraft === "true"
    const schema = isDraft ? invoiceSchemaDraft : invoiceSchema
    const result = joi.validate(values, schema, {
      allowUnknown: false,
      abortEarly: false
    })

    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    const clearValues = result.value

    let invoice = await new Invoice({
      id: ctx.params.id,
      owner: ctx.session.passport.user.id
    }).fetch({ withRelated: ["invoicepositions", "invoiceFile", "letters"] }) // or null

    if (invoice === null) {
      throw new JsonApiError(`E_RESOURCE_NOT_EXISTS`, 404)
    }
    const calculateAmount = strapi.services.invoice.calculateAmount(
      clearValues.invoicePositions,
      (clearValues.totaldiscount && clearValues.totaldiscount.value) || 0,
      clearValues.deduction && clearValues.deduction.value
    )
    clearValues.amount = calculateAmount && calculateAmount.amount
    if (clearValues.status !== "paidCash" && clearValues.status !== "paid") {
      clearValues.outstandingBalance = calculateAmount && calculateAmount.outstandingBalance
    }
    // Check whether debtor exists
    let customerModel = await Customer.forge({
      id: clearValues.debtor || null
    }).fetch() // or null
    if (customerModel === null && !isDraft) {
      throw new JsonApiError("E_RESOURCE_NOT_EXISTS", 400, `Debtor with ID ${clearValues.debtor} does not exist`)
    }
    let debtorRegion = findState(customerModel && customerModel.get("postcode"))
    if (debtorRegion !== -1) {
      clearValues.debtorRegion = debtorRegion
    }
    clearValues.owner = ctx.session.passport.user.id
    let user = await User.forge({ id: clearValues.owner }).fetch({
      withRelated: ["legalform", "userlogins", "primaryBankaccount"]
    })
    const legalform = user.related("legalform")

    // and new data have new file or invoice positions
    if (clearValues.invoiceFile || clearValues.invoicePositions) {
      if (invoice.relations.invoicepositions) {
        await invoice.relations.invoicepositions.invokeThen("destroy")
      }

      // if (clearValues.invoicePositions) {
      //   // Create invoice positions
      //   for (let invoicePosition of clearValues.invoicePositions) {
      //     await invoice.invoicepositions().create(_.pick(invoicePosition, ["quantity", "price", "description", "tax"]))
      //   }
      // }

      // We had to comment this out because it leads to the document being deleted when we set
      // an invoice back to draft and the user creates it (again)
      /*if (invoice.attributes.invoiceFile) {
        // Check invoiceFile
        if (invoice.attributes.invoiceFile !== clearValues.invoiceFile) {
          await invoice.save({ invoiceFile: null }, { patch: true }).then(() => invoice.relations.invoiceFile.destroy())
        }
      }*/
    }
    const oldData = invoice.attributes.data || {}
    let dataValues = _.omit(clearValues, ["invoicePositions"])
    /* let templateArr = ['standard', 'classic', 'creative']
    let templateColorArr = ['#007990', '#e7d900', '#b70f0a', '#72bb53', '#ffffff']
    dataValues.template = {
      style: _.sampleSize(templateArr, 1)[0],
      color: _.sampleSize(templateColorArr, 1)[0]
    }*/

    // Handle signature data
    let signatureIds = _.get(clearValues, "signatures", []).filter(s => s !== null)
    let signatures = (await common.generateSignatureData(signatureIds, user)) || []

    dataValues.data = _.omit(
      _.assign(
        _.omit(oldData, ["deduction", "totaldiscount"]),
        _.pick(clearValues, [
          "totaldiscount",
          "deduction",
          "introduction",
          "postscript",
          "paymentterm",
          "invoicePositions",
          "email",
          "telephone",
          "paidCash",
          "template",
          "valueAddedTaxId",
          "deliveryDate",
          "hasArticleNumber",
          "isTaxExemptUser",
          "taxExemptHint",
          "fixing",
          "isDecimoMode"
        ])
      ),
      ["sent", "sendManually", "sendEmail", "sendPost"]
    )
    dataValues.data.signatures = signatures
    clearValues.invoiceNumberTemplate && (dataValues.data.invoiceNumber = clearValues.invoiceNumberTemplate)
    if (!dataValues.invoiceFile) {
      for (let invoicePosition of dataValues.data.invoicePositions) {
        invoicePosition.product = invoicePosition.description
        delete invoicePosition.description
      }
    }
    if (isDraft) {
      dataValues.status = "draft"
    } else {
      dataValues.status = clearValues.paidCash ? "paidCash" : "created"
    }
    // Paid cash invoices cant have payment control no matter what the frontend delivers
    if (clearValues.paidCash) {
      clearValues.paymentControl = false
    }

    invoice = await invoice.save(
      _.pick(dataValues, [
        "debtor",
        "invoiceNumber",
        "lastPaymentDate",
        "issueDate",
        "paymentDate",
        "amount",
        "outstandingBalance",
        "industry",
        "owner",
        "invoiceFile",
        "data",
        "invoiceOrderNumber",
        "paymentControl",
        "status"
      ]),
      { patch: true }
    )

    // #3210 - change contact in draft shows wrong name on page documents (incl. alls subpages)
    const documentInvoiceModel = await Document.where({
      documentType: "invoice",
      reference_type: "invoice",
      reference_id: invoice.get("id")
    }).fetch()
    if (documentInvoiceModel) {
      await documentInvoiceModel.save(
        {
          customer: clearValues.debtor
        },
        { patch: true }
      )
    }

    // Update the letter
    const letters = invoice.related("letters")
    let letterModel
    if (letters.models.length > 0) {
      letterModel = letters.models[0]
    }

    if (letterModel && letterModel.id && clearValues.letter) {
      await letterModel.save(
        {
          status: isDraft ? "draft" : "created",
          signatureName: clearValues.letter.signatureName || "",
          content: clearValues.letter.content || "",
          greeting: clearValues.letter.greeting || "",
          salutation: clearValues.letter.salutation || "",
          subject: clearValues.letter.subject || "",
          customer: clearValues.debtor,
          extras: _.assign({}, letterModel.attributes.extras, _.pick(clearValues, ["email", "telephone", "template"]))
        },
        { patch: true }
      )

      // #3210 - change contact in draft shows wrong name on page documents (incl. alls subpages)
      const documentInvoiceLetterModel = await Document.where({
        documentType: "invoice",
        reference_type: "letter",
        reference_id: letterModel.get("id")
      }).fetch()
      if (documentInvoiceLetterModel) {
        await documentInvoiceLetterModel.save(
          {
            customer: clearValues.debtor
          },
          { patch: true }
        )
      }

      // Create a cover letter during update after not creating one before
    } else if (!letterModel && clearValues.letter) {
      let newLetterModel = await Letter.forge({
        user: user.id,
        customer: clearValues.debtor,
        status: isDraft ? "draft" : "created",
        signatureName: clearValues.letter.signatureName || "",
        content: clearValues.letter.content || "",
        greeting: clearValues.letter.greeting || "",
        salutation: clearValues.letter.salutation || "",
        subject: clearValues.letter.subject || "",
        invoice: invoice.id,
        faktooraId: clearValues.faktooraId,
        category: "letter",
        extras: _.pick(clearValues, ["email", "telephone", "template"])
      }).save()

      // Create matching document
      await Document.forge({
        user: user.id,
        customer: newLetterModel.attributes.customer,
        category: "letter",
        documentType: "invoice",
        status: newLetterModel.attributes.status,
        reference_type: "letter",
        reference_id: newLetterModel.id,
        faktooraId: newLetterModel.attributes.faktooraId
      }).save()
      // Deleting a letter by deleting the document which refers to it
    } else if (letterModel && letterModel.id && !clearValues.letter) {
      let letterDocument = await new Document({ reference_type: "letter", reference_id: letterModel.id }).fetch()
      await letterDocument.destroy()
    }

    if (_.includes(["created", "paid", "paidCash"], invoice.attributes.status)) {
      // Retrieve the invoice again because we need its related entities
      const current = await Invoice.forge({ id: invoice.id }).fetch({
        withRelated: ["debtor", "owner.companyLogo", "signature"]
      })
      let dataSentToWorker = current.toJSON()
      let userlogins = (user && user.toJSON().userlogins) || []
      dataSentToWorker.userlogin = _.find(userlogins, obj => obj.isMain)
      user && user.toJSON().legalform && (dataSentToWorker.owner.legalform = user && user.toJSON().legalform)
      //get document config
      let usersettingModel = await Usersetting.where({ user: user.id, key: "documentConfig" }).fetch()
      if (usersettingModel) {
        dataSentToWorker.documentSetting = usersettingModel.attributes.value || {
          footer: common.getDefaultFooterFieldTemplate(legalform.attributes.key)
        }
      } else {
        dataSentToWorker.documentSetting = { footer: common.getDefaultFooterFieldTemplate(legalform.attributes.key) }
      }
      dataSentToWorker.documentSetting.footer = common.bindingDataForFooter(dataSentToWorker.documentSetting.footer, {
        user: user.toJSON(),
        userlogin: dataSentToWorker.userlogin,
        primaryBankaccount: user && user.toJSON().primaryBankaccount
      })
      if (letterModel && clearValues.letter) {
        dataSentToWorker.letter = letterModel.toJSON()
        dataSentToWorker.letter.user = user.toJSON()
        dataSentToWorker.letter.customer = customerModel.toJSON()
        dataSentToWorker.letter.invoice = current.toJSON()
        dataSentToWorker.letter.template = dataSentToWorker.template
        dataSentToWorker.letter.documentSetting = dataSentToWorker.documentSetting
      }
      worker.makeInvoiceFile(dataSentToWorker)
      // add invoiceCount
      const statisticModel = await Usersetting.where({
        user: user.id,
        key: "userStatistics"
      }).fetch({ withRelated: ["user"] })

      if (!statisticModel) {
        let value = { invoiceCount: 1 }
        await Usersetting.forge({
          user: user.id,
          value: value,
          key: "userStatistics"
        }).save()
      } else {
        let value = statisticModel.attributes.value || {}
        value.invoiceCount = (value.invoiceCount && parseInt(value.invoiceCount) + 1) || 1
        await statisticModel.save({ value: value }, { patch: true })
      }
    }

    // save recent data
    let promises = []
    user = ctx.session.passport.user
    promises.push(common.savePreviousData({ user, key: "paymentTerms", content: clearValues.paymentterm }))
    promises.push(common.savePreviousData({ user, key: "postscriptText", content: clearValues.postscript }))
    if (_.isEmpty(_.get(clearValues, "fixing"))) {
      promises.push(common.savePreviousData({ user, key: "introductionText", content: clearValues.introduction }))
    }
    // Overwrite default setting about template for all doccument
    promises.push(
      common.overwritePreviousData({
        user,
        key: "DocumentTemplateStyleAndColor",
        value: _.get(clearValues, "template")
      })
    )
    if (!clearValues.paidCash) {
      promises.push(
        common.overwritePreviousData({
          user,
          key: "paymentControl",
          value: _.get(clearValues, "paymentControl") || false
        })
      )
    }
    if (signatureIds) {
      let lastSignatureData = {
        user: user.id,
        key: "invoiceCreateLastUsedSignatures",
        value: JSON.stringify(signatureIds)
      }
      let lastSignature = await Usersetting.forge({ user: user.id, key: "invoiceCreateLastUsedSignatures" }).fetch()
      if (lastSignature) {
        await lastSignature.save(lastSignatureData, { patch: true })
      } else {
        await Usersetting.forge(lastSignatureData).save()
      }
    }
    await promises
    return strapi.services.jsonapi.fetch(strapi.models.invoice, { id })
  },
  publishAnInvoice: async function(ctx) {
    const values = ctx.request.body
    const user = ctx.session.passport.user
    const { id: invoiceId } = ctx.params
    const schema = joi.object().keys({
      amount: joi
        .number()
        .required()
        .positive()
        .max(999999.99),
      minimumBid: joi.number().max(joi.ref("amount")),
      selloutBid: joi
        .number()
        .min(joi.ref("minimumBid"))
        .max(joi.ref("amount")),
      sendInvoice: joi.boolean(),
      invoicePlusFile: joi.string().guid()
    })
    const result = joi.validate(values, schema, {
      allowUnknown: false,
      abortEarly: false
    })

    const currentPlan = await strapi.services.account.getCurrentPlan(ctx)

    // Only premium plan users may factor their invoices
    if (currentPlan.plan !== "premium") {
      throw new JsonApiError(
        `E_USER_NOT_PREMIUM`,
        403,
        "Nur Benutzer im Premium Tarif können die Factoring Funktion nutzen"
      )
    }

    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    const clearValues = result.value
    // checkout amount
    if (clearValues.amount < 100) {
      throw new JsonApiError(
        `E_INVOICE_AMOUNT_TOO_SMALL`,
        404,
        "Du kannst auf faktoora nur Rechnungen anbieten mit mit einer Summe von 100,00€ oder mehr"
      )
    } else if (clearValues.amount > 7500) {
      throw new JsonApiError(
        `E_INVOICE_AMOUNT_TOO_HIGH`,
        404,
        "Deine Rechnungssumme übersteigt dein aktuell hinterlegtes Limit. Bitte kontaktiere uns unter info@faktoora.com oder rufe uns unter 0800 555-222-0 an!"
      )
    }
    // checkout user is validate
    if (!user.isValidated) {
      throw new JsonApiError(
        `E_INVOICE_USER_NOT_VALIDATED`,
        404,
        "Deine Unterlagen befinden sich derzeit in der Bearbeitung. Nach erfolgreicher Prüfung kannst Du hier mit dem Verkaufsprozess fortfahren"
      )
    }
    // checkout owner
    let invoice = await new Invoice({
      id: invoiceId,
      owner: ctx.session.passport.user.id
    }).fetch() // or null

    if (invoice === null) {
      throw new JsonApiError(`E_RESOURCE_NOT_EXISTS`, 404)
    }

    if (invoice.paymentControl === false) {
      throw new JsonApiError(
        `E_CANT_FACTOR_NON_PAYMENT_CONTROL`,
        403,
        "Nur Rechnungen mit Payment Control können gefactored werden."
      )
    }

    // validate lastPaymentDate
    let todayTimestamp = new Date().getTime()
    let dueDateTimestamp = new Date(invoice.attributes.lastPaymentDate).getTime()
    if (dueDateTimestamp - todayTimestamp < 0) {
      throw new JsonApiError(
        `E_INVOICE_OVERDUE_DATE`,
        404,
        "Sie können eine überfällige Rechnung nicht auf faktoora anbieten"
      )
    }

    // let customerModel = await Customer.query({
    //   where: { id: invoice.attributes.debtor }
    // }).fetch() // or null
    // const customerAttrs = customerModel.attributes

    // let id
    // if (customerAttrs.isCompany === true) {
    //   id = { companyName: customerAttrs.name }
    // } else {
    //   id = {
    //     firstName: customerAttrs.firstName,
    //     lastName: customerAttrs.lastName,
    //     sex: customerAttrs.gender
    //   }
    // }

    // const street = customerAttrs.address
    // const address = {
    //   street,
    //   postalCode: customerAttrs.postcode,
    //   city: customerAttrs.city
    // }

    clearValues.invoice = invoice.id
    clearValues.debtorRating = "0.0"
    let invoiceSaleData = _.pick(clearValues, [
      "invoice",
      "debtorRating",
      "debtorRegion",
      "minimumBid",
      "selloutBid",
      "sendInvoice",
      "sentInvoice"
    ])
    let invoicesaleModel
    if (!invoice.attributes.invoicesale) {
      invoicesaleModel = await Invoicesale.forge(invoiceSaleData).save()
      await invoice.save(
        {
          invoicesale: invoicesaleModel.id,
          status: "review",
          invoicePlusFile: clearValues.invoicePlusFile
        },
        { patch: true }
      )
    } else {
      invoicesaleModel = await Invoicesale.forge({
        id: invoice.attributes.invoicesale
      }).fetch()
      await invoicesaleModel.save(invoiceSaleData, { patch: true })
    }

    // GA log publish invoice
    // find user
    // let userModel = await User.forge({ id: user.id }).fetch()
    // GA log create invoice
    let visitor = ua(strapi.config.environments[strapi.config.environment].gaId, `${user.id}`)
    visitor
      .event(
        "Invoice",
        "Invoice Factored",
        "User factored an invoice",
        /* {
        user: userModel.attributes.companyName,
        amount: clearValues.amount,
        minBid: clearValues.minimumBid,
        selloutBid: clearValues.selloutBid
      }, */
        err => {
          if (err) console.log("err:", err)
        }
      )
      .send()

    return invoice
  },
  getDemandInvoices: async function(ctx) {
    let userId = ctx.session.passport.user.id
    let params = ctx.query
    // parsing param
    let parsedParams = {}
    _.keys(params).forEach(key => {
      _.set(parsedParams, key, params[key])
    })
    // Pagination
    let pageOptions = parsedParams.page || {}
    let page = parseInt(pageOptions.number, 10) || 1
    let pageSize = parseInt(pageOptions.size, 10) || 25
    // sorting
    if (parsedParams.sort && parsedParams.sort.indexOf(",") > 0) {
      parsedParams.sort = parsedParams.sort.split(",")
    } else {
      parsedParams.sort = [parsedParams.sort]
    }
    let sortItems = parsedParams.sort
    // filter
    let filterParams = parsedParams.filter
    // build query
    let invoiceTableName = strapi.models.invoice.collectionName
    let bidTableName = strapi.models.bid.collectionName
    let invoicesaleTableName = strapi.models.invoicesale.collectionName
    let userTableName = strapi.models.user.collectionName

    let queryModel = Invoice.query(function(qb) {
      let distinctFields = [`${invoiceTableName}.*`]
      if (!_.isEmpty(sortItems)) {
        sortItems.forEach(sortItem => {
          let sortOption = sortItem.replace("-", "").replace("+", "")
          if (sortOption.indexOf(".") >= 0) {
            distinctFields.push(sortOption)
          } else {
            distinctFields.push(`${invoiceTableName}.${sortOption}`)
          }
        })
      }
      qb.distinct(distinctFields)
      qb.leftJoin(`${bidTableName}`, `${invoiceTableName}.invoicesale`, `${bidTableName}.invoicesale`)
      qb.leftJoin(`${invoicesaleTableName}`, `${invoicesaleTableName}.id`, `${invoiceTableName}.invoicesale`)
      qb.leftJoin(`${userTableName}`, `${userTableName}.id`, `${invoiceTableName}.owner`)
      let whereParams = (filterParams && filterParams.where) || {}
      let andWhereParams = filterParams && filterParams.andwhere
      let orWhereParams = filterParams && filterParams.orwhere
      qb.where(function() {
        this.where(`${invoicesaleTableName}.buyer`, "=", userId)
        this.orWhere(function() {
          this.where(`${bidTableName}.bidder`, userId)
        })
      })
      qb.andWhere(function() {
        if (!andWhereParams && orWhereParams) {
          andWhereParams = _.assign({}, orWhereParams)
          orWhereParams = null
        } else if (orWhereParams) {
          orWhereParams = _.assign({}, whereParams, orWhereParams)
        } else {
          orWhereParams = null
        }
        andWhereParams = _.assign({}, whereParams, andWhereParams)
        this.where(function() {
          builderQuery(this, andWhereParams)
        })
        if (orWhereParams) {
          this.orWhere(function() {
            builderQuery(this, orWhereParams)
          })
        }
      })
    })
    !_.isEmpty(sortItems) &&
      sortItems.forEach(sortItem => {
        queryModel = queryModel.orderBy(sortItem)
      })
    let invoiceModel = await queryModel.fetchPage({
      pageSize: pageSize, // Defaults to 10 if not specified
      page: page, // Defaults to 1 if not specified
      withRelated: ["invoicesale", "industry", "owner", "debtor"]
    })
    let data = (invoiceModel && invoiceModel.toJSON()) || []
    for (let i = 0, len = data.length; i < len; i++) {
      let invoiceObj = data[i]
      let bidModel = await Bid.forge({
        invoicesale: invoiceObj.invoicesale.id,
        bidder: userId
      })
        .orderBy("amount", "DESC")
        .fetch()
      invoiceObj.bidderId = (bidModel && bidModel.attributes && bidModel.attributes.bidder) || null
      let bidHighestModel = await Bid.forge({
        invoicesale: invoiceObj.invoicesale.id
      })
        .orderBy("amount", "DESC")
        .fetch()
      invoiceObj.highestBidderId =
        (bidHighestModel && bidHighestModel.attributes && bidHighestModel.attributes.bidder) || null
    }
    data.pagination = invoiceModel.pagination

    return data
  },
  calculateAmount: function(invoicePositions, discountNumber, deduction) {
    let subTotalAmount, taxOneAmount, taxTwoAmount, taxZeroAmount
    const discount = (discountNumber || 0) / 100
    const scaleDiscount = 1 - (discountNumber || 0) / 100
    if (!_.isEmpty(invoicePositions)) {
      invoicePositions.map((invoice, index) => {
        let price = invoicePositions[index].price || 0
        let quantity = invoicePositions[index].quantity || 0
        let total = price * quantity
        subTotalAmount = (subTotalAmount || 0) + total
        if (parseInt(invoicePositions[index].tax) === 7) {
          taxOneAmount = (taxOneAmount || 0) + total
        }
        if (parseInt(invoicePositions[index].tax) === 19) {
          taxTwoAmount = (taxTwoAmount || 0) + total
        }
        if (parseInt(invoicePositions[index].tax) === 0) {
          taxZeroAmount = (taxZeroAmount || 0) + total
        }
      })
    }
    const amount =
      (subTotalAmount * scaleDiscount || 0) +
        (taxOneAmount * scaleDiscount * 0.07 || 0) +
        (taxTwoAmount * scaleDiscount * 0.19 || 0) || 0
    return {
      amount,
      taxZeroAmount: taxZeroAmount * scaleDiscount,
      taxOneAmount: taxOneAmount * scaleDiscount,
      taxTwoAmount: taxTwoAmount * scaleDiscount,
      discountAmount: subTotalAmount * discount,
      outstandingBalance: amount - (deduction || 0),
      taxes:
        (taxZeroAmount * scaleDiscount || 0) + (taxOneAmount * scaleDiscount || 0) + (taxTwoAmount * scaleDiscount || 0)
    }
  },
  calculateEpostCosts: async function(faktoorId, category) {
    let documentModel = await Document.query(qb => {
      qb.where("faktooraId", faktoorId)
      if (category) {
        qb.andWhere("category", category)
      }
      // qb.debug(true)
    }).fetchAll()

    let eposts = []
    let countEpost = 0
    let documents = (documentModel && documentModel.toJSON()) || {}
    _.map(documents, document => {
      let data = (document.extras && document.extras.sent) || {}
      let epostSend = _.filter(data, o => o.type === "post") || []
      eposts = _.merge(eposts, epostSend)
      countEpost = countEpost + (eposts.length || 0)
    })

    let price = 1.95
    return {
      amount: countEpost, // number of remaining objects (sent epost letters)
      price: price,
      total: countEpost * price,
      letters: eposts // the sentLetters array we filtered before and enriched with the category :)
    }
  },
  sendInvoice: async function(ctx) {
    const { sendEmail, sendLetter, sendManually, invoiceId } = ctx.request.body
    const user = ctx.session.passport.user
    const invoiceModel = await Invoice.forge({
      id: invoiceId,
      owner: user.id
    }).fetch({
      withRelated: ["statusUpdates"]
    })
    if (!invoiceModel) {
      throw new JsonApiError(`E_VALIDATION`, 400, "No invoice found!")
    }
    if (["created", "sent", "overdue"].indexOf(invoiceModel.attributes.status) === -1) {
      throw new JsonApiError(`E_VALIDATION`, 400, "Only send invoice with status created, sent, overdue")
    }
    const invoice = invoiceModel.toJSON()
    const statusUpdates = invoice.statusUpdates || []
    const isSent = _.find(statusUpdates, statusItem => statusItem.newStatus === "sent")

    if (["sent", "overdue"].indexOf(invoiceModel.attributes.status) !== -1 && !isSent) {
      throw new JsonApiError(`E_VALIDATION`, 400, "Only re-send invoice with status sent, overdue")
    }

    if (sendEmail) {
      return this.sendInvoiceByEmail(ctx)
    }
    if (sendLetter) {
      return this.sendInvoiceByPost(ctx)
    }
    if (sendManually) {
      return this.sendInvoiceByManual(ctx)
    }
    return {}
  },
  sendInvoiceByEmail: async function(ctx) {
    const {
      invoiceId,
      customerEmail,
      recipients,
      copyMyEmailAddress,
      senderName,
      subject,
      attachments,
      bodyMessage,
      mainAttachment
    } = ctx.request.body
    const user = ctx.session.passport.user
    const invoiceModel = await Invoice.forge({
      id: invoiceId,
      owner: user.id
    }).fetch({
      withRelated: ["debtor", "invoiceFile", "owner"]
    })
    const invoice = invoiceModel.toJSON()
    let documentModel = await Document.where({ reference_id: invoiceModel.id, reference_type: "invoice" }).fetch()
    let document = documentModel.toJSON()
    const debtor = invoice.debtor
    let data = invoice.data || { sent: [] }
    data.sent = (document.extras && document.extras.sent) || data.sent || []
    data.sendEmail = true
    // Handle attachments
    let emailAttachments = []
    const mainAttachmentFile = await common.getFileWithFullPath(mainAttachment)
    emailAttachments.push(
      _.assign(mainAttachmentFile, {
        path: mainAttachmentFile.fullFilePath
      })
    )

    if (attachments) {
      attachments.map(async attachment => {
        const attachmentFile = await common.getFileWithFullPath(attachment.file)
        emailAttachments.push(
          _.assign(attachmentFile, {
            path: attachmentFile.fullFilePath,
            text: attachment.text
          })
        )
      })
    }
    // Get company name
    const userModel = await User.forge({ id: user.id }).fetch({ withRelated: ["legalform"] })
    const companyName = common.determineCompanyNameWithLegalform(
      userModel.attributes.companyName,
      userModel.related("legalform").toJSON()
    )
    // Handle recipients
    const cc = []
    const bcc = []
    if (recipients) {
      recipients.map(recipient => {
        if (recipient.type === "cc") {
          cc.push(recipient.mail)
        }
        if (recipient.type === "bcc") {
          bcc.push(recipient.mail)
        }
      })
    }
    if (copyMyEmailAddress) {
      bcc.push(user.email)
    }
    // send mail for invoice delivery
    const sentEmailObj = await Email.forge({
      data: {
        subject: subject || data.subject || `app.notification.invoiceSendDebtor.summary`,
        content: bodyMessage || `app.notification.invoiceSendDebtor.text`,
        debtor,
        owner: invoice.owner,
        name: debtor.name,
        companyName,
        invoiceNumber: invoice.invoiceNumber,
        street: _.get(invoice, "owner.street"),
        postcode: _.get(invoice, "owner.postcode"),
        city: _.get(invoice, "owner.city"),
        noGender: debtor.gender === null,
        isMale: debtor.gender === "male",
        ownerEmail: user.email
      },
      from: senderName,
      to: customerEmail || debtor.email,
      attachments: JSON.stringify(emailAttachments),
      template: "customer",
      cc: cc,
      bcc: bcc
    }).save()
    const sentEmail = sentEmailObj.toJSON()
    // Store email data to document
    data.sent.push({
      type: "email",
      date: sentEmail.created_at,
      email: _.omit(sentEmail, ["data.debtor", "data.owner"]),
      sender: user.id,
      category: "invoice"
    })
    // only update if status is created
    // if (invoice.status === "created") {
    await invoiceModel.save({ data, status: "sent" }, { patch: true })
    // }
    // update to the main document of invoice
    await documentModel.save(
      { extras: _.assign(document.extras, _.pick(data, ["sent", "sendEmail"])) },
      { patch: true }
    )
    // Send notification implying how the invoice was sent
    await Notification.forge({
      type: "sendInvoiceEmail",
      recipient: user.id,
      skipEmail: true,
      invoice: invoiceModel.id,
      data: {
        invoiceNumber: invoiceModel.attributes.invoiceNumber,
        faktooraId: invoiceModel.attributes.faktooraId,
        debtorName: debtor.name
      }
    }).save()

    return {
      document: documentModel,
      email: sentEmail
    }
  },
  sendInvoiceByPost: async function(ctx) {
    const { invoiceId } = ctx.request.body
    const user = ctx.session.passport.user
    const invoiceModel = await Invoice.forge({
      id: invoiceId,
      owner: user.id
    }).fetch({
      withRelated: ["debtor", "invoiceFile"]
    })
    const invoice = invoiceModel.toJSON()
    let documentModel = await Document.where({ reference_id: invoiceModel.id, reference_type: "invoice" }).fetch()
    let document = documentModel.toJSON()
    const debtor = invoice.debtor
    let data = invoice.data || { sent: [] }
    data.sent = (document.extras && document.extras.sent) || data.sent || []
    data.sent.push({ type: "post", date: new Date(), sender: user.id, category: "invoice" })
    data.sendPost = true
    // Prepare data
    const attachmentFile = _.get(document, "attributes.extras.printFile") || invoice.invoiceFile
    const file = await common.getFileWithFullPath(attachmentFile)
    const address = common.getAddress(debtor.address)
    let recipient = {
      salutation: debtor.gender === "male" ? "Herr" : "Frau",
      title: "",
      firstName: debtor.firstName,
      lastName: debtor.lastName,
      company: debtor.name,
      streetName: address.street,
      houseNumber: address.houseNumber,
      city: debtor.city,
      zipCode: debtor.postcode
    }
    if (debtor.isCompany) {
      recipient = _.omit(recipient, ["salutation", "firstName", "lastName"])
    } else {
      recipient = _.omit(recipient, ["company"])
    }
    // Determine subject
    const subject = strapi.i18n.__("app.notification.invoiceSendDebtor.summary")
    // await - don't wait anymore for it
    worker.sendEpost({ invoice, recipient, subject, filePath: file.fullFilePath })
    // only update if status is created
    // if (invoice.status === "created") {
    await invoiceModel.save({ data, status: "sent" }, { patch: true })
    // }
    // update to the main document of invoice
    await documentModel.save({ extras: _.assign(document.extras, _.pick(data, ["sendPost", "sent"])) }, { patch: true })

    await Notification.forge({
      type: "sendInvoiceEpost",
      recipient: user.id,
      skipEmail: true,
      invoice: invoiceModel.id,
      data: {
        invoiceNumber: invoiceModel.attributes.invoiceNumber,
        faktooraId: invoiceModel.attributes.faktooraId,
        debtorName: debtor.name
      }
    }).save()

    return { document: documentModel }
  },
  sendInvoiceByManual: async function(ctx) {
    const { invoiceId } = ctx.request.body
    const user = ctx.session.passport.user
    const invoiceModel = await Invoice.forge({
      id: invoiceId,
      owner: user.id
    }).fetch()
    const invoice = invoiceModel.toJSON()
    let documentModel = await Document.where({ reference_id: invoiceModel.id, reference_type: "invoice" }).fetch()
    let document = documentModel.toJSON()
    const debtor = invoice.debtor
    let data = invoice.data || { sent: [] }
    data.sent = (document.extras && document.extras.sent) || data.sent || []
    data.sendManually = true
    // only update if status is created
    // if (invoice.status === "created") {
    await invoiceModel.save({ data, status: "sent" }, { patch: true })
    // }
    // update to the main document of invoice
    await documentModel.save(
      { extras: _.assign(document.extras, _.pick(data, ["sent", "sendManually"])) },
      { patch: true }
    )

    await Notification.forge({
      type: "sendInvoiceManually",
      recipient: user.id,
      skipEmail: true,
      invoice: invoiceModel.id,
      data: {
        invoiceNumber: invoiceModel.attributes.invoiceNumber,
        faktooraId: invoiceModel.attributes.faktooraId,
        debtorName: debtor.name
      }
    }).save()

    return { document: documentModel }
  },

  /**
   *
   * @param  {String} userId User to create the settlement for
   * @param  {Date} date
   *
   */
  createMonthlySellerSettlement: async function(userId /*, date*/) {
    const userModel = await User.forge({ id: userId }).fetch({ withRelated: ["userlogins"] })

    // temp fixed value
    // date = new Date("2017-12-02")

    // Find out debtorname from main userlogin
    //
    const userLoginModels = userModel.related("userlogins")
    const mainUserLogin = userLoginModels.filter(item => item.attributes.isMain === true)
    const debtorName = mainUserLogin[0].attributes.firstName

    // 1. Determine all seller fee transaction
    //
    // const startOfMonth = moment(date).startOf("month")
    // const endOfMonth = moment(date).endOf("month")

    // const transactions = await Transaction.forge()
    //   .query(qb => {
    //     qb.whereBetween("created_at", [startOfMonth, endOfMonth])
    //     //qb.andWhere("feePaymentType", "SELLER_FEE")
    //     //qb.andWhere("benefactor", userId)
    //   })
    //   .fetchAll()

    // 2. Determine plan bookings this month
    //
    // const subscriptionModels = await Subscription.where({ user: userId })
    //   .query(qb => {
    //     qb.whereBetween("created_at", [startOfMonth, endOfMonth])
    //   })
    //   .fetchAll()

    // 3. Determine additional fees (for post services)
    //
    // We need to fetch all documents because the user may send even old letters via epost
    // const documents = await Document.where({ user: userId }).fetchAll()
    //.query(qb => {
    //  qb.whereBetween("created_at", [startOfMonth, endOfMonth])
    //})

    // 4. Determine which plan was active at which time
    //const subscriptionModels = await Subscription.forge({ user: userId }).fetchAll()
    //const plans active this month

    let data = {}
    data.type = "settlement"
    data.subject = "Monatsabrechnung Dezember 2017"
    data.debtor = userModel.toJSON()
    data.debtorName = debtorName
    data.date

    const SETTLEMENT_TEST = {
      id: "dd33557a-0e5a-48ed-a126-c952ac311c9f",
      amount: "16650.00",
      issueDate: "2018-01-01T17:00:00.000Z",
      invoiceNumber: "FKTF3FLKV",
      data: {
        invoicePositions: [
          {
            tax: 19,
            price: 4.33,
            quantity: 1,
            product: "Gebühren für die Zahlungsabwicklung der Rechnung F45NNA1"
          },
          {
            tax: 19,
            price: 9.0,
            quantity: 1,
            product: `monatliche Gebühr für den Tarif Basic`
          },
          {
            tax: 19,
            price: 4.33,
            quantity: 1,
            product: "Gebühren für die Zahlungsabwicklung der Rechnung FHU77GV"
          },
          {
            tax: 19,
            price: 1.5,
            quantity: 4,
            product: "Versand ePost Brief"
          }
        ]
      },
      lastPaymentDate: "2017-05-19T17:00:00.000Z"
      /*debtor: {
        id: "2b67f588-10a6-48d0-aa8d-b91c328498f1",
        created_at: "2017-05-18T03:23:20.803Z",
        updated_at: "2017-05-18T03:23:20.803Z",
        isCompany: true,
        name: "Seller GmbH",
        firstName: null,
        lastName: null,
        nameAuthorisedSignatory: "Michael Mickartz",
        address: "Hertzstraße 3",
        postcode: "12345",
        city: "Aschaffenburg",
        email: "test1@test.com",
        customerId: "K384348",
        note: null,
        vatId: null,
        taxId: null,
        phoneNo: "04822 52 04 46",
        faxNo: null,
        gender: null,
        user: "db279af2-870c-458c-93b2-33c75c1b2437",
        legalform: "d369c60e-6ae1-481d-aa5e-447c137154d8"
      }*/
    }

    data = Object.assign(data, SETTLEMENT_TEST)

    worker.generateMonthlySellerSettlement(data)

    // 297,5/119*100 = 250

    // Welches Datum zählt?
    // 1. Wenn Rechnung bezahlt wurde von Debitor
    // 2. Wenn Rechnung bezahlt wurde von Käufer

    // TODO get all invoices from that month?

    // Total fees

    // Already paid

    // Total sum
  },
  /**
   * Creates a PDF invoice for the seller
   * @param  {[type]} invoiceId [description]
   * @return {[type]}           [description]
   */
  createSellerInvoice: async function(invoiceId) {
    // Get user and userlogin for invoice
    const invoice = await Invoice.where("id", invoiceId).fetch({
      withRelated: ["owner.userlogins", "invoicesale.winningBid"]
    })
    console.log(`Generating seller invoice for invoice ID ${invoice.attributes.faktooraId}`)
    const seller = invoice.related("owner")
    const userlogins = seller.related("userlogins")
    const userlogin = _.find(userlogins.models, item => {
      return item.attributes.isMain === true
    })
    const invoicePrice = Number(invoice.related("invoicesale").related("winningBid").attributes.amount)

    // Calculate fees and taxes
    const fee = Number(Number(Number(invoicePrice) * 0.01).toFixed(2))
    let grossFee = fee + 3.5
    let postalFee = null
    if (invoice.attributes.data.sendPost === true) {
      postalFee = 1.95
      grossFee += postalFee
    }
    const taxFee = Number(Number(grossFee * 0.19).toFixed(2))
    const totalFee = grossFee + taxFee

    //

    // The reply needs to handled elsewhere since its triggered by the worker
    await worker.generateInvoice({
      type: "sellerInvoice",
      userlogin: userlogin.toJSON(),
      user: seller.toJSON(),
      invoice: invoice.toJSON(),
      fee,
      invoicePrice,
      postalFee,
      grossFee,
      taxFee,
      totalFee
    })
  },
  /**
   * Pass invoice to inkasso partner
   */
  confirmBuyerCanPay: async function(ctx) {
    const { id: invoiceId } = ctx.params
    const user = ctx.session.passport.user
    // checkout owner
    let invoiceModel = await new Invoice({
      id: invoiceId,
      owner: user.id
    }).fetch({ withRelated: ["invoiceFile", "owner", "debtor"] })
    const owner = invoiceModel.related("owner")
    const debtor = invoiceModel.related("debtor")

    const debtorName = debtor.attributes.name
    const debtorType = debtor.attributes.isCompany ? "Unternehmen" : "Einzelperson"
    const faktooraId = invoiceModel.attributes.faktooraId

    if (invoiceModel === null) {
      throw new JsonApiError(`E_RESOURCE_NOT_EXISTS`, 404)
    }

    invoiceModel.save({ status: "inkasso" })
    // send email to faktoora
    try {
      let attachments
      const invoice = invoiceModel.toJSON()

      const invoiceFile = invoice.invoiceFile
      const filePath =
        invoiceFile &&
        invoiceFile.filename &&
        invoiceFile.path &&
        path.join(strapi.config.environments[strapi.config.environment].uploadFolder, invoiceFile.path, invoiceFile.filename)

      if (filePath) {
        attachments = JSON.stringify([{ path: filePath, filename: invoiceFile.filename }])
      }

      await Email.forge({
        data: {
          subject: `app.notification.collectionDebt.summary`,
          content: `app.notification.collectionDebt.text`,
          companyName: owner.attributes.companyName,
          debtorName,
          debtorType,
          faktooraId
        },
        to: "testme@faktoora.com",
        attachments,
        template: "collectiondebt"
      }).save()
    } catch (err) {
      console.log("Error during creation of Notifcation", err)
    }

    return invoiceModel
  },
  search: async function(ctx) {
    let parsedParams = {}
    _.keys(ctx.query).forEach(key => {
      _.set(parsedParams, key, ctx.query[key])
    })
    let needle = ctx.params.needle
    let id = ctx.params.id
    const userId = ctx.session.passport.user.id
    const customerTableName = strapi.models.customer.collectionName
    const invoiceTableName = strapi.models.invoice.collectionName
    const letterTableName = strapi.models.letter.collectionName
    let sortBy = parsedParams.sort || "-invoiceNumber"
    let queryModel = Invoice.forge()
    queryModel = queryModel
      .query(qb => {
        qb.distinct()
        qb.leftJoin(`${customerTableName}`, `${customerTableName}.id`, `${invoiceTableName}.debtor`)
        // last reminder
        qb.leftJoin(
          strapi.connections.default.raw(
            '"letter" ON "letter"."invoice" = "invoice"."id" AND "letter"."sentDate" = (SELECT MAX("sentDate") FROM "letter" WHERE "invoice" = "invoice"."id")'
          )
        )
        qb.where(function() {
          this.where(`${invoiceTableName}.owner`, "=", userId)
          this.andWhere(function() {
            this.whereIn(`${invoiceTableName}.status`, ["overdue"])
          })
          this.andWhere(`${invoiceTableName}.lastPaymentDate`, "<", new Date())
          if (!id) {
            this.andWhere(function() {
              this.where(`${letterTableName}.sentDate`, "<", new Date())
              this.orWhereNull(`${letterTableName}.sentDate`)
            })
          } else {
            this.andWhere(`${letterTableName}.invoice`, "=", id)
          }
        })
        if (needle) {
          needle = `%${needle}%`
          qb.andWhere(function() {
            this.where(`${customerTableName}.name`, "ILIKE", needle).orWhere("nameAuthorisedSignatory", "ILIKE", needle)
            this.orWhere(`${customerTableName}.address`, "ILIKE", needle)
            this.orWhere(`${invoiceTableName}.invoiceNumber`, "ILIKE", needle)
          })
        }
      })
      .orderBy(sortBy)
    const pageOptions = parsedParams.page || {}
    const pageNumber = parseInt(pageOptions.number, 10) || 1
    const pageSize = parseInt(pageOptions.size, 10) || 100000
    return queryModel.fetchPage({
      pageSize,
      page: pageNumber,
      withRelated: ["debtor", "letters"]
    })
  },
  /**
   * Generates a CSV export of an invoice dynamically
   * @param  {[type]} query [description]
   * @return {[type]}       [description]
   */
  exportCsv: async function(ctx) {
    const { id } = ctx.params
    // Retrieve invoice from db
    const invoice = await Invoice.where("id", id).fetch({
      withRelated: ["debtor", "owner.userlogins", "owner.primaryBankaccount"]
    })
    if (_.get(invoice, "attributes.owner") !== ctx.session.passport.user.id) {
      throw new JsonApiError("E_USER_NOT_OWNER", 400, `User is not invoice owner`)
    }

    // related entities which represent the content on invoice
    const owner = invoice.related("owner")
    // const userlogins = owner.related("userlogins")
    const debtor = invoice.related("debtor")
    const primaryBankaccount = owner.related("primaryBankaccount")

    var jsonToCsv = {
      // object can be easy converted to csv and automatically take row names.
      Artikel: invoice.attributes.data.invoicePositions,
      Gesamtbetrag: invoice.attributes.amount,
      faktooraId: invoice.attributes.faktooraId,
      Zahlungsbedingung: invoice.attributes.data.paymentterm,
      Rechnungsnummer: invoice.attributes.invoiceNumber,
      Auftragsnummer: invoice.attributes.invoiceOrderNumber,
      Ausstelldatum: invoice.attributes.issueDate,
      zahlbar_bis: invoice.attributes.lastPaymentDate,
      Postscript: invoice.attributes.data.postscript,

      Verkaeufer: owner.attributes.companyName,
      Straße: owner.attributes.street,
      PLZ: owner.attributes.postcode,
      Stadt: owner.attributes.city,
      Tel: owner.attributes.phone,

      Bank: primaryBankaccount.attributes.holderName,
      IBAN: primaryBankaccount.attributes.iban,
      BIC: primaryBankaccount.attributes.bic,

      Kaeufer: debtor.attributes.nameAuthorisedSignatory,
      Unternehmen: debtor.attributes.nameAuthorisedSignatory,
      Adresse: debtor.attributes.address,
      PLZ_2: debtor.attributes.postcode,
      Stadt_2: debtor.attributes.city,
      Tel_2: debtor.attributes.phoneNo,
      Email: debtor.attributes.email
    }
    // fields can be used as property in csvResult if needed and any rows need to be named different
    /*var fields = [
      //object can be easy converted to csv and automatically take row names.
      'Artikel',
      'Gesamtbetrag',
      'faktooraId',
      'Zahlungsbedingung',
      'Rechnungsnummer',
      'Auftragsnummer',
      'Ausstelldatum',
      'zahlbar_bis',
      'Postscript',

      'Verkaeufer',
      'Straße',
      'PLZ',
      'Stadt',
      'Tel',

      'Bank',
      'IBAN',
      'BIC',

      'Kaeufer',
      'Unternehmen',
      'Adresse',
      'PLZ_2',
      'Stadt_2',
      'Tel_2',
      'Email'
    ]*/

    var csvResult = json2csv({ data: jsonToCsv })
    return csvResult
  },
  /**
   * Generates a CSV export of all invoices dynamically
   * @param  {[type]} query [description]
   * @return {[type]}       [description]
   */
  exportAllCsv: async function(ctx) {
    // const { id } = ctx.params
    // Retrieve invoice from db
    const invoice = await Invoice.where("owner", ctx.session.passport.user.id).fetchAll()
    debugger
    var csvInvoices = invoice.models.map(obj => {
      return {
        Artikel: _.get(obj, "attributes.data.invoicePositions") || "unbekannt",
        Gesamtbetrag: _.get(obj, ".attributes.amount") || "unbekannt",
        faktooraId: _.get(obj, "attributes.faktooraId") || "unbekannt",
        Zahlungsbedingung: _.get(obj, "attributes.data.paymentterm") || "unbekannt",
        Rechnungsnummer: _.get(obj, "attributes.invoiceNumber") || "unbekannt",
        Auftragsnummer: _.get(obj, "attributes.invoiceOrderNumber") || "unbekannt",
        Ausstelldatum: _.get(obj, "attributes.issueDate") || "unbekannt",
        zahlbar_bis: _.get(obj, "attributes.lastPaymentDate") || "unbekannt",
        Postscript: _.get(obj, "attributes.data.postscript") || "unbekannt",

        Verkaeufer: _.get(obj, "relations.owner.attributes.companyName") || "unbekannt",
        Straße: _.get(obj, "relations.owner.attributes.street") || "unbekannt",
        PLZ: _.get(obj, "relations.owner.attributes.postcode") || "unbekannt",
        Stadt: _.get(obj, "relations.owner.attributes.city") || "unbekannt",
        Tel: _.get(obj, "relations.owner.attributes.phone") || "unbekannt",
        Bank: _.get(obj, "relations.owner.relations.primaryBankaccount.attributes.holderName") || "unbekannt",
        IBAN: _.get(obj, "relations.owner.relations.primaryBankaccount.attributes.iban") || "unbekannt",
        BIC: _.get(obj, "relations.owner.relations.primaryBankaccount.attributes.bic") || "unbekannt",

        Kaeufer: _.get(obj, "relations.debtor.attributes.nameAuthorisedSignatory") || "unbekannt",
        Unternehmen: _.get(obj, "relations.debtor.attributes.nameAuthorisedSignatory") || "unbekannt",
        Adresse: _.get(obj, "relations.debtor.attributes.address") || "unbekannt",
        PLZ_2: _.get(obj, "relations.debtor.attributes.postcode") || "unbekannt",
        Stadt_2: _.get(obj, "obj.relations.debtor.attributes.city") || "unbekannt",
        Tel_2: _.get(obj, "relations.debtor.attributes.phoneNo") || "unbekannt",
        Email: _.get(obj, "relations.debtor.attributes.email") || "unbekannt"
      }
    })

    var csvAllResult = json2csv({ data: csvInvoices, withBOM: true })
    return csvAllResult
  },
  /**
   * Generates a XLS export of an invoice dynamically
   * @param  {[type]} query [description]
   * @return {[type]}       [description]
   */
  exportXls: async function(ctx) {
    const { id } = ctx.params
    console.log("starting xls export!")
    // Retrieve invoice from db
    const invoice = await Invoice.where("id", id).fetch({
      withRelated: ["debtor", "owner.userlogins", "owner.primaryBankaccount"]
    })
    if (_.get(invoice, "attributes.owner") !== ctx.session.passport.user.id) {
      throw new JsonApiError("E_USER_NOT_OWNER", 400, `User is not invoice owner`)
    }

    // related entities which represent the content on invoice
    const owner = invoice.related("owner")
    // const userlogins = owner.related("userlogins")
    const debtor = invoice.related("debtor")
    const primaryBankaccount = owner.related("primaryBankaccount")

    const styles = {
      headerPetrol: {
        fill: {
          fgColor: {
            rgb: "007990"
          }
        },
        font: {
          color: {
            rgb: "FFFFFF"
          },
          sz: 14,
          bold: false,
          underline: false
        }
      },
      headerYellow: {
        fill: {
          fgColor: {
            rgb: "e7d901"
          }
        },
        font: {
          color: {
            rgb: "545741"
          },
          sz: 14,
          bold: false,
          underline: false
        }
      },
      headerWwwFaktooraCom: {
        fill: {
          fgColor: {
            rgb: "FFFFFF"
          }
        },
        font: {
          color: {
            rgb: "007990"
          },
          sz: 14,
          bold: true,
          underline: false
        },
        alignment: {
          vertical: "center"
        }
      },
      cellOlive: {
        fill: {
          fgColor: {
            rgb: "545741"
          }
        }
      },
      cellPetrol: {
        fill: {
          fgColor: {
            rgb: "007990"
          }
        }
      }
    }

    //Array of objects representing heading rows (very top)
    const heading = [
      [
        { value: "powerd by faktoora.com", style: styles.headerWwwFaktooraCom },
        "",
        "",
        { value: "Gesamtbetrag", style: styles.headerPetrol },
        { value: "Referenz", style: styles.headerYellow },
        { value: "Zahlungsbedingung", style: styles.headerPetrol },
        { value: "Rechnungsnummer", style: styles.headerYellow },
        { value: "Auftragsnummer", style: styles.headerPetrol },
        { value: "Ausstelldatum", style: styles.headerYellow },
        { value: "zahlbar bis", style: styles.headerPetrol },
        { value: "Postscript", style: styles.headerYellow },
        { value: "Verkäufer", style: styles.headerPetrol },
        { value: "Straße", style: styles.headerYellow },
        { value: "PLZ", style: styles.headerPetrol },
        { value: "Stadt", style: styles.headerYellow },
        { value: "Tel", style: styles.headerPetrol },
        { value: "Bank", style: styles.headerYellow },
        { value: "IBAN", style: styles.headerPetrol },
        { value: "BIC", style: styles.headerYellow },
        { value: "Käufer", style: styles.headerPetrol },
        { value: "Unternehmen", style: styles.headerYellow },
        { value: "Adresse", style: styles.headerPetrol },
        { value: "PLZ", style: styles.headerYellow },
        { value: "Stadt", style: styles.headerPetrol },
        { value: "Tel", style: styles.headerYellow },
        { value: "Email", style: styles.headerPetrol }
      ],
      [
        "",
        "",
        "",
        invoice.attributes.amount,
        invoice.attributes.faktooraId,
        invoice.attributes.data.paymentterm,
        invoice.attributes.invoiceNumber,
        invoice.attributes.invoiceOrderNumber,
        invoice.attributes.issueDate,
        invoice.attributes.lastPaymentDate,
        invoice.attributes.data.postscript,
        owner.attributes.companyName,
        owner.attributes.street,
        owner.attributes.postcode,
        owner.attributes.city,
        owner.attributes.phone,
        primaryBankaccount.attributes.holderName,
        primaryBankaccount.attributes.iban,
        primaryBankaccount.attributes.bic,
        debtor.attributes.nameAuthorisedSignatory,
        debtor.attributes.nameAuthorisedSignatory,
        debtor.attributes.address,
        debtor.attributes.postcode,
        debtor.attributes.city,
        debtor.attributes.phoneNo,
        debtor.attributes.email
      ] // <-- It can be only values
    ]

    //Here you specify the export structure
    const specification = {
      /*customer_name: {

        // <- the key should match the actual data key
        displayName: "Customer", // <- Here you specify the column header
        headerStyle: styles.headerPetrol, // <- Header style
        cellStyle: function(value, row) {
          // <- style renderer function
          // if the status is 1 then color in green else color in red
          // Notice how we use another cell value to style the current one
          return row.status_id == 1 ? styles.cellPetrol : { fill: { fgColor: { rgb: "FFFF0000" } } } // <- Inline cell style is possible
        },
        width: 120 // <- width in pixels
      },
      status_id: {
        displayName: "Status",
        headerStyle: styles.headerPetrol,
        cellFormat: function(value, row) {
          // <- Renderer function, you can access also any row.property
          return value == 1 ? "Active" : "Inactive"
        },
        width: "10" // <- width in chars (when the number is passed as string)
      },
      note: {
        displayName: "Description",
        headerStyle: styles.headerPetrol,
        cellStyle: styles.cellOlive, // <- Cell style
        width: 220 // <- width in pixels
      },*/

      product: {
        displayName: "Produkt/Service",
        headerStyle: styles.headerYellow,
        width: 220
      },
      quantity: {
        displayName: "Menge",
        headerStyle: styles.headerPetrol
      },
      tax: {
        displayName: "Steuer",
        headerStyle: styles.headerYellow
      },
      price: {
        displayName: "Einzelpreis",
        headerStyle: styles.headerPetrol,
        width: 180
      }
    }

    // The data set should have the following shape (Array of Objects)
    // The order of the keys is irrelevant, it is also irrelevant if the
    // dataset contains more fields as the report is build based on the
    // specification provided above. But you should have all the fields
    // that are listed in the report specification
    const dataset = new Array() /*[ Maybe dataset = invoice.attributes.data.invoicePositions is enough?
      { customer_name: invoice.attributes.data.invoicePositions, status_id: 1, note: "some note", misc: "not shown" },
      { customer_name: owner.attributes.companyName, status_id: 0, note: "some note" },
      { customer_name: debtor.attributes.email, status_id: 0, note: "some note", misc: "not shown" }
    ]*/

    var i = 0
    while (i < invoice.attributes.data.invoicePositions.length) {
      dataset.push(invoice.attributes.data.invoicePositions[i])
      i++
    }
    // Define an array of merges. 1-1 = A:1
    // The merges are independent of the data.
    // A merge will overwrite all data _not_ in the top-left cell.
    const merges = [{ start: { row: 1, column: 1 }, end: { row: 2, column: 3 } }]

    // Create the excel report.
    // This function will return Buffer
    const report = excel.buildExport([
      // <- Notice that this is an array. Pass multiple sheets to create multi sheet report
      {
        name: "Invoice", // <- Specify sheet name (optional)
        heading: heading, // <- Raw heading array (optional)
        merges: merges, // <- Merge cell ranges
        specification: specification, // <- Report specification
        data: dataset // <-- Report data
      }
    ])

    return report
  },

  /**
   * Old invoices created before the production deployment on November 14th did not create a Document model
   * This function adds documents to the invoices which do not have a document yet
   */
  addDocumentsToInvoices: async function() {
    console.log(`[Cron] Add documents to invoices which dont have an invoice`)

    const invoices = await Invoice.forge().fetchAll()

    for (let invoice of invoices.models) {
      const document = await Document.forge()
        .where({ reference_id: invoice.id, reference_type: "invoice" })
        .fetch()

      if (document !== null) {
        // Skip loop when there is already a document
        continue
      }

      if (invoice.attributes.invoiceFile === null) {
        console.log(
          `[Cron] Error: Can not create document for invoice ${invoice.id} because it has no invoiceFile attached`
        )
        continue
      }

      const newDocument = await Document.forge({
        user: invoice.attributes.owner,
        category: "invoice",
        upload: invoice.attributes.invoiceFile,
        customer: invoice.attributes.debtor,
        faktooraId: invoice.attributes.faktooraId,
        documentType: "invoice",
        reference_type: "invoice",
        reference_id: invoice.id,
        status: invoice.attributes.status
      }).save()

      console.log(`[Cron] New document ${newDocument.id} generated for invoice ${invoice.id}`)
    }
  },
  /**
   * Sets the status of invoices to overdue
   */
  markInvoicesOverdue: async function() {
    console.log(`[Cron] Marking overdue invoices`)
    const currentDate = moment({ hour: 0, minute: 0 })

    const invoices = await Invoice.where("status", "in", [
      "sent",
      "review",
      "available",
      "aborted",
      "rejected"
    ]).fetchAll()

    // Only select invoices with last payment date at least one day before today
    // TODO Check this in the DB query directly
    const filteredInvoices = invoices.models.filter(
      item =>
        currentDate >
        moment(item.attributes.lastPaymentDate)
          .hours(0)
          .minutes(0)
    )

    for (let invoice of filteredInvoices) {
      await invoice.save({ status: "overdue" }, { patch: true })
      console.log(`marked invoice with faktoora ID ${invoice.attributes.faktooraId} as overdue`)
    }
  },

  /**
   * This updates only the updated_at timestamp of an invoice. It's use is to force the execution
   * of Invoice#s lifecycle hooks beforeSave/afterSave/beforeUpdate/afterUpdate
   */
  touch: async function(invoiceId) {
    try {
      let invoice = await Invoice.where({ id: invoiceId }).fetch()
      await invoice.save({ updated_at: new Date() }, { patch: true })
    } catch (err) {
      console.log(`An exception occured in touch service of Invoice: ${err}`)
    }
  },

  updateInvoicesWithoutRoleStatuses: async function() {
    try {
      console.log(`[Cron] Executing updateInvoicesWithoutRoleStatuses`)
      let invoices = await Invoice.fetchAll()
      invoices = invoices.filter(item => !_.get(item, "attributes.data.statuses"))
      console.log(`[Cron] Found ${invoices.length} invoices that need to update role specific statuses`)

      for (let invoice of invoices) {
        await strapi.services.invoice.touch(invoice.id)
        console.log(`Touched invoice with ID ${invoice.id}`)
      }
    } catch (err) {
      console.log(`An exception occured in updateInvoicesWithoutRoleStatuses service of Invoice: ${err}`)
    }
  },
  /**
   * Generate an invoiceNumber
   */
  generateInvoiceNumber: async function(ctx) {
    let userId = ctx.session.passport.user.id
    const statisticModel = await Usersetting.where({
      user: userId,
      key: "userStatistics"
    }).fetch({ withRelated: ["user"] })
    let number
    if (!statisticModel) {
      number = 0
    } else {
      let statistics = statisticModel.toJSON()
      number = (!_.isEmpty(statistics) && !_.isEmpty(statistics.value) && statistics.value.invoiceCount) || 0
    }

    return { invoiceNumber: padLeft(parseInt(number) + 1, 3, "0") }
  },
  markAsPaid: async function(ctx) {
    try {
      const values = ctx.request.body
      const user = ctx.session.passport.user
      const { id } = ctx.params
      const schema = joi.object().keys({
        paymentDate: joi.date().allow(""),
        amount: joi.number().positive()
      })
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

      let paymentDate = _.get(clearValues, "paymentDate") || moment().toDate()
      const invoiceModel = await Invoice.forge({
        id,
        owner: user.id
      }).fetch()

      if (invoiceModel === null || !["sent", "overdue", "paid"].includes(invoiceModel.attributes.status)) {
        throw new JsonApiError(`E_MARK_INVOICE_PAID_FORBIDDEN`, 403, "Can't mark the invoice paid")
      }
      if (invoiceModel.attributes.outstandingBalance < Number(clearValues.amount)) {
        throw new JsonApiError(`E_MARK_INVOICE_PAID_FORBIDDEN`, 403, "Amount too much")
      }
      await invoiceModel.save(
        {
          status: "paid",
          paymentDate: paymentDate,
          outstandingBalance: invoiceModel.attributes.outstandingBalance - clearValues.amount
        },
        { patch: true }
      )

      return { success: true }
    } catch (err) {
      strapi.log.error(err)
      throw err
    }
  },

  /**
   * Generates the subrogation letter and assignment leter
   */
  generateSubrogationAndAssignmentAgreementLetters: async function(invoiceId) {
    try {
      const invoiceModel = await Invoice.where({ id: invoiceId }).fetch({
        withRelated: ["debtor", "invoicesale.buyer", "owner"]
      })

      if (invoiceModel === null) {
        throw new JsonApiError(`E_INVOICE_NOT_FOUND`, 404, `Could not find invoice with ID ${invoiceId}`)
      }

      console.log(
        `Generating subrogation letter and assignment letter for invoice ${invoiceModel.attributes.faktooraId}.`
      )
      const invoiceSaleModel = invoiceModel.related("invoicesale")

      if (!invoiceSaleModel || invoiceSaleModel.attributes.buyer === null) {
        console.log(`The invoice ${invoiceModel.attributes.faktooraId} has not been sold. Skipping.`)
        return
      }
      const buyerModel = invoiceSaleModel.related("buyer")
      const sellerModel = invoiceModel.related("owner")
      const debtorModel = invoiceModel.related("debtor")
      const dataInvoice = _.extend(invoiceModel.attributes, _.omit(invoiceSaleModel.attributes, ["id"]))
      const correlationId = invoiceModel.id

      // create subrogationLetter for customer
      if (invoiceSaleModel.attributes.subrogationLetter === null) {
        await worker.generateSubrogationLetter(
          {
            taskType: "createInvoicePdf",
            invoice: dataInvoice,
            debtor: debtorModel.attributes,
            seller: sellerModel.attributes,
            buyer: buyerModel.attributes
          },
          correlationId
        )
      } else {
        console.log(
          `Subrogation letter for ${invoiceModel.attributes.faktooraId} does already exist. Skipping creation.`
        )
      }
      if (invoiceSaleModel.attributes.assignmentAgreement === null) {
        // create subrogationLetter for seller & buyer
        await worker.generateAssignmentAgreementLetter(
          {
            taskType: "generateAssignmentAgreementLetter",
            invoice: dataInvoice,
            debtor: debtorModel.attributes,
            seller: sellerModel.attributes,
            buyer: buyerModel.attributes
          },
          correlationId
        )
      } else {
        console.log(
          `Subrogation letter for ${invoiceModel.attributes.faktooraId} does already exist. Skipping creation.`
        )
      }
    } catch (err) {
      console.log("error in generateSubrogationAndAssignmentAgreementLetters", err)
      strapi.log.error(err)
      throw err
    }
  },
  importInvoice: async function(ctx) {
    const body = ctx.request.body
    let { isSell } = ctx.query || {}
    isSell = isSell === "true"
    const schema = joi.object().keys({
      // faktooraId: joi.string().required(),
      invoiceNumber: joi.string().required(),
      issueDate: joi.date().required(),
      lastPaymentDate: joi.date().required(),
      debtor: joi
        .string()
        .guid()
        .required(),
      invoiceFile: joi
        .string()
        .guid()
        .required(),
      amount: joi
        .number()
        .required()
        .positive()
        .max(999999.99),
      taxAmount: joi
        .number()
        .required()
        .min(0)
        .max(999999.99),
      sendEmail: joi.boolean(),
      sendLetter: joi.boolean(),
      sendManually: joi.boolean(),
      amountWithoutTax: joi
        .number()
        .required()
        .positive()
        .max(999999.99)
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
    clearValues.data = _.pick(clearValues, ["amountWithoutTax", "taxAmount"])
    // Check whether debtor exists
    let customerModel = await Customer.forge({
      id: clearValues.debtor || null
    }).fetch() // or null
    if (customerModel === null && !isSell) {
      throw new JsonApiError("E_RESOURCE_NOT_EXISTS", 400, `Debtor with ID ${clearValues.debtor} does not exist`)
    }

    // Look up the region for a debtor
    let debtorRegion = findState(customerModel && customerModel.get("postcode"))
    if (debtorRegion !== -1) {
      clearValues.debtorRegion = debtorRegion
    }

    clearValues.owner = ctx.session.passport.user.id

    // Assign industry
    let user = await User.forge({ id: clearValues.owner }).fetch({
      withRelated: ["legalform", "userlogins", "primaryBankaccount"]
    })
    const legalform = user.related("legalform")
    clearValues.status = "sent" // isSell ? "sent" : "created"
    clearValues.faktooraId = await strapi.services.invoice.generateFaktooraId()
    clearValues.outstandingBalance = clearValues.amount
    // add invoice info
    let invoice = await Invoice.forge(
      _.pick(clearValues, [
        "debtor",
        "invoiceNumber",
        "lastPaymentDate",
        "issueDate",
        "amount",
        "outstandingBalance",
        "industry",
        "owner",
        "invoiceFile",
        "data",
        "invoiceOrderNumber",
        "status",
        "subject",
        "salutation",
        "greeting",
        "signature",
        "signatureName",
        "paymentControl",
        "faktooraId"
      ])
    ).save()
    // Create document for invoice
    let documentModel = await Document.forge({
      user: invoice.attributes.owner,
      category: "invoice",
      customer: invoice.attributes.debtor || null,
      status: invoice.attributes.status,
      faktooraId: invoice.attributes.faktooraId,
      upload: invoice.attributes.invoiceFile,
      documentType: "invoice",
      reference_type: "invoice",
      reference_id: invoice.id
    }).save()

    let sendLetter = _.get(clearValues, "sendLetter")
    let sendEmail = _.get(clearValues, "sendEmail")
    let sendManually = _.get(clearValues, "sendManually") || (!sendLetter && !sendEmail)

    const debtor = customerModel.toJSON()
    let data = _.get(invoice, "attributes.data") || { sent: [] }
    let uploadModel = await Upload.forge({ id: invoice.attributes.invoiceFile }).fetch()
    // change filename of invoice upload

    let subPrefix = moment(_.get(invoice, "attributes.issueDate")).format("YYYY_MM_DD")
    let invoiceFile = uploadModel.toJSON()
    let oldPathFile = path.join(strapi.config.environments[strapi.config.environment].uploadFolder, invoiceFile.path, invoiceFile.filename)
    let newFileName = `Rechnung_${subPrefix}_${_.get(invoice, "attributes.faktooraId")}.pdf`
    let newPathFile = path.join(strapi.config.environments[strapi.config.environment].uploadFolder, invoiceFile.path, newFileName)
    await fs.rename(oldPathFile, newPathFile, function(err) {
      if (err) console.log("RENAME ERROR: " + err)
    })
    uploadModel = await uploadModel.save({ filename: newFileName }, { path: true })
    debugger
    invoiceFile = uploadModel.toJSON()

    let owner = user.toJSON()
    data.sent = data.sent || []
    const filePath =
      invoiceFile &&
      invoiceFile.filename &&
      invoiceFile.path &&
      path.join(strapi.config.environments[strapi.config.environment].uploadFolder, invoiceFile.path, invoiceFile.filename)
    if (sendEmail && !data.sendEmail) {
      let attachments
      if (filePath) {
        attachments = JSON.stringify([{ path: filePath, filename: invoiceFile.filename }])
      }
      data.sendEmail = true

      //const userModel = await User.forge({ id: userId }).fetch({ withRelated: ["userlogins"] })
      //const userLoginModels = userModel.related("userlogins")

      const companyName = common.determineCompanyNameWithLegalform(user.attributes.companyName, legalform.toJSON())

      console.log("owner data", invoice.owner)
      // send mail for invoice delivery
      await Email.forge({
        data: {
          subject: data.subject || `app.notification.invoiceSendDebtor.summary`,
          content: `app.notification.invoiceSendDebtor.text`,
          debtor,
          owner: owner,
          name: debtor.name,
          companyName,
          invoiceNumber: invoice.attributes.invoiceNumber,
          street: _.get(owner, "street"),
          postcode: _.get(owner, "postcode"),
          city: _.get(owner, "city"),
          noGender: debtor.gender === null,
          isMale: debtor.gender === "male",
          ownerEmail: user.email
        },
        to: debtor.email,
        attachments,
        template: "customer",
        cc: user.email
      }).save()
      data.sent.push({ type: "email", date: new Date(), sender: user.id, category: "invoice" })
    }
    if (sendLetter && !data.sendPost) {
      const address = common.getAddress(debtor.address)
      let recipient = {
        salutation: debtor.gender === "male" ? "Herr" : "Frau",
        title: "",
        firstName: debtor.firstName,
        lastName: debtor.lastName,
        company: debtor.name,
        streetName: address.street,
        houseNumber: address.houseNumber,
        city: debtor.city,
        zipCode: debtor.postcode
      }
      if (debtor.isCompany) {
        recipient = _.omit(recipient, ["salutation", "firstName", "lastName"])
      } else {
        recipient = _.omit(recipient, ["company"])
      }
      data.sendPost = true

      // Determine subject
      const subject = strapi.i18n.__("app.notification.invoiceSendDebtor.summary")
      // await - don't wait anymore for it
      worker.sendEpost({ invoice: invoice.toJSON(), recipient, subject, filePath })
      data.sent.push({ type: "post", date: new Date(), sender: user.id, category: "invoice" })
    }
    if (sendManually) {
      data.sendManually = true
    }
    if (sendEmail || sendLetter || sendManually) {
      await invoice.save({ data, status: "sent" }, { patch: true })
      // update to the main document of invoice
      await documentModel.save(
        { extras: _.assign({}, _.pick(data, ["sendPost", "sent", "sendEmail", "sendManually"])) },
        { patch: true }
      )
    }

    // Send notification implying how the invoice was sent
    let notificationType
    if (sendManually === true) {
      notificationType = "sendInvoiceManually"
    } else if (sendEmail === true && sendLetter === true) {
      notificationType = "sendInvoiceEpostAndEmail"
    } else if (sendEmail === true && sendLetter !== true) {
      notificationType = "sendInvoiceEmail"
    } else if (sendEmail !== true && sendLetter === true) {
      notificationType = "sendInvoiceEpost"
    } else {
      console.log(
        `Unexpected combination of sending options: sendManually: ${sendManually}, sendEmail=${sendEmail}, sendLetter=${sendLetter}`
      )
    }
    if (sendEmail || sendLetter || sendManually) {
      await Notification.forge({
        type: notificationType,
        recipient: user.id,
        skipEmail: true,
        invoice: invoice.id,
        data: {
          invoiceNumber: invoice.attributes.invoiceNumber,
          faktooraId: invoice.attributes.faktooraId,
          debtorName: debtor.name
        }
      }).save()
    }

    let returnData = await strapi.services.jsonapi.fetch(strapi.models.invoice, {
      id: invoice.id
    })
    return returnData
  },
  getInvoiceDocumentByFaktooraId: async function(ctx) {
    let faktooraId = ctx.params.faktooraId
    let documents = await Document.where(qb => {
      qb.where("faktooraId", faktooraId)
    }).fetchAll()

    return documents
  },
  updateOutstandingBalance: async function(id) {
    const invoice = await Invoice.forge({ id }).fetch()
    //trigger hook
    await invoice.save({ id }, { patch: true })
    return await Invoice.forge({ id }).fetch()
  }
}
