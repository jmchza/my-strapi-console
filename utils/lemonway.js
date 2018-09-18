const _ = require("lodash")
const uuid = require("node-uuid")
const request = require("request")
const fs = require("fs")
const path = require("path")
const JsonApiError = require("./json-api-error")
const Chance = require("chance")
const chance = new Chance()

const dataUpload = {
  identityEvidence: {
    name: "Identitätsnachweis",
    helpText:
      "Dies kann ein Personalausweis, ein EU-Pass oder ein Führerschein sein. Wir benötigen sowohl die Vorder- als auch Rückseite, des Geschäftführers und für jeden Aktionär, der mehr als 25 % der Unternehmensaktien besitzt.",
    uploadType: 0
  },
  bankStatement: {
    name: "Bankauszug",
    helpText:
      "Hier benötigen wir eine Kopie des Bankauszugs vom entsprechenden Geschäftskonto. Bitte beachte, dass diese Vor- und Nachname des Kontoinhabers sowie die IBAN enthält. ",
    uploadType: 2
  },
  incorporationCertificate: {
    name: "Gründungsurkunde oder Zertifikat",
    helpText: "Du kannst alternativ auch dein Handwerkskammer- bzw. IHK-Zertifikat angeben.",
    uploadType: 7
  },
  registrationCertificate: {
    name: "Handelsregisterauszug",
    helpText: "Dieser darf nicht älter als 3 Monate sein.",
    uploadType: 7
  },
  companyAgreement: {
    name: "Gesellschaftsvertrag oder Satzung",
    helpText:
      "Falls nicht in der Satzung präzisiert, benötigen wir vom Geschäftsführer ein unterschriebenes Dokument mit den Aktienverteilungen.",
    uploadType: 11
  }
}
const legalType = {
  individual: {
    name: "Individual",
    beneficial: false,
    require: ["identityEvidence", "bankStatement", "incorporationCertificate"],
    identification: false
  },
  ek: {
    name: "Registered businessman",
    beneficial: true,
    require: ["identityEvidence", "bankStatement", "registrationCertificate", "companyAgreement"],
    identification: false
  },
  gbr: {
    name: "GbR",
    beneficial: true,
    require: ["identityEvidence", "bankStatement", "incorporationCertificate", "companyAgreement"],
    identification: false
  },
  gbh: {
    name: "GmbH",
    beneficial: true,
    require: ["identityEvidence", "bankStatement", "registrationCertificate", "companyAgreement"],
    identification: false
  },
  ag: {
    name: "AG/SA/SE/PLC",
    beneficial: true,
    require: ["identityEvidence", "bankStatement", "registrationCertificate", "companyAgreement"],
    identification: false
  },
  kg: {
    name: "KG",
    beneficial: true,
    require: ["identityEvidence", "bankStatement", "registrationCertificate", "companyAgreement"],
    identification: false
  },
  gmbhcokg: {
    name: "GmbH & Co.KG",
    beneficial: true,
    require: ["identityEvidence", "bankStatement", "registrationCertificate", "companyAgreement"],
    identification: false
  },
  agcokg: {
    name: "AG & Co. KG",
    beneficial: true,
    require: ["identityEvidence", "bankStatement", "registrationCertificate", "companyAgreement"],
    identification: false
  },
  ohg: {
    name: "OHG",
    beneficial: true,
    require: ["identityEvidence", "bankStatement", "registrationCertificate", "companyAgreement"],
    identification: false
  },
  eg: {
    name: "eG",
    beneficial: true,
    require: ["identityEvidence", "bankStatement", "registrationCertificate", "companyAgreement"],
    identification: false
  },
  ug: {
    name: "UG",
    beneficial: true,
    require: ["identityEvidence", "bankStatement", "registrationCertificate", "companyAgreement"],
    identification: false
  }
}

/**
 * Converts a Date() to its matching timestamp
 */
function toTimestamp(strDate) {
  var datum = Date.parse(strDate)
  return datum / 1000
}

/**
 * Checks whether a string or integer contains a valid timestamp
 * @param  {[type]}  dateString [description]
 * @return {Boolean}            [description]
 */
function isValidTimestamp(dateString) {
  const timestamp = Math.round(Number(dateString) * 1000)
  var minDate = new Date("1970-01-01 00:00:01")
  var maxDate = new Date("2100-01-01 00:00:01")
  var date = new Date(timestamp)
  return date > minDate && date < maxDate
}

