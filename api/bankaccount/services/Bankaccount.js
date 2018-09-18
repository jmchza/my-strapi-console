"use strict"

/**
 * Module dependencies
 */

// Public dependencies.
const _ = require("lodash")

// Strapi utilities.
const utils = require("strapi-hook-bookshelf/lib/utils/")
const finApi = require("../../../utils/finApi")

const co = require("co")
const ibanTool = require("iban")
const JsonApiError = require("../../../utils/json-api-error")
const RESTClient = require("../../../utils/RESTClient")
const IBAN_SERVICE_URL = "https://fintechtoolbox.com/bankcodes/[code].json"
/**
 * A set of functions called "actions" for `Bankaccount`
 */

module.exports = {
  /**
   * services get BIC from IBAN code
   *
   * @return {Object}
   */
  getbic: co.wrap(function*(ctx, onlyGetBic) {
    let iban = (ctx.params && ctx.params.iban) || ""
    iban = iban.replace(/ /g, "")
    if (!iban || iban.length < 12 || !ibanTool.isValid(iban)) {
      throw new JsonApiError(`IBAN_VALIDATION`, 400, "Wrong IBAN format")
    }
    if (!onlyGetBic) {
      yield strapi.services.account.checkIbanExist(ctx)
    }
    let bankCode = iban.substring(4, 12)
    let result = yield RESTClient.get(IBAN_SERVICE_URL.replace("[code]", bankCode))
    if (result && result.bank_code && result.bank_code.bic && result.bank_code.bank_name) {
      return {
        bic: result.bank_code.bic,
        description: result.bank_code.bank_name
      }
    } else {
      throw new JsonApiError(`IBAN_VALIDATION`, 400, "Wrong IBAN")
    }
  }),
  createUserFinapi: async ctx => {
    const currentPlan = await strapi.services.account.getCurrentPlan(ctx)
    if (!["basic", "premium"].includes(currentPlan.plan)) {
      throw new JsonApiError(
        `E_USER_NOT_PREMIUM`,
        403,
        "Nur Benutzer im Premium Tarif können die Factoring Funktion nutzen"
      )
    }
    let id = ctx.session.passport.user.id
    const account = await finApi.createUser({ id })
    await Identification.forge({ identcaseId: id, merchantId: "FINAPI_ACCOUNT", password: account.password }).save()
    await User.forge({ id }).save({ activeBanking: true }, { patch: true })
    return { success: true }
  },
  /**
   * Promise to fetch all bankaccounts.
   *
   * @return {Promise}
   */

  fetchAll: function(params) {
    return new Promise(function(resolve, reject) {
      Bankaccount.forge(params)
        .query(params)
        .fetchAll({
          withRelated: _.keys(
            _.groupBy(_.reject(strapi.models.bankaccount.associations, { autoPopulate: false }), "alias")
          )
        })
        .then(function(bankaccounts) {
          resolve(bankaccounts)
        })
        .catch(function(err) {
          reject(err)
        })
    })
  },

  /**
   * Promise to fetch a/an bankaccount.
   *
   * @return {Promise}
   */

  fetch: function(params) {
    return new Promise(function(resolve, reject) {
      Bankaccount.forge(_.pick(params, "id"))
        .fetch({
          withRelated: _.keys(
            _.groupBy(_.reject(strapi.models.bankaccount.associations, { autoPopulate: false }), "alias")
          )
        })
        .then(function(bankaccount) {
          resolve(bankaccount)
        })
        .catch(function(err) {
          reject(err)
        })
    })
  },

  /**
   * Promise to add a/an bankaccount.
   *
   * @return {Promise}
   */

  add: function(values) {
    return new Promise(function(resolve, reject) {
      Bankaccount.forge(values)
        .save()
        .then(function(bankaccount) {
          resolve(bankaccount)
        })
        .catch(function(err) {
          reject(err)
        })
    })
  },

  /**
   * Promise to edit a/an bankaccount.
   *
   * @return {Promise}
   */

  edit: function(params, values) {
    return new Promise(function(resolve, reject) {
      Bankaccount.forge(params)
        .save(values, { path: true })
        .then(function(bankaccount) {
          resolve(bankaccount)
        })
        .catch(function(err) {
          reject(err)
        })
    })
  },

  /**
   * Promise to remove a/an bankaccount.
   *
   * @return {Promise}
   */

  remove: function(params) {
    return new Promise(function(resolve, reject) {
      Bankaccount.forge(params)
        .destroy()
        .then(function(bankaccount) {
          resolve(bankaccount)
        })
        .catch(function(err) {
          reject(err)
        })
    })
  },

  /**
   * Add relation to a specific bankaccount (only from a to-many relationships).
   *
   * @return {Object}
   */

  addRelation: function(params, values) {
    return new Promise(function(resolve, reject) {
      const relation = _.find(strapi.models.bankaccount.associations, { alias: params.relation })

      if (!_.isEmpty(relation) && _.isArray(values)) {
        switch (relation.nature) {
          case "manyToOne":
            const PK = utils.getPK(_.get(relation, relation.type), undefined, strapi.models)

            const arrayOfPromises = _.map(values, function(value) {
              const parameters = {}

              _.set(parameters, PK, value)
              _.set(parameters, "relation", relation.via)

              return strapi.services[_.get(relation, relation.type)].editRelation(parameters, [
                _.get(params, "id") || null
              ])
            })

            Promise.all(arrayOfPromises)
              .then(function() {
                resolve()
              })
              .catch(function(err) {
                reject(err)
              })
            break
          case "manyToMany":
            Bankaccount.forge(_.omit(params, "relation"))
              [params.relation]()
              .attach(values)
              .then(function(bankaccount) {
                resolve(bankaccount)
              })
              .catch(function(err) {
                reject(err)
              })
            break
          default:
            reject("Impossible to add relation on this type of relation")
        }
      } else {
        reject("Bad request")
      }
    })
  },

  /**
   * Edit relation to a specific bankaccount.
   *
   * @return {Object}
   */

  editRelation: function(params, values) {
    return new Promise(function(resolve, reject) {
      const relation = _.find(strapi.models.bankaccount.associations, { alias: params.relation })

      if (!_.isEmpty(relation) && _.isArray(values)) {
        switch (relation.nature) {
          case "oneWay":
          case "oneToOne":
          case "oneToMany":
            const data = _.set({}, params.relation, _.first(values) || null)

            Bankaccount.forge(_.omit(params, "relation"))
              .save(data, { path: true })
              .then(function(user) {
                resolve()
              })
              .catch(function(err) {
                reject(err)
              })
            break
          case "manyToOne":
            const PK = utils.getPK(_.get(relation, relation.type), undefined, strapi.models)

            Bankaccount.forge(_.omit(params, "relation"))
              .fetch({
                withRelated: _.get(params, "relation")
              })
              .then(function(bankaccount) {
                const data = bankaccount.toJSON() || {}
                const currentValues = _.keys(_.groupBy(_.get(data, _.get(params, "relation")), PK))
                const valuesToRemove = _.difference(currentValues, values)

                const arrayOfPromises = _.map(valuesToRemove, function(value) {
                  const params = {}

                  _.set(params, PK, value)
                  _.set(params, "relation", relation.via)

                  return strapi.services[_.get(relation, relation.type)].editRelation(params, [null])
                })

                return Promise.all(arrayOfPromises)
              })
              .then(function() {
                const arrayOfPromises = _.map(values, function(value) {
                  const params = {}

                  _.set(params, PK, value)
                  _.set(params, "relation", relation.via)

                  return strapi.services[_.get(relation, relation.type)].editRelation(params, [
                    _.get(params, "id") || null
                  ])
                })

                return Promise.all(arrayOfPromises)
              })
              .then(function() {
                resolve()
              })
              .catch(function(err) {
                reject(err)
              })
            break
          case "manyToMany":
            Bankaccount.forge(_.omit(params, "relation"))
              .fetch({
                withRelated: _.get(params, "relation")
              })
              .then(function(bankaccount) {
                const data = bankaccount.toJSON() || {}
                const PK = utils.getPK("Bankaccount", Bankaccount, strapi.models)

                const currentValues = _.keys(_.groupBy(_.get(data, _.get(params, "relation")), PK))
                const valuesToAdd = _.difference(
                  _.map(values, function(o) {
                    return o.toString()
                  }),
                  currentValues
                )

                return Bankaccount.forge(_.omit(params, "relation"))
                  [params.relation]()
                  .attach(valuesToAdd)
                  .then(function() {
                    return bankaccount
                  })
              })
              .then(function(bankaccount) {
                const data = bankaccount.toJSON() || {}
                const PK = utils.getPK("Bankaccount", Bankaccount, strapi.models)

                const currentValues = _.keys(_.groupBy(_.get(data, _.get(params, "relation")), PK))
                const valuesToDrop = _.difference(
                  currentValues,
                  _.map(values, function(o) {
                    return o.toString()
                  })
                )

                return Bankaccount.forge(_.omit(params, "relation"))
                  [params.relation]()
                  .detach(valuesToDrop)
              })
              .then(function() {
                resolve()
              })
              .catch(function(err) {
                reject(err)
              })
            break
          default:
            reject("Impossible to update relation on this type of relation")
        }
      } else {
        reject("Bad request")
      }
    })
  },

  /**
   * Promise to remove a specific entry from a specific bankaccount (only from a to-many relationships).
   *
   * @return {Promise}
   */

  removeRelation: function(params, values) {
    return new Promise(function(resolve, reject) {
      const relation = _.find(strapi.models.bankaccount.associations, { alias: params.relation })

      if (!_.isEmpty(relation) && _.isArray(values)) {
        switch (relation.nature) {
          case "manyToOne":
            const PK = utils.getPK(_.get(relation, relation.type), undefined, strapi.models)

            const arrayOfPromises = _.map(values, function(value) {
              const parameters = {}

              _.set(parameters, PK, value)
              _.set(parameters, "relation", relation.via)

              return strapi.services[_.get(relation, relation.type)].editRelation(parameters, [null])
            })

            Promise.all(arrayOfPromises)
              .then(function() {
                resolve()
              })
              .catch(function(err) {
                reject(err)
              })
            break
          case "manyToMany":
            Bankaccount.forge(_.omit(params, "relation"))
              [params.relation]()
              .detach(values)
              .then(function(bankaccount) {
                resolve(bankaccount)
              })
              .catch(function(err) {
                reject(err)
              })
            break
          default:
            reject("Impossible to delete relation on this type of relation")
        }
      } else {
        reject("Bad request")
      }
    })
  }
}
