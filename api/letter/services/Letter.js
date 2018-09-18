"use strict"
const _ = require("lodash")
const joi = require("joi")
const JsonApiError = require("../../../utils/json-api-error")
const moment = require("moment")
const common = require("../../../utils/common")

module.exports = {
  createOrEditLetter: async function(ctx) {
    const user = ctx.session.passport.user
    let values = ctx.request.body
    let { id } = ctx.params
    let { isDraft } = ctx.query || null
    isDraft = isDraft === "true"

    let schema

    if (isDraft === true) {
      schema = joi.object().keys({
        customer: joi.string().guid(),
        invoice: joi.string().guid(),
        signature: joi.string().guid(),
        subject: joi.string().allow(""),
        salutation: joi.string().allow(""),
        content: joi.string().allow(""),
        greeting: joi.string().allow(""),
        signatureName: joi.string().allow(""),
        category: joi
          .string()
          .allow("letter", "reminder", "cancellation")
          .required(),
        purchasingType: joi.string().guid(),
        invoiceType: joi.string().guid(),
        reminderType: joi.string().guid(),
        cancellationType: joi.string().guid(),
        accountingType: joi.string().guid(),
        sentDate: joi.date(),
        extras: joi.object()
      })
    } else {
      schema = joi.object().keys({
        customer: joi
          .string()
          .guid()
          .required(),
        invoice: joi.string().guid(),
        signature: joi.string().guid(),
        subject: joi.string().required(),
        salutation: joi.string().required(),
        content: joi.string(),
        greeting: joi.string().required(),
        signatureName: joi.string().allow(""),
        category: joi
          .string()
          .allow("letter", "reminder", "cancellation")
          .required(),
        purchasingType: joi.string().guid(),
        invoiceType: joi.string().guid(),
        reminderType: joi.string().guid(),
        cancellationType: joi.string().guid(),
        accountingType: joi.string().guid(),
        sentDate: joi.date(),
        extras: joi.object()
      })
    }

    const categoryKeys = ["purchasingType", "invoiceType", "reminderType", "cancellationType", "accountingType"]
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

    if (isDraft === true) {
      clearValues.status = "draft"
    } else {
      clearValues.status = "created"
    }

    let invoice = {}
    if (clearValues.invoice) {
      invoice = await Invoice.forge({
        id: clearValues.invoice,
        owner: user.id
      }).fetch()
      clearValues.faktooraId = invoice.attributes.faktooraId
      if (invoice === null) {
        throw new JsonApiError(`E_RESOUCE_NOT_ACCESSIABLE`, 404, "Resource could not be found")
      }
    }
    clearValues.user = user.id
    clearValues.clientId = user.clientId
    let signatureIds = _.get(clearValues, "extras.signatures", []).filter(s => s !== null)
    // Handle signature data
    let userData = await User.forge({ id: user.id }).fetch({
      withRelated: ["legalform", "userlogins", "primaryBankaccount"]
    })
    let signatures = (await common.generateSignatureData(signatureIds, userData)) || []

    clearValues.extras.signatures = signatures

    let letter
    if (id) {
      let letterModel = await Letter.forge({ id }).fetch()
      if (!letterModel) {
        throw new JsonApiError(`E_LETTER_NOT_EXIST`, 400, `Cannot update a letter that does not exist.`)
      }
      if (!(letterModel.attributes.status === "draft")) {
        throw new JsonApiError(`E_LETTER_CANNOT_EDIT`, 400, `Cannot update this letter.`)
      }
      letter = await letterModel.save(_.omit(clearValues, categoryKeys), { patch: true })
    } else {
      letter = await Letter.forge(_.omit(clearValues, categoryKeys)).save()
    }

    clearValues.faktooraId = letter.attributes.faktooraId

    // Create document for letter
    if (!id) {
      await Document.forge({
        user: user.id,
        category: clearValues.category,
        customer: clearValues.customer,
        faktooraId: clearValues.faktooraId,
        reference_type: "letter",
        reference_id: letter.id,
        documentType: clearValues.category,
        status: clearValues.status
      }).save()
    } else {
      // #3210 - change contact in draft shows wrong name on page documents (incl. alls subpages)
      const documentLetterModel = await Document.where({
        // documentType: clearValues.category,
        reference_type: "letter",
        reference_id: letter.get("id")
      }).fetch()
      if (documentLetterModel) {
        await documentLetterModel.save(
          {
            customer: clearValues.customer
          },
          { patch: true }
        )
      }
    }

    // 2. Add invoice data about reminder
    if (clearValues.category === "reminder" && !isDraft) {
      let data = _.get(invoice, "attributes.data") || {}

      let reminders = data.reminders || []
      const reminderItem = {
        type: "paymentReminder",
        sendDate: new Date(),
        newPaymentDate: new Date(clearValues.sentDate),
        letter: letter.id
      }

      reminders = [...reminders, reminderItem]
      data.reminders = reminders
      // Exeuction stops here?
      await invoice.save({ data }, { patch: true })
    }

    // add previous content
    let usersettingModel = await Usersetting.forge({
      user: user.id,
      key: "reminderContents"
    }).fetch()
    let reminderContents = usersettingModel
      ? usersettingModel.toJSON()
      : { key: "reminderContents", user: user.id, value: { options: [] } }
    let exitContent = _.filter(reminderContents.value.options, o => o.content === clearValues.content)
    if (clearValues.content && _.isEmpty(exitContent)) {
      reminderContents.value.options.push({ content: clearValues.content })
      reminderContents.value.options = _.map(reminderContents.value.options, (o, index) => _.assign(o, { key: index }))
      if (usersettingModel) {
        await usersettingModel.save(_.pick(reminderContents, ["value", "key", "user"]), { patch: true })
      } else {
        await Usersetting.forge(_.pick(reminderContents, ["value", "key", "user"])).save()
      }
    }

    // add documnent of letter
    let documentIds = []
    for (let i in categoryKeys) {
      let key = categoryKeys[i]
      let referenceId = clearValues[key]
      let category = key.replace("Type", "")
      if (referenceId) {
        clearValues.documentType = letter.attributes.category
        let document = await Document.forge(
          _.assign(_.pick(clearValues, ["user", "customer", "faktooraId", "documentType"]), {
            upload: referenceId,
            category
          })
        ).save()
        documentIds.push(document.id)
      }
    }
    if (!_.isEmpty(documentIds)) {
      await letter.documents().attach(documentIds)
    }
    // Overwrite default setting about template for all doccument
    await common.overwritePreviousData({
      user,
      key: "DocumentTemplateStyleAndColor",
      value: _.get(clearValues, "extras.template")
    })
    if (signatureIds) {
      let lastSignatureData = {
        user: user.id,
        key: "createLetterLastUsedSignatures",
        value: JSON.stringify(signatureIds)
      }
      let lastSignature = await Usersetting.forge({ user: user.id, key: "createLetterLastUsedSignatures" }).fetch()
      if (lastSignature) {
        await lastSignature.save(lastSignatureData, { patch: true })
      } else {
        await Usersetting.forge(lastSignatureData).save()
      }
    }
    return strapi.services.jsonapi.fetch(strapi.models.letter, {
      id: letter.id
    })
  },
  createReminder: async function(ctx) {
    let values = ctx.request.body
    // reminderDate: '0', reminderAction: 'paymentReminder',sentDate: '07.11.2017'
    const { reminderDate, reminderAction, sentDate, invoiceId, email, telephone, template } = values

    /*
        const {user, attachContact, reminderType, invoice, reminderDateCustom} = this.props
    const userlogin = _.find(user.userlogins, o => o.id === user.userloginId) || {}
    const reminders = _.filter(invoice && invoice.letters, o => o && o.category === 'reminder')
    const countReminder = (reminders || []).length
    let values = {
      Tel: userlogin.phone,
      Mail: userlogin.email,
      Nummer: invoice && invoice.invoiceNumber,
      Betrag: invoice && invoice.amount,
      Datum1: formatDate(invoice && invoice.issueDate),
      Datum2: formatDate(invoice && invoice.lastPaymentDate),
      Datum3: formatDate(moment(invoice && invoice.lastPaymentDate).add(7, 'days')),
      Datum4: reminders && reminders[0],
      Datum5: formatDate(moment(invoice && invoice.lastPaymentDate).add(14, 'days')),
      Datum6: reminderDateCustom
    }*/

    // Retrieve invoice
    const { user } = ctx.session.passport
    const invoice = await Invoice.forge({ id: invoiceId }).fetch()
    const userlogin = await Userlogin.forge({ id: user.userloginId }).fetch()

    // reminderAction can be dun or paymentReminder
    let newPaymentDate
    if (reminderDate === "7") {
      newPaymentDate = moment().add(7, "days")
    } else if (reminderDate === "14") {
      newPaymentDate = moment().add(14, "days")
    } else if (reminderDate === "0") {
      newPaymentDate = moment("01.11.2017", "DD.MM.YYYY")
    }

    const signatureName = `${userlogin.attributes.firstName} ${userlogin.attributes.lastName}`

    const { invoiceNumber, amount, lastPaymentDate, issueDate, data, debtor } = invoice.attributes

    const formattedLastPaymentDate = common.formatDate(lastPaymentDate)
    const formattedAmount = common.formatCurrency(amount)
    const formattedIssueDate = common.formatDate(issueDate)
    const formattedNewPaymentDate = common.formatDate(newPaymentDate)

    let subject = ""
    //const invoiceNumber = '
    if (reminderAction === "paymentReminder") {
      subject = `Zahlungserinnerung Rechnung ${invoiceNumber}`
    } else if (reminderAction === "dun") {
      subject = `Mahnung Rechnung ${invoiceNumber}`
    }

    /*

    "app.reminder.create.defined.reminder.withcontact.1": "leider konnten wir bislang auf unsere erste Mahnung vom {Datum4} zu unserer Rechnung {Nummer} vom {Datum1} über den Betrag von {Betrag} Euro noch keinen Zahlungseingang von Ihnen feststellen. Auch wir sind auf einen pünktlichen Zahlungseingang angewiesen, daher bitten wir Sie nochmals, den Rechnungsbetrag bis zum {Datum5} auf unser unten genanntes Bankkonto zu überweisen. Sie können sich und uns weitere Unannehmlichkeiten ersparen, indem Sie unsere Forderung jetzt gleich begleichen. Sie erreichen uns jederzeit per Telefon unter {Tel} oder per E-Mail an {Mail}. Bei Rückfragen können Sie sich jederzeit gerne an uns wenden.",
    "app.reminder.create.defined.reminder.withcontact.2": "unsere Rechnung vom {Datum1} war am {Datum2} zur Zahlung fällig. Bislang konnten wir jedoch keinerlei Reaktion oder einen Zahlungseingang feststellen. Somit müssen wir Ihnen mitteilen, dass wir das gerichtliche Mahnverfahren einleiten, sollten Sie den Betrag von {Betrag} Euro nicht bis zum {Datum6} auf unser unten genanntes Bankkonto überwiesen haben. Gerne möchten wir Ihnen diese Unannehmlichkeiten ersparen. Sie erreichen uns jederzeit per Telefon unter {Tel} oder per E-Mail an {Mail}. Bei Rückfragen können Sie sich jederzeit gerne an uns wenden.",
    */

    const letterData = {
      category: "reminder",
      customer: debtor,
      greeting: "Mit freundlichen Grüßen",
      invoice: invoice.id,
      faktooraId: invoice.attributes.faktooraId,
      salutation: "Sehr geehrte Damen und Herren,",
      sentDate: new Date(),
      signatureName,
      status: "created",
      subject,
      user: user.id,
      clientId: user.clientId,
      extras: { reminderType: "payment", email, telephone, template }
    }

    let letter = await Letter.forge(letterData).save()

    // Add document belonging to letter
    let document = await Document.forge({
      user: user.id,
      category: letter.attributes.category,
      customer: letter.attributes.customer,
      faktooraId: letter.attributes.faktooraId, //
      reference_type: "letter",
      reference_id: letter.id,
      documentType: "reminder", //
      status: "created"
    }).save()

    // 2. Add invoice data about reminder
    let reminders = data.reminders || []
    const reminderItem = {
      type: reminderAction,
      sendDate: new Date(),
      newPaymentDate: new Date(newPaymentDate),
      letter: letter.id
    }
    reminders = [...reminders, reminderItem]
    data.reminders = reminders

    // Overwrite default setting about template for all doccument
    await common.overwritePreviousData({
      user,
      key: "DocumentTemplateStyleAndColor",
      value: template
    })
    await invoice.save({ data }, { patch: true })

    return {
      test: true
    }
  }
}
