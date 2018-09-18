const request = require("request")
const _ = require("lodash")
const JsonApiError = require("./json-api-error")
const RedisClient = require("./redis-client")

//test
/* const strapi = {
  config: {
    finApi: {
      apiURL: "https://docs.finapi.io",
      client_id: "928859e3-3fb1-448a-85f3-7b87b755b792",
      client_secret: "c7c744e0-a132-4dc9-a92a-72a7cb68f994"
    }
  }
} */
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
const callApi = ({ name, method = "post", payload, params, access_token }) => {
  const finApiConfig = strapi.config.currentEnvironment.finApi
  return new Promise((resolve, reject) => {
    const url = buildUrl(finApiConfig.apiURL, name, params)
    const options = {
      url,
      headers: {
        "User-Agent": "request",
        "Content-type": "application/json",
        Accept: "application/json"
      },
      method,
      body: JSON.stringify(payload)
    }
    if (access_token) options.headers.Authorization = ` Bearer ${access_token}`

    request(options, (error, response, body) => {
      if (error) {
        reject(new JsonApiError(`E_SERVICE_FINAPI_${name}`, 401, JSON.stringify(error)))
      }
      let result
      try {
        result = JSON.parse(body)
      } catch (error) {
        reject({ statuscode: response.statusCode, error })
      }
      if (!(response.statusCode >= 200 && response.statusCode < 300)) {
        result = (result.errors && result.errors[0]) || result || {}
        if (response.statusCode === 451) {
          result.message = JSON.stringify({
            location: _.get(response, "headers.location"),
            body: result
          })
        }
        reject(
          new JsonApiError(
            result.code || `E_SERVICE_FINAPI_${name}`,
            response.statusCode,
            result.message || JSON.stringify(result)
          )
        )
      }
      resolve(result)
    })
  })
}
const auth = async ({ username, password, grant_type = "password" }, ctx) => {
  const redisClient = RedisClient(strapi.config.currentEnvironment.genericSession).getInstance()
  const finApiConfig = strapi.config.currentEnvironment.finApi
  const userId = _.get(ctx, "session.passport.user.id")
  if (userId) {
    const token = await redisClient.get(`${userId}__FINAPI_TOKEN`)
    if (token) return token
    if (!username || !password) {
      const identification = await Identification.where({ identcaseId: userId, merchantId: "FINAPI_ACCOUNT" }).fetch()
      if (identification) {
        username = userId
        password = identification.attributes.password
      }
    }
  }
  return callApi({
    name: "oauth/token",
    params: {
      grant_type,
      client_id: finApiConfig.client_id,
      client_secret: finApiConfig.client_secret,
      username,
      password
    }
  }).then(data => {
    if (userId) {
      redisClient.set(`${userId}__FINAPI_TOKEN`, data.access_token, "EX", data.expires_in)
    }
    return data.access_token
  })
}
const getAllBankConnections = async ({ username, password }, ctx) => {
  return await auth({ username, password }, ctx).then(access_token =>
    callApi({
      name: "api/v1/bankConnections",
      method: "GET",
      access_token
    }).then(data => data.connections)
  )
}
const createUser = async data => {
  return await auth({ grant_type: "client_credentials" }).then(access_token =>
    callApi({
      name: "api/v1/users",
      method: "POST",
      access_token,
      payload: data
    })
  )
}
const getAndSearchAllAccounts = async ({ username, password }, ctx) => {
  return await auth({ username, password }, ctx)
    .then(access_token =>
      callApi({
        name: "api/v1/bankConnections",
        method: "GET",
        access_token
      }).then(data => ({
        connections: data.connections,
        access_token
      }))
    )
    .then(({ connections, access_token }) => {
      const accountIds = _.reduce(
        connections,
        function(result, connection) {
          return result.concat(connection.accountIds)
        },
        []
      )
      return callApi({
        name: "api/v1/accounts",
        method: "GET",
        access_token,
        params: { accountIds: accountIds.join() }
      }).then(data => ({
        accounts: data.accounts,
        connections
      }))
    })
}
const getAndSearchAllTransactions = async (args, ctx) => {
  const { username, password } = args
  let params = _.assign(
    { view: "bankView", direction: "all", includeChildCategories: true, page: args.page || 1, perPage: 20 },
    _.omit(args, ["username", "password"])
  )
  return await auth({ username, password }, ctx).then(access_token =>
    callApi({
      name: "api/v1/transactions",
      method: "GET",
      access_token,
      params
    })
  )
}
const importBankConnection = async ({ username, password, data }, ctx) => {
  return await auth({ username, password }, ctx).then(access_token =>
    callApi({
      name: "api/v1/bankConnections/import",
      method: "POST",
      access_token,
      payload: data || ctx.request.body
    })
  )
}
const editBankConnection = async ({ username, password, id, data }, ctx) => {
  return await auth({ username, password }, ctx).then(access_token =>
    callApi({
      name: `api/v1/bankConnections/${id || ctx.params.id}`,
      method: "PATCH",
      access_token,
      payload: data || ctx.request.body
    })
  )
}
const deleteBankConnection = async ({ username, password, id }, ctx) => {
  return await auth({ username, password }, ctx).then(access_token =>
    callApi({
      name: `api/v1/bankConnections/${id || ctx.params.id}`,
      method: "DELETE",
      access_token
    })
  )
}

const getAndSearchAllBanks = async ({ username, password, params }, ctx) => {
  return await auth({ username, password, grant_type: "client_credentials" }).then(access_token =>
    callApi({
      name: "api/v1/banks",
      method: "GET",
      access_token,
      params: params || ctx.request.query
    })
  )
}

module.exports = {
  auth,
  createUser,
  getAllBankConnections,
  getAndSearchAllTransactions,
  getAndSearchAllAccounts,
  importBankConnection,
  editBankConnection,
  deleteBankConnection,
  getAndSearchAllBanks
}
