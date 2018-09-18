const request = require("request")
const _ = require("lodash")
const JsonApiError = require("./json-api-error")
const paramToString = param => {
  if (param == undefined || param == null) {
    return ""
  }
  if (param instanceof Date) {
    return param.toJSON()
  }
  return param.toString()
}
const buildUrl = (basePath, path, params = {}) => {
  if (!path.match(/^\//)) {
    path = "/" + path
  }
  let url = basePath + path
  let paramsArray = []
  _.forEach(params, (v, k) => {
    paramsArray.push(`${k}=${encodeURIComponent(paramToString(v))}`)
  })
  if (!_.isEmpty(paramsArray)) url = url + "?" + paramsArray.join("&")
  return url
}
const callApi = ({ name, method = "post", body, params, formData }) => {
  const decimoConfig = strapi.config.currentEnvironment.decimo
  return new Promise((resolve, reject) => {
    const url = buildUrl(decimoConfig.apiURL, name, params)
    const options = {
      url,
      headers: {
        "User-Agent": "request",
        "Content-type": formData ? undefined : "application/json",
        Accept: "application/json",
        "X-AUTH-TOKEN": decimoConfig.token
      },
      method,
      formData,
      body: body && JSON.stringify(body)
    }
    request(options, (error, response, body) => {
      if (error) {
        reject(new JsonApiError(`E_SERVICE_DECIMO_${name}`, 401, JSON.stringify(error)))
      }
      let result
      try {
        result = JSON.parse(body)
      } catch (error) {
        reject({ statuscode: response.statusCode, error })
      }
      if (!(response.statusCode >= 200 && response.statusCode < 300)) {
        reject(new JsonApiError(`E_SERVICE_DECIMO_${name}`, response.statusCode, JSON.stringify(result)))
      }
      resolve(result)
    })
  })
}
module.exports = callApi

module.exports.mapLegalType = legalformKey => {
  switch (legalformKey) {
    case "individual":
      return { type: "NaturalPerson", legal_form: "individual" }
    case "kg":
    case "ohg":
      return { type: "LegalEntity", legal_form: "partnership" }
    case "gbh":
    case "gmbhcokg":
      return { type: "LegalEntity", legal_form: "gmbh" }
    case "ug":
      return { type: "LegalEntity", legal_form: "ug" }
    case "ag":
    case "agcokg":
      return { type: "LegalEntity", legal_form: "ag" }
    case "gbr":
      return { type: "LegalEntity", legal_form: "public_law" }
    default:
      return {}
  }
}
module.exports.getStatus = state => {
  switch (state) {
    case "pending_syntax":
    case "pending_limits":
    case "pending_feedback":
    case "pending_payout":
      return "review"
    case "outstanding":
      return "sold"
    case "settled_partially":
    case "settled_completely":
      return "paid"
    case "declined":
      return "rejected"
    default:
      return undefined
  }
}