const beneficialAvailable = type => {
  return legalType[type] && legalType[type].beneficial
}
const getTasks = (type, owners) => {
  const tasks = legalType[type] && legalType[type].require
  let result = []
  _.forEach(tasks, taskTypeId => {
    const task = dataUpload[taskTypeId]
    const newTask = Object.assign(
      {
        key: taskTypeId,
        taskId: uuid.v4()
      },
      task
    )
    result.push(newTask)
  })
  return result
}

const addTask = (currentTasks, { taskType, taskId, file, filename, autoId }) => {
  if (taskId) {
    let taskIndex = _.findIndex(currentTasks, task => task.taskId === taskId)
    if (taskIndex >= 0) {
      let newTask = currentTasks[taskIndex]
      newTask.file = file
      newTask.filename = filename
      currentTasks[taskIndex] = newTask
    }
  } else {
    const maxType = _.maxBy(currentTasks, o => o.forceType || o.uploadType)
    const nextType = (maxType && (maxType.forceType || maxType.uploadType)) + 1
    const newTask = Object.assign(
      {
        key: taskType,
        forceType: nextType, // Add more document of one type
        file,
        filename,
        taskId: autoId
      },
      dataUpload[taskType]
    )
    currentTasks.push(newTask)
  }
  return currentTasks
}
const removeTask = (currentTasks, taskId) => {
  return _.filter(currentTasks, task => task.taskId !== taskId)
}
const initTaskFromType = task => {
  return Object.assign(task, dataUpload[task.taskType])
}
const isFinishedAllTask = tasks => {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    if (!task.file) return false
  }
  return true
}

const mappingLemonwayError = ({ name, error }) => {
  if (error && error.Code) {
    let mappingMsg
    switch (error.Code) {
      case "204":
        mappingMsg = `Die von dir angegebene E-Mail Adresse ${error &&
          error.Error} ist bereits registriert. Solltest du dein Passwort vergessen haben nutze die "Passwort vergessen?" Funktion oder kontaktiere uns direkt.`
        break
      default:
        mappingMsg = JSON.stringify(error)
    }
    return new JsonApiError(`E_SERVICE_LEMONWAY_${error.Code}`, 401, mappingMsg)
  }
  return new JsonApiError(`E_SERVICE_LEMONWAY_${name}`, 401, JSON.stringify(error))
}

const lemonWayService = ({ name, payload, returnKey }) => {
  const lemonConfig = strapi.config.currentEnvironment.lemonway
  return new Promise((resolve, reject) => {
    const options = {
      url: `${lemonConfig.apiURL}/${name}`,
      headers: {
        "User-Agent": "request",
        "Content-type": "application/json",
        Accept: "application/json"
      },
      method: "post",
      body: JSON.stringify(payload)
    }

    request(options, (error, response, body) => {
      if (error) {
        reject(new JsonApiError(`E_SERVICE_LEMONWAY_${name}`, 401, JSON.stringify(error)))
      }
      let result

      try {
        result = JSON.parse(body)
      } catch (error) {
        reject({ statuscode: response.statusCode, error })
      }

      if (_.get(result, `d.${returnKey}`)) {
        resolve(_.get(result, `d.${returnKey}`))
      } else {
        reject(mappingLemonwayError({ name, error: result.d.E }))
      }
    })
  })
}

const registerLemonWay = function(user, ip = "1.1.1.1") {
  const lemonConfig = strapi.config.currentEnvironment.lemonway
  user = _.assign(user, user.userlogins[0])
  let walletPrefix = user.isBuyer ? "B" : "S"
  let walletId = `${walletPrefix}${chance.string({ length: 4, pool: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" })}`

  let payload = {
    p: {
      wlLogin: lemonConfig.username,
      wlPass: lemonConfig.password,
      language: lemonConfig.language,
      version: lemonConfig.version,
      walletIp: ip,
      wallet: walletId,
      clientMail: user.email,
      clientTitle: user.gender === "male" ? "M" : "F",
      clientFirstName: user.firstName,
      clientLastName: user.lastName,
      street: user.street,
      postCode: user.postcode,
      city: user.city,
      ctry: "DEU",
      nationality: "DEU",
      payerOrBeneficiary: 1,
      isCompany: 1,
      companyName: user.companyName,
      birthdate: "01/01/1980",
      companyDescription: "-",
      companyWebsite: "www.faktoora.com"
    }
  }
  return lemonWayService({ name: "RegisterWallet", payload, returnKey: "WALLET" })
}

