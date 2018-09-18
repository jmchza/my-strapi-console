const joi = require("joi")
const _ = require("lodash")
const path = require("path")
const JsonApiError = require("../../../utils/json-api-error")
const common = require("../../../utils/common")
const worker = require("../../../utils/worker")
const documnentBuider = require("document-generator")
const builderQuery = require("../../../utils/builder-query")
const moment = require("moment")

const operatorMap = common.operatorMap || {}

module.exports = {
  builderQuery: builderQuery,
  send: async function(ctx) {
    const user = ctx.session.passport.user
    const values = ctx.request.body
    const id = ctx.params && ctx.params.id
    // Validate
    const schema = joi.object().keys({
      sendEmail: joi.boolean(),
      sendPost: joi.boolean(),
      sendLetter: joi.boolean(),
      sendManually: joi.boolean(),
      customerEmail: joi.string(),
      recipients: joi.array(),
      copyMyEmailAddress: joi.boolean(),
      senderName: joi.string(),
      subject: joi.string(),
      attachments: joi.array(),
      bodyMessage: joi.string(),
      mainAttachment: joi.string()
    })
    const result = joi.validate(values, schema, { allowUnknown: false, abortEarly: false })
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    let document = await Document.forge({ id, user: user.id }).fetch()
    if (!document) {
      throw new JsonApiError(`E_VALIDATION`, 400, "Document not found!")
    }
    // Get post data
    const { sendEmail, sendPost, sendManually } = values
    if (sendEmail) {
      return this.sendByEmail(ctx)
    }
    if (sendPost) {
      return this.sendByPost(ctx)
    }
    if (sendManually) {
      return this.sendByManual(ctx)
    }
    return {}
  },
  sendByEmail: async function(ctx) {
    const user = ctx.session.passport.user
    const values = ctx.request.body
    const id = ctx.params && ctx.params.id

    let document = await Document.forge({ id, user: user.id }).fetch()
    // find the customer info & user info
    let customerModel = await Customer.forge({ id: document.attributes.customer }).fetch()
    let debtor = customerModel.toJSON()
    const {
      // documentId,
      customerEmail,
      recipients,
      copyMyEmailAddress,
      senderName,
      subject,
      attachments,
      bodyMessage,
      mainAttachment
    } = values

    let documentType = document.attributes.documentType
    let referenceType = document.attributes.reference_type
    let letter
    let offerNumber
    let invoiceNumber
    let letterModel
    let offerModel

    if (documentType !== "purchasing") {
      letterModel = await Letter.forge({ id: document.attributes.reference_id }).fetch()
      letter = (letterModel && letterModel.toJSON()) || {}
    } else {
      offerModel = await Offer.forge({ id: document.attributes.reference_id }).fetch()
      let offer = (offerModel && offerModel.toJSON()) || {}
      offerNumber = offer.offerNumber || ""
    }
    if (documentType === "reminder") {
      // find the invoice link to reminder
      let invoiceModel = await Invoice.where({ faktooraId: document.attributes.faktooraId }).fetch()
      invoiceNumber = invoiceModel.attributes.invoiceNumber
    }
    if (referenceType === "letter") {
      if (!_.isObject(letterModel)) {
        letterModel = await Letter.forge({ id: document.attributes.reference_id }).fetch()
      }
      await letterModel.save({ status: "sent" }, { patch: true })
    }
    if (referenceType === "offer") {
      if (!_.isObject(letterModel)) {
        offerModel = await Offer.forge({ id: document.attributes.reference_id }).fetch()
      }
      await offerModel.save({ status: "sent" }, { patch: true })
    }
    let oldExtras = document.attributes.extras || {}
    let sentData = oldExtras.sent || []
    // Handle attachments
    let emailAttachments = []
    const mainAttachmentFile = await common.getFileWithFullPath(mainAttachment)
    emailAttachments.push({ path: mainAttachmentFile.fullFilePath, filename: mainAttachmentFile.filename })

    if (attachments) {
      attachments.map(async attachment => {
        const attachmentFile = await common.getFileWithFullPath(attachment.file)
        emailAttachments.push({ path: attachmentFile.fullFilePath, filename: attachmentFile.filename })
      })
    }
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
    // send email for document
    try {
      let notificationType =
        documentType === "purchasing"
          ? "offerSendDebtor"
          : documentType === "cancellation"
            ? "withdrawalSendDebtor"
            : documentType === "reminder"
              ? letter.extras && letter.extras.reminderType === "payment"
                ? "reminderPaymentSendDebtor"
                : "reminderSendDebtor"
              : "letterSendDebtor"
      let userModel = await User.forge({ id: user.id }).fetch({ withRelated: ["legalform"] })
      const companyName = common.determineCompanyNameWithLegalform(
        userModel.attributes.companyName,
        userModel.related("legalform").toJSON()
      )
      // send mail for delivery step
      const sentEmail = await Email.forge({
        data: {
          subject: subject || `app.notification.${notificationType}.summary`,
          content: bodyMessage || `app.notification.${notificationType}.text`,
          debtor,
          name: debtor.name,
          companyName,
          offerNumber,
          invoiceNumber,
          noGender: debtor.gender === null,
          isMale: debtor.gender === "male",
          street: userModel.attributes.street,
          postcode: userModel.attributes.postcode,
          city: userModel.attributes.city,
          ownerEmail: user.email
        },
        from: senderName,
        to: customerEmail || debtor.email,
        attachments: JSON.stringify(emailAttachments),
        template: "customer",
        cc,
        bcc
      }).save()
      // Store email data to document
      sentData.push({
        type: "email",
        date: sentEmail.created_at,
        email: _.omit(sentEmail, ["data.debtor", "data.owner"]),
        sender: user.id,
        category: documentType
      })
    } catch (err) {
      console.log("Error during creation of Notifcation", err)
    }
    // save sent date to document
    const updatedDocument = await document.save({
      extras: Object.assign({}, oldExtras, {
        sent: sentData,
        sendEmail: true
      })
    })
    return updatedDocument
  },
  sendByPost: async function(ctx) {
    const user = ctx.session.passport.user
    const values = ctx.request.body
    const id = ctx.params && ctx.params.id
    let document = await Document.forge({ id, user: user.id }).fetch()
    // find the customer info & user info
    let customerModel = await Customer.forge({ id: document.attributes.customer }).fetch()
    let debtor = customerModel.toJSON()
    let documentType = document.attributes.documentType
    let referenceType = document.attributes.reference_type
    let subject
    let letterModel
    let offerModel
    let dataSend = {}

    if (documentType !== "purchasing") {
      letterModel = await Letter.forge({ id: document.attributes.reference_id }).fetch()
      let letter = (letterModel && letterModel.toJSON()) || {}
      subject = letter.subject
    } else {
      offerModel = await Offer.forge({ id: document.attributes.reference_id }).fetch()
      let offer = (offerModel && offerModel.toJSON()) || {}
      subject = (offer.data && offer.data.subject) || ""
    }
    if (referenceType === "letter") {
      if (!_.isObject(letterModel)) {
        letterModel = await Letter.forge({ id: document.attributes.reference_id }).fetch()
      }
      await letterModel.save({ status: "sent" }, { patch: true })
    }
    if (referenceType === "offer") {
      if (!_.isObject(letterModel)) {
        offerModel = await Offer.forge({ id: document.attributes.reference_id }).fetch()
      }
      await offerModel.save({ status: "sent" }, { patch: true })
    }
    let oldExtras = document.attributes.extras || {}
    let sentData = oldExtras.sent || []

    let uploadId =
      (!_.isEmpty(document.attributes.extras) && document.attributes.extras.printFile) || document.attributes.upload
    let uploadModel = await Upload.forge({ id: uploadId }).fetch()
    let upload = (uploadModel && uploadModel.toJSON()) || {}
    let filePath =
      !_.isEmpty(upload) &&
      upload.filename &&
      upload.path &&
      path.join(strapi.config.environments[strapi.config.environment].uploadFolder, upload.path, upload.filename)
    // if (filePath) {
    //   attachments = JSON.stringify([{ path: filePath, filename: upload.filename }])
    // }
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
    subject = strapi.i18n.__(subject)
    // await - don't wait anymore for it
    worker.sendEpost({ data: dataSend, recipient, subject, filePath, type: document.attributes.reference_type })
    sentData.push({ type: "post", date: new Date(), sender: user.id, category: documentType })
    // save sent date to document
    const updatedDocument = await document.save({
      extras: Object.assign({}, oldExtras, {
        sent: sentData,
        sendPost: true
      })
    })
    return updatedDocument
  },
  sendByManual: async function(ctx) {
    const user = ctx.session.passport.user
    const id = ctx.params && ctx.params.id
    let document = await Document.forge({ id, user: user.id }).fetch()
    let documentType = document.attributes.documentType
    let referenceType = document.attributes.reference_type
    let letterModel
    let offerModel

    if (documentType !== "purchasing") {
      letterModel = await Letter.forge({ id: document.attributes.reference_id }).fetch()
    } else {
      offerModel = await Offer.forge({ id: document.attributes.reference_id }).fetch()
    }
    if (referenceType === "letter") {
      if (!_.isObject(letterModel)) {
        letterModel = await Letter.forge({ id: document.attributes.reference_id }).fetch()
      }
      await letterModel.save({ status: "sent" }, { patch: true })
    }
    if (referenceType === "offer") {
      if (!_.isObject(letterModel)) {
        offerModel = await Offer.forge({ id: document.attributes.reference_id }).fetch()
      }
      await offerModel.save({ status: "sent" }, { patch: true })
    }
    let oldExtras = document.attributes.extras || {}
    let sentData = oldExtras.sent || []
    // save sent date to document
    const updatedDocument = await document.save({
      extras: Object.assign({}, oldExtras, {
        sent: sentData,
        sendManually: true
      })
    })
    return updatedDocument
  },
  findDocuments: async function(ctx) {
    const user = ctx.session.passport.user
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
      parsedParams.sort = parsedParams.sort ? [parsedParams.sort] : []
    }
    let sortItems = parsedParams.sort || []
    // filter
    let filterParams = parsedParams.filter

    // build query
    let documentTable = strapi.models.document.collectionName
    let uploadTable = strapi.models.upload.collectionName
    let customerTable = strapi.models.customer.collectionName
    let invoiceTable = strapi.models.invoice.collectionName
    let joinTables = []

    let queryModel = Document.query(function(qb) {
      let distinctFields = [`${documentTable}.*`]
      if (!_.isEmpty(sortItems)) {
        sortItems.forEach(sortItem => {
          let sortOption = sortItem
            .replace("-", "")
            .replace("+", "")
            .replace(" ", "")
          if (sortOption.indexOf(".") >= 0) {
            // join field order
            let tableName = sortOption.substr(0, sortOption.indexOf("."))
            if (tableName == uploadTable) {
              qb.leftJoin(`${uploadTable}`, `${documentTable}.upload`, `${uploadTable}.id`)
              joinTables.push(uploadTable)
            }
            if (tableName == customerTable) {
              qb.leftJoin(`${customerTable}`, `${documentTable}.customer`, `${customerTable}.id`)
              joinTables.push(customerTable)
            }

            if (tableName == invoiceTable) {
              qb.leftJoin(`${invoiceTable}`, `${documentTable}.reference_id`, `${invoiceTable}.id`)
              joinTables.push(invoiceTable)
            }

            distinctFields.push(sortOption)
          } else {
            distinctFields.push(`${documentTable}.${sortOption}`)
          }
        })
      }

      let whereParams = (filterParams && filterParams.where) || {}
      let andWhereParams = (filterParams && filterParams.andwhere) || []
      andWhereParams = !_.isArray(andWhereParams) ? [andWhereParams] : andWhereParams
      let orWhereParams = filterParams && filterParams.orwhere
      if (_.isEmpty(andWhereParams) && _.isEmpty(orWhereParams)) {
        andWhereParams.push({ orwhere: whereParams })
      } else {
        andWhereParams.push({ orwhere: orWhereParams })
      }

      // find the table need join on where
      // process mutiple orWhere with and
      if (_.isArray(andWhereParams)) {
        andWhereParams.map(andWhere => {
          if (andWhere.orwhere) {
            let subOrWhere = andWhere.orwhere
            if (_.isArray(subOrWhere)) {
              subOrWhere.map(orWhere => {
                let params = _.assign({}, whereParams, orWhere)
                for (let prop in params) {
                  let objFilter = params[prop]
                  for (let idx in objFilter) {
                    let key = Object.keys(objFilter)[0]
                    if (!operatorMap[key]) {
                      if (!_.includes(joinTables, prop)) {
                        if (prop == uploadTable) {
                          qb.leftJoin(`${uploadTable}`, `${documentTable}.upload`, `${uploadTable}.id`)
                          joinTables.push(uploadTable)
                        }
                        if (prop == customerTable) {
                          qb.leftJoin(`${customerTable}`, `${documentTable}.customer`, `${customerTable}.id`)
                          joinTables.push(customerTable)
                        }

                        if (prop == invoiceTable) {
                          qb.leftJoin(`${invoiceTable}`, `${documentTable}.reference_id`, `${invoiceTable}.id`)
                          joinTables.push(invoiceTable)
                        }
                      }
                    }
                  }
                }
              })
            } else {
              let params = _.assign({}, whereParams, orWhereParams)
              for (let prop in params) {
                let objFilter = params[prop]
                for (let idx in objFilter) {
                  let key = Object.keys(objFilter)[0]
                  if (!operatorMap[key]) {
                    if (!_.includes(joinTables, prop)) {
                      if (prop == uploadTable) {
                        qb.leftJoin(`${uploadTable}`, `${documentTable}.upload`, `${uploadTable}.id`)
                        joinTables.push(uploadTable)
                      }
                      if (prop == customerTable) {
                        qb.leftJoin(`${customerTable}`, `${documentTable}.customer`, `${customerTable}.id`)
                        joinTables.push(customerTable)
                      }
                      if (prop == invoiceTable) {
                        qb.leftJoin(`${invoiceTable}`, `${documentTable}.reference_id`, `${invoiceTable}.id`)
                        joinTables.push(invoiceTable)
                      }
                    }
                  }
                }
              }
            }
          }
        })
      }
      qb.distinct(distinctFields)
      qb.where(function() {
        this.where(`${documentTable}.user`, "=", user.id)
      })
      if (_.isArray(andWhereParams)) {
        andWhereParams.map(andWhere => {
          if (andWhere.orwhere) {
            let subOrWhere = andWhere.orwhere
            qb.andWhere(function() {
              // process mutiple orWhere only
              if (_.isArray(subOrWhere)) {
                subOrWhere.map(orWhere => {
                  this.orWhere(function() {
                    builderQuery(this, _.assign({}, whereParams, orWhere), documentTable)
                  })
                })
              } else {
                this.orWhere(function() {
                  builderQuery(this, _.assign({}, whereParams, subOrWhere), documentTable)
                })
              }
            })
          }
        })
      }

      // add sort

      !_.isEmpty(sortItems) &&
        sortItems.forEach(sortItem => {
          let _sort
          if (sortItem && sortItem.indexOf("-") === 0) {
            _sort = sortItem.slice(1)
          } else if (sortItem) {
            _sort = sortItem
          }

          // The substituted value will be contained in the result variable
          let sortFormatted = _sort.trim()
          if (_sort.indexOf(".") > -1) {
            sortFormatted = sortFormatted.replace(/^(\w*).(\w*)$/g, `"$1"."$2"`)
          }

          const _order = sortItem && sortItem.indexOf("-") === 0 ? "DESC" : "ASC"
          if (_order === "ASC") {
            qb.orderByRaw(`${sortFormatted} ASC`)
          } else {
            qb.orderByRaw(`${sortFormatted} DESC NULLS LAST`)
          }
        })

      // debug
      // qb.debug(true)
    })

    let documentModel = await queryModel.fetchPage({
      pageSize: pageSize, // Defaults to 10 if not specified
      page: page, // Defaults to 1 if not specified
      withRelated: ["customer", "upload", "reference.invoice"]
    })

    return documentModel
  },
  preview: async function(ctx) {
    const values = ctx.request.body
    const schema = joi.object().keys({
      type: joi.string().required(),
      data: joi.object().required()
    })

    const result = joi.validate(values, schema, { allowUnknown: false, abortEarly: false })
    const builder = documnentBuider[values.type]
    if (result.error !== null && !builder) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })

      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    const user = await User.forge({ id: ctx.session.passport.user.id }).fetch({
      withRelated: ["companyLogo", "userlogins", "legalform", "primaryBankaccount"]
    })
    const legalform = user.related("legalform")
    // console.log("user with passport session id", ctx.session.passport.user.id)
    // console.log("user data", user.toJSON())
    let signature
    let clearValues = values.data || {}
    if (clearValues.signature) {
      signature = await Upload.forge({ id: clearValues.signature }).fetch()
      clearValues.signature = signature && signature.toJSON()
    }
    //get document config
    let usersettingModel = await Usersetting.where({ user: user.id, key: "documentConfig" }).fetch()
    if (usersettingModel) {
      clearValues.documentSetting = usersettingModel.attributes.value || {
        footer: common.getDefaultFooterFieldTemplate(legalform.attributes.key)
      }
    } else {
      clearValues.documentSetting = { footer: common.getDefaultFooterFieldTemplate(legalform.attributes.key) }
    }
    // console.log("Footer test")
    // console.log("getDefaultFooterFieldTemplate", clearValues.documentSetting.footer)
    clearValues.userlogin = _.find(_.get(user.toJSON(), "userlogins"), o => o.isMain === true) || {}
    clearValues.documentSetting.footer = common.bindingDataForFooter(clearValues.documentSetting.footer, {
      user: user.toJSON(),
      userlogin: clearValues.userlogin,
      primaryBankaccount: user && user.toJSON().primaryBankaccount
    })
    // Handle signature data
    let requestSignatureData = []
    switch (values.type) {
      case "invoice":
      case "cancellation":
      case "letter":
      case "offer":
        requestSignatureData = clearValues.signatures || []
        break
      case "reminder":
        requestSignatureData = (clearValues.extras && clearValues.extras.signatures) || []
        break
      default:
        break
    }
    let signatureIds = requestSignatureData.filter(s => s !== null) || []
    let signatures = (await common.generateSignatureData(signatureIds, user)) || []

    switch (values.type) {
      case "invoice": {
        const calculateAmount = strapi.services.invoice.calculateAmount(
          clearValues.invoicePositions,
          (clearValues.totaldiscount && clearValues.totaldiscount.value) || 0
        )
        clearValues.amount = calculateAmount && calculateAmount.amount
        let customerModel = await Customer.forge({
          id: clearValues.debtor || null
        }).fetch()
        clearValues.debtor = customerModel && customerModel.toJSON()
        clearValues.owner = user.toJSON()
        user && user.toJSON().legalform && (clearValues.owner.legalform = user && user.toJSON().legalform)
        clearValues.data = _.pick(clearValues, [
          "totaldiscount",
          "introduction",
          "postscript",
          "paymentterm",
          "greeting",
          "signatureName",
          "email",
          "telephone",
          "template",
          "formatting",
          "documentSetting",
          "userlogin",
          "valueAddedTaxId",
          "deliveryDate",
          "hasArticleNumber",
          "fixing",
          "isDecimoMode",
          "isTaxExemptUser",
          "taxExemptHint"
        ])
        clearValues.data.signatures = signatures
        let invoicePositions = []
        for (let invoicePosition of clearValues.invoicePositions) {
          invoicePosition.product = invoicePosition.description
          invoicePosition.product &&
            invoicePosition.price &&
            invoicePositions.push(
              _.pick(invoicePosition, [
                "product",
                "price",
                "quantity",
                "tax",
                "customDescription",
                "unit",
                "articleNumber"
              ])
            )
        }
        clearValues.data.invoicePositions = invoicePositions
        clearValues.status = clearValues.paidCash ? "paidCash" : "created"
        clearValues = _.pick(clearValues, [
          "debtor",
          "invoiceNumber",
          "lastPaymentDate",
          "issueDate",
          "amount",
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
          "faktooraId",
          "letter",
          "documentSetting",
          "userlogin",
          "deduction",
          "valueAddedTaxId",
          "paymentControl"
        ])
        break
      }
      case "letter":
      case "cancellation": {
        clearValues.category = values.type
        clearValues.user = user.toJSON()
        clearValues.content = clearValues.content || ""
        clearValues.extras = _.pick(clearValues, ["email", "telephone", "template"])
        clearValues.extras.signatures = signatures || []
        break
      }
      case "reminder": {
        clearValues.category = values.type
        clearValues.user = user.toJSON()
        clearValues.content = clearValues.content || ""
        clearValues.extras = _.assign(clearValues.extras, _.pick(clearValues, ["email", "telephone", "template"]))
        clearValues.invoice.owner = user.toJSON()
        clearValues.invoice.documentSetting = clearValues.documentSetting
        clearValues.extras.signatures = signatures || []
        break
      }
      case "offer": {
        const calculateAmount = strapi.services.invoice.calculateAmount(
          clearValues.offerPositions,
          (clearValues.totaldiscount && clearValues.totaldiscount.value) || 0
        )
        clearValues.amount = calculateAmount && calculateAmount.amount
        clearValues.owner = user.toJSON()
        user && user.toJSON().legalform && (clearValues.owner.legalform = user && user.toJSON().legalform)
        clearValues.offerPositions = _.filter(
          clearValues.offerPositions,
          o => o && o.description && o.price && o.quantity
        )
        clearValues.postscript = clearValues.postscripts
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
          "email",
          "telephone",
          "template",
          "formatting",
          "documentSetting",
          "userlogin",
          "valueAddedTaxId",
          "hasArticleNumber",
          "isTaxExemptUser"
        ])
        clearValues.data.signatures = signatures
        clearValues = _.pick(clearValues, [
          "customer",
          "offerNumber",
          "signature",
          "lastPaymentDate",
          "issueDate",
          "faktooraId",
          "amount",
          "owner",
          "data",
          "offerOrderNumber",
          "status",
          "letter",
          "documentSetting",
          "userlogin",
          "valueAddedTaxId"
        ])
      }
      default:
        break
    }
    let resultData = {}
    if (!_.isEmpty(clearValues.letter)) {
      signatureIds = _.get(clearValues, "letter.signatures", []).filter(s => s !== null)
      let letterSignatures = (await common.generateSignatureData(signatureIds, user)) || []

      let letter = clearValues.letter
      letter.category = "letter"
      letter.user = user.toJSON()
      letter.userlogin = _.find(letter.user.userlogins, o => o.isMain === true)
      letter.content = letter.content || ""
      letter.signature = clearValues.signature
      letter.documentSetting = clearValues.documentSetting
      letter.extras = _.pick(letter, ["email", "telephone", "template"])
      letter.extras.signatures = letterSignatures
      clearValues.letter = letter
    }
    const binary = await builder(clearValues, strapi.config.environments[strapi.config.environment].uploadFolder, { includedLetter: true, createPdfKit: true })
    resultData.data = binary.toString("base64")
    return resultData
  },
  getInvoiceDocumentsByTimeRange: async function(ctx) {
    const user = ctx.session.passport.user
    const { fromTime, toTime } = ctx.params

    const startOfTheDay = moment(fromTime)
      .startOf("day")
      .format("YYYY-MM-DD HH:mm:ss")
    const endOfTheDay = moment(toTime)
      .endOf("day")
      .format("YYYY-MM-DD HH:mm:ss")

    const queryCb = qb =>
      qb
        .innerJoin("invoice", "invoice.id", "document.reference_id")
        .where("user", "=", user.id)
        .andWhere("reference_type", "=", "invoice")
        .andWhere(function() {
          this.whereIn("invoice.status", [
            "created",
            "sent",
            "overdue",
            "review",
            "available",
            "aborted",
            "rejected",
            "paid",
            "paidCash"
          ])
        })

    const total = await Document.query(queryCb).count("invoice.amount")
    let data = []
    if (total) {
      data = await Document.query(qb =>
        queryCb(qb)
          .select(["invoice.amount", "invoice.lastPaymentDate", "invoice.status"])
          .andWhereBetween("invoice.lastPaymentDate", [startOfTheDay, endOfTheDay])
      ).fetchAll()
    }
    return {
      data,
      total: _.toNumber(total)
    }
  }
}
