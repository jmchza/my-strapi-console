const _ = require("lodash")
const Chance = require("chance")
const chance = new Chance()
const currencyFormatter = require("currency-formatter")
const moment = require("moment-timezone")
const path = require("path")

const operatorMap = {
  gt: ">",
  eq: "=",
  neq: "!=",
  lt: "<",
  gte: ">=",
  lte: "<=",
  in: "in",
  like: "ilike",
  between: "between"
}

function getTimezone(user) {
  if (!user || !user.country || !user.city) {
    return "Europe/Berlin"
  }
  // TODO: try mapping by current support country
  return "Europe/Berlin"
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
const getName = function(fullName) {
  let firstname = fullName
  let lastname = fullName
  let nameArray = fullName.trim().split(" ")
  if (nameArray && nameArray.length > 1) {
    firstname = nameArray.slice(0, -1).join(" ")
    lastname = nameArray.slice(-1).join("")
  }
  return {
    firstname,
    lastname
  }
}
const getAddress = function(fullAddress) {
  let street = fullAddress
  let houseNumber = fullAddress
  let addressArray = fullAddress.trim().split(" ")
  if (addressArray && addressArray.length > 1) {
    houseNumber = addressArray[addressArray.length]
    street = fullAddress.replace(houseNumber, "").trim()
  }
  return {
    street,
    houseNumber
  }
}
const genarateReferenceNumber = (number, isCompany) => {
  return (isCompany ? "C" : "P") + _.padStart(Number(number), 3, "0")
}

const generateFaktooraId = prefix => {
  prefix = prefix || "F"
  return `${prefix}${chance.string({
    length: 6,
    pool: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  })}`
}

function formatCurrency(value) {
  return currencyFormatter.format(value, {
    symbol: "€",
    decimal: ",",
    thousand: ".",
    format: "%v%s"
  })
}

function formatDate(date, dateFormat = "DD.MM.YYYY", user) {
  return moment(date)
    .tz(getTimezone(user))
    .format(dateFormat)
}

async function savePreviousData({ user, key, content }) {
  if (key === "paymentTerms" && content) {
    let regex1 = /\d{2}\.\d{2}\.\d{4}/g
    if (regex1.test(content)) {
      return false
    }
  }
  let usersettingModel = await Usersetting.where({
    user: user.id,
    key
  }).fetch()
  let previous = usersettingModel ? usersettingModel.toJSON() : { key, user: user.id, value: { options: [] } }
  const addDataIfNotExits = (previous, content) => {
    let exitContent = _.find(previous.value.options, o => o.content === content)
    if (content) {
      if (!previous.value || !_.isArray(previous.value.options)) {
        previous.value = { options: [] }
      }
      if (exitContent && exitContent.previous) {
        return
      } else if (!exitContent) {
        previous.value.options = _.concat(previous.value.options, { content })
      }
      previous.value.options = _.map(previous.value.options, (o, index) => {
        if (o.content === content) {
          return _.assign(o, { previous: true, key: index })
        } else {
          return _.assign(_.omit(o, "previous"), { key: index })
        }
      })
    }
    return previous
  }
  if (!_.isEmpty(content)) {
    if (_.isString(content)) {
      previous = addDataIfNotExits(previous, content)
    } else if (_.isArray(content)) {
      content.forEach(o => {
        previous = addDataIfNotExits(previous, o)
      })
    }
    if (usersettingModel) {
      await usersettingModel.save(_.pick(previous, ["value", "key", "user"]), { patch: true })
    } else {
      await Usersetting.forge(_.pick(previous, ["value", "key", "user"])).save()
    }
  }
  return true
}

async function overwritePreviousData({ user, key, value }) {
  let usersettingModel = await Usersetting.where({
    user: _.isObject(user) && user.id ? user.id : user,
    key
  }).fetch()
  let previous = usersettingModel ? usersettingModel.toJSON() : { key, user: user.id, value: {} }
  if (value) {
    previous.value = value
    if (usersettingModel) {
      await usersettingModel.save(_.pick(previous, ["value", "key", "user"]), { patch: true })
    } else {
      await Usersetting.forge(_.pick(previous, ["value", "key", "user"])).save()
    }
  }
  return true
}

function padLeft(nr, n, str) {
  return Array(n - String(nr).length + 1).join(str || "0") + nr
}

const fmt = (str, hash) => {
  let string = str
  for (let key in hash) string = string.replace(new RegExp("\\{" + key + "\\}", "gm"), hash[key])
  return string
}

const availableFooterFields = [
  {
    id: "companyName",
    label: "Firmenname",
    value: "${user.companyName || 'Firmen Name'}",
    isDropField: true
  },
  {
    id: "vatOrTaxNumber",
    label: "St.-Nr. / USt-IdNr.",
    text: {
      valueAddedTaxId: "USt-IdNr.",
      taxIdentNumber: "St.-Nr."
    },
    value: {
      valueAddedTaxId: "${user.valueAddedTaxId}",
      taxIdentNumber: "${user.taxIdentNumber}"
    },
    fields: [{ user: ["valueAddedTaxId"] }, { user: ["taxIdentNumber"] }]
  },
  {
    id: "executiveName",
    label: "Geschäftsführer",
    text: "Geschäftsführer",
    value: "${user.executiveName || '' }",
    fields: {
      user: ["executiveName"]
    }
  },
  {
    id: "address",
    label: "Adresse",
    value: "${user.street || 'Straße / Nr.'} \n ${user.postcode || 'PLZ'} ${user.city || 'Stadt'}",
    fields: {
      user: ["street", "postcode", "city"]
    },
    isDropField: true
  },
  {
    id: "tradeRegisterEntry",
    label: "Handelsregistereintrag",
    value: "Handelsregister-Nr. ${user.tradeRegisterNumber || ''} \n Registergericht ${user.registryCourt || ''}",
    fields: {
      user: ["tradeRegisterNumber", "registryCourt"]
    }
  },
  {
    id: "phone",
    label: "Telefon",
    text: "Telefon",
    value: "${user.phone}",
    fields: {
      user: ["phone"]
    },
    isDropField: true
  },
  {
    id: "email",
    label: "Email",
    text: "Email",
    value: "${userlogin.email}",
    isDropField: true
  },
  {
    id: "bankAccount",
    label: "Bankverbindung",
    value:
      "Kontoinhaber: ${primaryBankaccount && primaryBankaccount.holderName || '' } \n IBAN: ${primaryBankaccount && primaryBankaccount.iban || ''} \n BIC: ${primaryBankaccount && primaryBankaccount.bic || ''} \n Kreditinstitut: ${primaryBankaccount && primaryBankaccount.bankName || ''}",
    fields: {
      primaryBankaccount: ["holderName", "iban", "bic"]
    },
    isDropField: true
  },
  {
    id: "custom",
    label: "Feld bearbeiten",
    text: "",
    value: "Freitext",
    isDropField: true,
    isCustom: true
  }
]
// const defaultSelectedFooterFields = [
//   {
//     id: "companyName",
//     label: "Firmenname",
//     value: "${user.companyName}",
//     isDefault: true
//   },
//   {
//     id: "vatOrTaxNumber",
//     label: "St.-Nr. / USt-IdNr.",
//     text: {
//       valueAddedTaxId: "USt-IdNr.",
//       taxIdentNumber: "St.-Nr."
//     },
//     value: {
//       valueAddedTaxId: "${user.valueAddedTaxId}",
//       taxIdentNumber: "${user.taxIdentNumber}"
//     },
//     isDefault: true
//   },
//   {
//     id: "executiveName",
//     label: "Geschäftsführer",
//     text: "Geschäftsführer",
//     value: "${user.executiveName}",
//     isDefault: true
//   }
// ]

/**
 * Retrieve the default footer fields for a certain legalform
 * @param {String} legalform
 */
let letterFooterColumn = 4
const getDefaultFooterFieldTemplate = legalform => {
  let selecetedFooterFields = []
  let defaultFooterKeys = []
  for (let i = 0; i < letterFooterColumn; i++) {
    defaultFooterKeys.push([])
    selecetedFooterFields.push([])
  }

  // Assign the default entries for the matching legalforms
  switch (legalform) {
    case "individual":
    case "gbr":
      defaultFooterKeys[0] = ["executiveName", "address"]
      defaultFooterKeys[1] = ["email"]
      defaultFooterKeys[2] = ["vatOrTaxNumber"]
      defaultFooterKeys[3] = ["bankAccount"]
      break
    case "ek":
    case "kg":
    case "ohg":
      defaultFooterKeys[0] = ["companyName", "address"]
      defaultFooterKeys[1] = ["email"]
      defaultFooterKeys[2] = ["vatOrTaxNumber", "tradeRegisterEntry"]
      defaultFooterKeys[3] = ["bankAccount"]
      break
    case "gbh": // The key for gmbh in the seed data is wrong
    case "gmbh":
    case "ug":
    case "ag":
    case "agcokg":
    case "gmbhcokg":
    default:
      defaultFooterKeys[0] = ["companyName", "address"]
      defaultFooterKeys[1] = ["email"]
      defaultFooterKeys[2] = ["executiveName", "vatOrTaxNumber", "tradeRegisterEntry"]
      defaultFooterKeys[3] = ["bankAccount"]
      break
  }
  for (let idx in defaultFooterKeys) {
    let availableColFooterFields = defaultFooterKeys[idx]
    _.map(availableFooterFields, obj => {
      if (_.includes(availableColFooterFields, obj.id)) {
        selecetedFooterFields[idx].push(obj)
      }
    })
    selecetedFooterFields[idx] =
      (!_.isEmpty(selecetedFooterFields[idx]) &&
        selecetedFooterFields[idx].sort((a, b) => {
          return selecetedFooterFields[idx].indexOf(a.id) - selecetedFooterFields[idx].indexOf(b.id)
        })) ||
      []
  }

  return selecetedFooterFields
}

const bindingDataForFooter = (data, content) => {
  const { user, userlogin, primaryBankaccount } = content || {}
  if (!_.isEmpty(user.legalform) && !_.isEmpty(user.companyName)) {
    user.companyName = determineCompanyNameWithLegalform(user.companyName, user.legalform)
  }
  let fieldDisplay = _.map(data || [], (lineContents /*, key*/) => {
    return _.map(lineContents || [], obj => {
      if (_.isObject(obj.value)) {
        _.map(obj.value, (val, key2) => {
          obj.value[key2] = eval("`" + val + "`")
        })
      } else {
        // console.log("obj.value", obj.value)
        obj.value = eval("`" + obj.value + "`")
      }
      return obj
    })
  })

  return fieldDisplay
}

/**
 * Determines the complete company name adding the legalform on demand
 * @param {String} companyName
 * @param {Object} legalform
 */
const determineCompanyNameWithLegalform = (companyName, legalform) => {
  let companyNameWithLegalform = companyName

  if (legalform.key === "ug") {
    let ugIndex = companyName.toLowerCase().indexOf("haftungsbeschränkt")
    let ugIndex1 = companyName.toLowerCase().indexOf("UG")
    if (ugIndex > -1 && ugIndex1 > -1) {
      let ugIndex1 = (companyNameWithLegalform = companyName.substring(0, ugIndex1).trim())
    }
    companyNameWithLegalform = `${companyNameWithLegalform} ${legalform.abbrev}`
  } else if (
    legalform.key !== "individual" &&
    !(companyName || "").toLowerCase().endsWith((legalform.abbrev || "").toLowerCase())
  ) {
    companyNameWithLegalform = `${companyName} ${legalform.abbrev}`
  }
  return companyNameWithLegalform
}

const generateSignatureData = async (signatureIds = [], user) => {
  let signatures = []
  await Promise.all(
    signatureIds &&
      signatureIds.map(async sId => {
        let signatureModel = await Usersetting.forge({ id: sId }).fetch()
        let signature = (signatureModel && signatureModel.toJSON()) || {}
        let signatureData = _.pick(signature, ["id", "key"]) || {}
        let signatureItems = _.get(signature, "value.items", [])
        await Promise.all(
          signatureItems.map(async item => {
            switch (item.type) {
              case "image":
                let signatureImg = await Upload.forge({ id: item.value }).fetch()
                item.value = signatureImg && signatureImg.toJSON()
                break
              case "contact":
                let selectedUser = _.find(_.get(user.toJSON(), "userlogins"), o => o.id === item.value)
                if (selectedUser) {
                  item.value = `${selectedUser.firstName} ${selectedUser.lastName}`
                } else {
                  item.value = item.value === user.id && user.toJSON().executiveName
                }
                break
              default:
                item.value = item.value
                break
            }
            return item
          })
        ).then(value => (signatureData.value = value))
        return signatureData
      })
  ).then(signaturesData => (signatures = signaturesData))
  return signatures
}

const flattenJSON = (obj, delimiter) => {
  var delim = delimiter || "."
  var nobj = {}

  _.each(obj, function(val, key) {
    if (_.isPlainObject(val) && !_.isEmpty(val)) {
      var strip = flattenJSON(val, delim)
      _.each(strip, function(v, k) {
        nobj[key + delim + k] = v
      })
    } else if (_.isArray(val) && !_.isEmpty(val)) {
      _.each(val, function(v, index) {
        nobj[key + delim + index] = v
        if (_.isObject(v)) {
          nobj = flattenJSON(nobj, delim)
        }
      })
    } else {
      nobj[key] = val
    }
  })
  return nobj
}

const getFileWithFullPath = async file => {
  let uploadedFile = file
  if (!_.isObject(file)) {
    let fileObj = await Upload.forge({ id: file }).fetch()
    uploadedFile = fileObj.toJSON() || {}
  }
  uploadedFile.fullFilePath = path.join(strapi.config.uploadFolder, uploadedFile.path, uploadedFile.filename)
  return uploadedFile
}

// #3332 - Unify validation of taxIdentNumer
const TAX_IDENT_NUMBER_REGEX = /^[0-9\/]{10,15}$/
const VALUE_ADDED_TAXID_REGEX = /^(DE)?[0-9]{9}$/i

module.exports = {
  operatorMap,
  formatCurrency,
  formatDate,
  padLeft,
  getName,
  getAddress,
  sleep,
  fmt,
  generateFaktooraId,
  genarateReferenceNumber,
  savePreviousData,
  overwritePreviousData,
  bindingDataForFooter,
  getDefaultFooterFieldTemplate,
  determineCompanyNameWithLegalform,
  generateSignatureData,
  flattenJSON,
  getFileWithFullPath,
  TAX_IDENT_NUMBER_REGEX,
  VALUE_ADDED_TAXID_REGEX
}