const registerIbanLemonWay = function(user, wallet, ip = "1.1.1.1", bankaccount) {
  const bank = bankaccount || user.primaryBankaccount
  const lemonConfig = strapi.config.currentEnvironment.lemonway
  let payload = {
    p: {
      wlLogin: lemonConfig.username,
      wlPass: lemonConfig.password,
      language: lemonConfig.language,
      version: lemonConfig.version,
      walletIp: ip,
      wallet: wallet,
      holder: bank.holderName,
      iban: bank.iban,
      bic: bank.bic,
      dom1: "XX",
      dom2: "XX"
    }
  }
  return lemonWayService({ name: "RegisterIBAN", payload, returnKey: "IBAN_REGISTER" })
}

const lemonwayUpload = function({ filePath, ip, walletID, type, fileName, forceType }) {
  const lemonConfig = strapi.config.currentEnvironment.lemonway
  const base64File = new Buffer(fs.readFileSync(filePath)).toString("base64")
  let payload = {
    p: {
      wlLogin: lemonConfig.username,
      wlPass: lemonConfig.password,
      language: lemonConfig.language,
      version: lemonConfig.version,
      walletIp: ip,
      wallet: walletID,
      fileName,
      type: forceType || dataUpload[type].uploadType,
      buffer: base64File
    }
  }
  return lemonWayService({ name: "UploadFile", payload, returnKey: "UPLOAD" })
}

const registerSddMandate = function(user, ip) {
  const lemonConfig = strapi.config.currentEnvironment.lemonway
  let payload = {
    p: {
      wlLogin: lemonConfig.username,
      wlPass: lemonConfig.password,
      language: lemonConfig.language,
      version: lemonConfig.version,
      walletIp: ip,
      wallet: user.walletID,
      holder: user.primaryBankaccount.holderName,
      iban: user.primaryBankaccount.iban,
      bic: user.primaryBankaccount.bic,
      isRecurring: "1",
      street: user.street,
      postCode: user.postcode,
      city: user.city,
      country: "GERMANY",
      mandateLanguage: "de"
    }
  }
  return lemonWayService({ name: "RegisterSddMandate", payload, returnKey: "SDDMANDATE" })
}

const signDocumentInit = function(user, mandate, ip) {
  const lemonConfig = strapi.config.currentEnvironment.lemonway

  let payload = {
    p: {
      wlLogin: lemonConfig.username,
      wlPass: lemonConfig.password,
      language: lemonConfig.language,
      version: lemonConfig.version,
      walletIp: ip,
      wallet: user.walletID,
      mobileNumber: user.phone,
      documentId: mandate.ID,
      documentType: "21",
      returnUrl: `${lemonConfig.returnUrl}/${user.id}/${user.confirmHash}`,
      errorUrl: `${lemonConfig.returnUrl}/${user.id}/${user.errorHash}`
    }
  }
  return lemonWayService({ name: "SignDocumentInit", payload, returnKey: "SIGNDOCUMENT" })
}

const getWalletDetails = function(wallet, email, ip = "1.1.1.1") {
  const lemonConfig = strapi.config.currentEnvironment.lemonway
  let payload = {
    p: {
      wlLogin: lemonConfig.username,
      wlPass: lemonConfig.password,
      language: lemonConfig.language,
      version: lemonConfig.version,
      walletIp: ip,
      wallet,
      email
    }
  }
  if (!wallet) delete payload.p.wallet
  if (!email) delete payload.p.email
  return lemonWayService({ name: "GetWalletDetails", payload, returnKey: "WALLET" })
}

const moneyInSddInit = function(wallet, transactionId, sddMandateId, amount) {
  const lemonConfig = strapi.config.currentEnvironment.lemonway

  let payload = {
    p: {
      wlLogin: lemonConfig.username,
      wlPass: lemonConfig.password,
      language: lemonConfig.language,
      version: lemonConfig.version,
      wallet,
      walletIp: "1.1.1.1",
      sddMandateId,
      amountTot: parseFloat(parseFloat(amount).toFixed(2)),
      comment: transactionId,
      autoCommission: 0
    }
  }
  return lemonWayService({ name: "MoneyInSddInit", payload, returnKey: "TRANS" })
}

