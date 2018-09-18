"use strict"

/**
 * Module dependencies
 */
const joi = require("joi")
const co = require("co")
// Public dependencies.
const _ = require("lodash")

// Strapi utilities.
const utils = require("strapi-hook-bookshelf/lib/utils/")
const JsonApiError = require("../../../utils/json-api-error")

/**
 * A set of functions called "actions" for `Bid`
 */

module.exports = {
  /**
   * Promise to edit a/an bid.
   *
   * @return {Promise}
   */

  edit: function(params, values) {
    return new Promise(function(resolve, reject) {
      Bid.forge(params)
        .save(values, { path: true })
        .then(function(bid) {
          resolve(bid)
        })
        .catch(function(err) {
          reject(err)
        })
    })
  },

  /**
   * Promise to remove a/an bid.
   *
   * @return {Promise}
   */

  remove: function(params) {
    return new Promise(function(resolve, reject) {
      Bid.forge(params)
        .destroy()
        .then(function(bid) {
          resolve(bid)
        })
        .catch(function(err) {
          reject(err)
        })
    })
  },

  /**
   * Add relation to a specific bid (only from a to-many relationships).
   *
   * @return {Object}
   */

  addRelation: function(params, values) {
    return new Promise(function(resolve, reject) {
      const relation = _.find(strapi.models.bid.associations, { alias: params.relation })

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
            Bid.forge(_.omit(params, "relation"))
              [params.relation]()
              .attach(values)
              .then(function(bid) {
                resolve(bid)
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
   * Edit relation to a specific bid.
   *
   * @return {Object}
   */

  editRelation: function(params, values) {
    return new Promise(function(resolve, reject) {
      const relation = _.find(strapi.models.bid.associations, { alias: params.relation })

      if (!_.isEmpty(relation) && _.isArray(values)) {
        switch (relation.nature) {
          case "oneWay":
          case "oneToOne":
          case "oneToMany":
            const data = _.set({}, params.relation, _.first(values) || null)

            Bid.forge(_.omit(params, "relation"))
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

            Bid.forge(_.omit(params, "relation"))
              .fetch({
                withRelated: _.get(params, "relation")
              })
              .then(function(bid) {
                const data = bid.toJSON() || {}
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
            Bid.forge(_.omit(params, "relation"))
              .fetch({
                withRelated: _.get(params, "relation")
              })
              .then(function(bid) {
                const data = bid.toJSON() || {}
                const PK = utils.getPK("Bid", Bid, strapi.models)

                const currentValues = _.keys(_.groupBy(_.get(data, _.get(params, "relation")), PK))
                const valuesToAdd = _.difference(
                  _.map(values, function(o) {
                    return o.toString()
                  }),
                  currentValues
                )

                return Bid.forge(_.omit(params, "relation"))
                  [params.relation]()
                  .attach(valuesToAdd)
                  .then(function() {
                    return bid
                  })
              })
              .then(function(bid) {
                const data = bid.toJSON() || {}
                const PK = utils.getPK("Bid", Bid, strapi.models)

                const currentValues = _.keys(_.groupBy(_.get(data, _.get(params, "relation")), PK))
                const valuesToDrop = _.difference(
                  currentValues,
                  _.map(values, function(o) {
                    return o.toString()
                  })
                )

                return Bid.forge(_.omit(params, "relation"))
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
   * Promise to remove a specific entry from a specific bid (only from a to-many relationships).
   *
   * @return {Promise}
   */

  removeRelation: function(params, values) {
    return new Promise(function(resolve, reject) {
      const relation = _.find(strapi.models.bid.associations, { alias: params.relation })

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
            Bid.forge(_.omit(params, "relation"))
              [params.relation]()
              .detach(values)
              .then(function(bid) {
                resolve(bid)
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
  },

  getBidsOfInvoice: co.wrap(function*(ctx) {
    const schema = joi.object().keys({
      invoicesale: joi
        .string()
        .required()
        .guid()
    })
    const result = joi.validate(ctx.params, schema, { allowUnknown: false })
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    let invoicesaleId = ctx.params.invoicesale
    const user = ctx.session.passport.user
    const invcoie = yield Invoice.where({ invoicesale: invoicesaleId }).fetch()
    if (
      user.isBuyer &&
      (invcoie.attributes.clientId || user.clientId) &&
      invcoie.attributes.clientId !== user.clientId
    ) {
      throw new JsonApiError(`E_METHOD_NOT_ALLOWED`, 400, "You can't access resource")
    }
    let filter = {
      where: {
        invoicesale: {
          eq: invoicesaleId
        }
      },
      exclude: ["invoicesale"]
    }
    let bids = yield strapi.services.jsonapi.fetchAll(strapi.models.bid, ctx.query, filter)
    return bids
  })
}
