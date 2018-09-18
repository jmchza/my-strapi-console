"use strict"
const _ = require("lodash")
const common = require("../../../utils/common")
const padLeft = common.padLeft
const worker = require("../../../utils/worker")
const joi = require("joi")
const JsonApiError = require("../../../utils/json-api-error")
const offerDraftSchema = joi.object().keys({
  id: joi.string().guid(),
  totaldiscount: joi.object().keys({
    type: joi
      .string()
      .valid(["percent", "currency"])
      .required(),
    value: joi.number().required()
  }),
  introduction: joi.string().allow(""),
  postscript: joi.string().allow(""),
  subject: joi.string().allow(""),
  salutation: joi.string().allow(""),
  paymentterm: joi.string().allow(""),
  greeting: joi.string().allow(""),
  signature: joi
    .string()
    .guid()
    .allow(""),
  signatureName: joi.string().allow(""),
  email: joi.string().allow(""),
  telephone: joi.string().allow(""),
  offerOrderNumber: joi.string().allow(""),
  offerNumber: joi.string().allow(""),
  faktooraId: joi.string().required(),
  issueDate: joi.date(),
  lastPaymentDate: joi.date(),
  customer: joi.string().guid(),
  offerPositions: joi.array().items(
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
        .positive()
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
  letter: joi.object().keys({
    signature: joi.string().guid(),
    subject: joi.string().required(),
    salutation: joi.string().required(),
    content: joi.string().required(),
    greeting: joi.string().required(),
    signatureName: joi.string(),
    signatures: joi.array().allow("")
  }),
  valueAddedTaxId: joi.string().allow(["", null]),
  signatures: joi.array().allow("")
})
const offerSchema = joi.object().keys({
  id: joi.string().guid(),
  totaldiscount: joi.object().keys({
    type: joi
      .string()
      .valid(["percent", "currency"])
      .required(),
    value: joi.number().required()
  }),
  introduction: joi.string(),
  postscript: joi.string(),
  subject: joi.string(),
  salutation: joi.string(),
  paymentterm: joi.string(),
  greeting: joi.string(),
  signature: joi.string().guid(),
  signatureName: joi.string(),
  email: joi.string(),
  telephone: joi.string(),
  offerOrderNumber: joi.string(),
  offerNumber: joi.string().required(),
  faktooraId: joi.string().required(),
  issueDate: joi.date().required(),
  lastPaymentDate: joi.date().required(),
  customer: joi.string().guid(),
  offerPositions: joi
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
          .positive()
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
  letter: joi.object().keys({
    signature: joi.string().guid(),
    subject: joi.string().required(),
    salutation: joi.string().required(),
    content: joi.string().required(),
    greeting: joi.string().required(),
    signatureName: joi.string(),
    signatures: joi.array().allow("")
  }),
  valueAddedTaxId: joi.string().required(),
  signatures: joi.array().allow("")
})

module.exports = {
  createOrEditOffer: async function(ctx) {
    const user = ctx.session.passport.user
    const { id } = ctx.params || {}
    let { isDraft } = ctx.query || null
    isDraft = isDraft === "true"
    let values = ctx.request.body
    const schema = isDraft ? offerDraftSchema : offerSchema
    const result = joi.validate(values, schema, { allowUnknown: false, abortEarly: false })
    const clearValues = result.value
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    if (isDraft === true) {
      clearValues.status = "draft"
    } else {
      clearValues.status = "created"
    }
    const calculateAmount = strapi.services.invoice.calculateAmount(
      clearValues.offerPositions,
      (clearValues.totaldiscount && clearValues.totaldiscount.value) || 0
    )
    clearValues.amount = calculateAmount && calculateAmount.amount
    clearValues.owner = user.id
    clearValues.clientId = user.clientId

    /* let templateArr = ['standard', 'classic', 'creative']
    let templateColorArr = ['#007990', '#e7d900', '#b70f0a', '#72bb53', '#ffffff']
    clearValues.template = {
      style: _.sampleSize(templateArr, 1)[0],
      color: _.sampleSize(templateColorArr, 1)[0]
    }*/

    // Handle signature data
    let userData = await User.forge({ id: user.id }).fetch({
      withRelated: ["legalform", "userlogins", "primaryBankaccount"]
    })
    let signatureIds = _.get(clearValues, "signatures", []).filter(s => s !== null)
    let signatures = (await common.generateSignatureData(signatureIds, userData)) || []

    clearValues.data = _.pick(clearValues, [
      "totaldiscount",
      "introduction",
      "subject",
      "salutation",
      "postscript",
      "paymentterm",
      "offerPositions",
      "greeting",
      "signature",
      "signatureName",
      "formatting",
      "email",
      "telephone",
      "template",
      "valueAddedTaxId",
      "hasArticleNumber",
      "isTaxExemptUser"
    ])
    clearValues.data.signatures = signatures
    let isEdit = false
    let offerModel
    let offer
    if (id) {
      offerModel = await Offer.forge({ id }).fetch()
      if (!offerModel) {
        throw new JsonApiError(`E_OFFER_NOT_EXIST`, 400, `Cannot update a offer not exist.`)
      }
      if (!(offerModel.attributes.status === "draft")) {
        throw new JsonApiError(`E_OFFER_CANNOT_EDIT`, 400, `Cannot update this offer.`)
      }
    }

    let data = _.pick(clearValues, [
      "customer",
      "offerNumber",
      "lastPaymentDate",
      "issueDate",
      "faktooraId",
      "amount",
      "owner",
      "data",
      "offerOrderNumber",
      "status",
      "clientId"
    ])
    if (id) {
      offer = await offerModel.save(data, { patch: true })
    } else {
      offer = await Offer.forge(data).save()
    }

    clearValues.faktooraId = offer.attributes.faktooraId
    let letterData = _.assign({}, _.omit(clearValues.letter, "signatures"), {
      offer: offer.id,
      customer: clearValues.customer,
      category: "letter",
      user: user.id,
      status: clearValues.status,
      faktooraId: clearValues.faktooraId,
      extras: _.pick(clearValues, ["email", "telephone", "template", "formatting"]),
      clientId: user.clientId
    })
    let letterSignatureIds = _.get(clearValues, "letter.signatures", []).filter(s => s !== null)
    let letterSignatures = (await common.generateSignatureData(letterSignatureIds, userData)) || []
    letterData.extras.signatures = letterSignatures
    // update or delete letter if offer is edit
    let letterModel
    if (id) {
      let promise = []
      if (!clearValues.letter) {
        letterModel = await Letter.forge({ offer: offer.id, category: "letter" }).fetch()
        letterModel && promise.push(letterModel.destroy())
        await promise
      } else {
        letterModel = await Letter.forge({ offer: offer.id, category: "letter" }).fetch()
        if (letterModel) {
          await letterModel.save(letterData, { patch: true })

          // #3210 - change contact in draft shows wrong name on page documents (incl. alls subpages)
          const documentOfferLetterModel = await Document.where({
            documentType: "purchasing",
            reference_type: "letter",
            reference_id: letterModel.get("id")
          }).fetch()
          if (documentOfferLetterModel) {
            await documentOfferLetterModel.save(
              {
                customer: clearValues.customer
              },
              { patch: true }
            )
          }
        } else {
          letterModel = await Letter.forge(letterData).save()
          await Document.forge({
            user: user.id,
            category: "letter",
            customer: data.customer,
            faktooraId: data.faktooraId,
            reference_type: "letter",
            reference_id: letterModel.id,
            documentType: "purchasing",
            status: data.status
          }).save()
        }
      }
    } else {
      if (clearValues.letter) {
        letterModel = await Letter.forge(letterData).save()
        await Document.forge({
          user: user.id,
          category: "letter",
          customer: data.customer,
          faktooraId: data.faktooraId,
          reference_type: "letter",
          reference_id: letterModel.id,
          documentType: "purchasing",
          status: data.status
        }).save()
      }
    }

    // Create document for offer
    if (!id) {
      await Document.forge({
        user: user.id,
        category: "purchasing",
        customer: data.customer,
        faktooraId: data.faktooraId,
        reference_type: "offer",
        reference_id: offer.id,
        documentType: "purchasing",
        status: data.status
      }).save()
    } else {
      // #3210 - change contact in draft shows wrong name on page documents (incl. alls subpages)
      const documentOfferModel = await Document.where({
        documentType: "purchasing",
        reference_type: "offer",
        reference_id: offer.get("id")
      }).fetch()
      if (documentOfferModel) {
        await documentOfferModel.save(
          {
            customer: clearValues.customer
          },
          { patch: true }
        )
      }
    }
    // trigger run merge if the status is created
    await offer.save({ status: data.status }, { patch: true })

    if (offer.attributes.status === "created") {
      // Retrieve the invoice again because we need its related entities
      offerModel = await Offer.forge({ id: offer.id }).fetch({
        withRelated: ["customer", "owner.legalform"]
      })
      let current = offerModel.toJSON()
      if (current.owner && current.owner.companyLogo) {
        let uploadModel = await Upload.forge({ id: current.owner.companyLogo }).fetch()
        current.owner.companyLogo = uploadModel ? uploadModel.attributes : null
      }
      // find userlogin
      let userModel = await User.forge({ id: current.owner.id }).fetch({
        withRelated: ["legalform", "userlogins", "primaryBankaccount"]
      })
      const legalform = userModel.related("legalform")
      current.industry = userModel.attributes.industry
      let userlogins = (userModel && userModel.toJSON().userlogins) || []
      current.userlogin = _.find(userlogins, obj => obj.isMain)
      userModel && userModel.toJSON().legalform && (current.owner.legalform = userModel && userModel.toJSON().legalform)
      if (clearValues.letter && letterModel) {
        letterModel = await Letter.forge({ id: letterModel.id }).fetch({
          withRelated: ["invoice", "user.companyLogo", "user.legalform", "customer"]
        })
        current.letter = letterModel.toJSON()
        current.letter.type = "letter"
        current.letter.userlogin = current.userlogin || {}
      }
      // get signature
      if (current.data && current.data.signature) {
        let uploadModel = await Upload.forge({ id: current.data.signature }).fetch()
        uploadModel && (current.signature = uploadModel.toJSON())
      }
      //get document config
      let usersettingModel = await Usersetting.where({ user: user.id, key: "documentConfig" }).fetch()
      if (usersettingModel) {
        current.documentSetting = usersettingModel.attributes.value || {
          footer: common.getDefaultFooterFieldTemplate(legalform.attributes.key)
        }
      } else {
        current.documentSetting = { footer: common.getDefaultFooterFieldTemplate(legalform.attributes.key) }
      }
      current.documentSetting.footer = common.bindingDataForFooter(current.documentSetting.footer, {
        user: current.owner,
        userlogin: current.userlogin,
        primaryBankaccount: userModel && userModel.toJSON().primaryBankaccount
      })
      await worker.generateLetter(Object.assign({ type: "offer" }, current))
      // add offerCount
      const statisticModel = await Usersetting.where({
        user: user.id,
        key: "userStatistics"
      }).fetch({ withRelated: ["user"] })

      if (!statisticModel) {
        let value = { offerCount: 1 }
        await Usersetting.forge({
          user: user.id,
          value: value,
          key: "userStatistics"
        }).save()
      } else {
        let value = statisticModel.attributes.value || {}
        value.offerCount = (value.offerCount && parseInt(value.offerCount) + 1) || 1
        await statisticModel.save({ value: value }, { patch: true })
      }
    }

    // Save previous data
    let offerPositions = clearValues.offerPositions || []
    let promises = []
    promises.push(
      common.savePreviousData({
        user,
        key: "previousProductName",
        content: offerPositions.map(position => position.description)
      })
    )
    promises.push(
      common.savePreviousData({
        user,
        key: "previousUnitName",
        content: offerPositions.map(position => position.unit)
      })
    )
    promises.push(common.savePreviousData({ user, key: "offerPostscripts", content: clearValues.postscript }))
    promises.push(common.savePreviousData({ user, key: "offerIntroductions", content: clearValues.introduction }))

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
        key: "offerCreateLastUsedSignatures",
        value: JSON.stringify(signatureIds)
      }
      let lastSignature = await Usersetting.forge({ user: user.id, key: "offerCreateLastUsedSignatures" }).fetch()
      if (lastSignature) {
        await lastSignature.save(lastSignatureData, { patch: true })
      } else {
        await Usersetting.forge(lastSignatureData).save()
      }
    }
    await promises
    return strapi.services.jsonapi.fetch(strapi.models.offer, { id: offer.id })
  },
  /**
   * Generate an offerNumber
   */
  generateOfferNumber: async function(ctx) {
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
      number = (!_.isEmpty(statistics) && !_.isEmpty(statistics.value) && statistics.value.offerCount) || 0
    }

    return { offerNumber: padLeft(parseInt(number) + 1, 3, "0") }
  }
}