const linkAllDocument = async (tasks, wallet, ip) => {
  if (!wallet || !tasks) throw new JsonApiError(`E_SERVICE_LEMONWAY_UPLOAD`, 401, "Missing walletID or tasks")
  if (tasks && tasks.length > 0) {
    for (let i = 0; i < tasks.length; i++) {
      let task = tasks[i]
      if (task.file && task.filename && !task.lemonwayUploadId) {
        const uploadResult = await Upload.forge({ id: task.file }).fetch()
        const filePath = path.join(
          strapi.config.currentEnvironment.uploadFolder,
          uploadResult.attributes.path,
          uploadResult.attributes.filename
        )
        try {
          const lemonResult = await lemonwayUpload({
            filePath,
            fileName: task.filename,
            type: task.key,
            walletID: wallet,
            ip,
            forceType: task.forceType
          })
          task.lemonwayUploadId = lemonResult.ID
          tasks[i] = task
        } catch (error) {
          console.log("Upload error", error)
          continue
        }
      }
    }
  }
  return tasks
}

/**
 * Send P2P payments between two wallets
 * @param  {[type]} debitWallet  [description]
 * @param  {[type]} creditWallet [description]
 * @param  {[type]} amount       [description]
 * @param  {[type]} message      [description]
 * @return {[type]}              [description]
 */

const moneyInWebInit = function(wallet, amount, comment, wkToken) {
  const lemonConfig = strapi.config.currentEnvironment.lemonway

  let payload = {
    p: {
      wlLogin: lemonConfig.username,
      wlPass: lemonConfig.password,
      language: lemonConfig.language,
      version: "1.0",
      walletIp: "1.1.1.1",
      wallet,
      amountTot: amount,
      comment,
      wkToken,
      returnUrl: `${lemonConfig.returnUrl}/${1}/${2}`,
      errorUrl: `${lemonConfig.returnUrl}/${1}/${2}`,
      cancelUrl: `${lemonConfig.returnUrl}/${1}/${2}`,
      registerCard: 1
    }
  }
  return lemonWayService({ name: "MoneyInWebInit", payload, returnKey: "MONEYINWEB" })
}

/**
 * Send P2P payments between two wallets
 * @param  {[type]} debitWallet  [description]
 * @param  {[type]} creditWallet [description]
 * @param  {[type]} amount       [description]
 * @param  {[type]} message      [description]
 * @return {[type]}              [description]
 */

const sendPayment = function(debitWallet, creditWallet, amount, message) {
  const lemonConfig = strapi.config.currentEnvironment.lemonway

  let payload = {
    p: {
      wlLogin: lemonConfig.username,
      wlPass: lemonConfig.password,
      language: lemonConfig.language,
      version: "1.0",
      walletIp: "1.1.1.1",
      debitWallet,
      creditWallet,
      amount,
      message,
      privateData: message
    }
  }
  return lemonWayService({ name: "SendPayment", payload, returnKey: "TRANS_SENDPAYMENT" })
}

/**
 * [description]
 * @param  {[type]} updateDate Can be either a date string or a timestamp
 * @return {[type]}            [description]
 */
const getMoneyInIBANDetails = function(updateDate) {
  const lemonConfig = strapi.config.currentEnvironment.lemonway

  // Convert regular Date to timestamp
  if (!isValidTimestamp(updateDate)) {
    updateDate = toTimestamp(updateDate)
  }

  let payload = {
    p: {
      wlLogin: lemonConfig.username,
      wlPass: lemonConfig.password,
      language: lemonConfig.language,
      version: "1.4",
      walletIp: "1.1.1.1",
      updateDate: updateDate
    }
  }
  return lemonWayService({ name: "GetMoneyInIBANDetails", payload, returnKey: "TRANS.HPAY" })
}

/**
 *
 * @param {*} wallet
 * @param {*} amount
 * @param {*} message
 */
const moneyOut = function(wallet, amount, message) {
  const lemonConfig = strapi.config.currentEnvironment.lemonway
  amount = Number(amount).toFixed(2)

  let payload = {
    p: {
      wlLogin: lemonConfig.username,
      wlPass: lemonConfig.password,
      language: lemonConfig.language,
      version: "1.0",
      walletIp: "1.1.1.1",
      wallet,
      amountTot: amount,
      message
    }
  }
  return lemonWayService({ name: "MoneyOut", payload, returnKey: "TRANS.HPAY" })
}

module.exports = {
  beneficialAvailable,
  getTasks,
  addTask,
  removeTask,
  initTaskFromType,
  registerLemonWay,
  registerIbanLemonWay,
  lemonwayUpload,
  moneyInWebInit,
  registerSddMandate,
  signDocumentInit,
  getWalletDetails,
  isFinishedAllTask,
  moneyInSddInit,
  linkAllDocument,
  sendPayment,
  getMoneyInIBANDetails,
  moneyOut
}
