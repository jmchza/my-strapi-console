"use strict"

/**
 * Module dependencies
 */

// Public dependencies.
const _ = require("lodash")
const joi = require("joi")
const JsonApiError = require("../../../utils/json-api-error")
// Strapi utilities.
const utils = require("strapi-hook-bookshelf/lib/utils/")

/**
 * A set of functions called "actions" for `Invoicesale`
 */

module.exports = {
  /**
   * Promise to fetch all invoicesales.
   *
   * @return {Promise}
   */

  fetchAll: function(params) {
    return new Promise(function(resolve, reject) {
      Invoicesale.forge(params)
        .query(params)
        .fetchAll({
          withRelated: _.keys(
            _.groupBy(_.reject(strapi.models.invoicesale.associations, { autoPopulate: false }), "alias")
          )
        })
        .then(function(invoicesales) {
          resolve(invoicesales)
        })
        .catch(function(err) {
          reject(err)
        })
    })
  },

  /**
   * Promise to fetch a/an invoicesale.
   *
   * @return {Promise}
   */

  fetch: function(params) {
    return new Promise(function(resolve, reject) {
      Invoicesale.forge(_.pick(params, "id"))
        .fetch({
          withRelated: _.keys(
            _.groupBy(_.reject(strapi.models.invoicesale.associations, { autoPopulate: false }), "alias")
          )
        })
        .then(function(invoicesale) {
          resolve(invoicesale)
        })
        .catch(function(err) {
          reject(err)
        })
    })
  },

  /**
   * Promise to add a/an invoicesale.
   *
   * @return {Promise}
   */

  add: function(values) {
    return new Promise(function(resolve, reject) {
      Invoicesale.forge(values)
        .save()
        .then(function(invoicesale) {
          resolve(invoicesale)
        })
        .catch(function(err) {
          reject(err)
        })
    })
  },

  /**
   * Promise to edit a/an invoicesale.
   *
   * @return {Promise}
   */

  edit: function(params, values) {
    return new Promise(function(resolve, reject) {
      Invoicesale.forge(params)
        .save(values, { path: true })
        .then(function(invoicesale) {
          resolve(invoicesale)
        })
        .catch(function(err) {
          reject(err)
        })
    })
  },

  /**
   * Promise to remove a/an invoicesale.
   *
   * @return {Promise}
   */

  remove: function(params) {
    return new Promise(function(resolve, reject) {
      Invoicesale.forge(params)
        .destroy()
        .then(function(invoicesale) {
          resolve(invoicesale)
        })
        .catch(function(err) {
          reject(err)
        })
    })
  },

  /**
   * Add relation to a specific invoicesale (only from a to-many relationships).
   *
   * @return {Object}
   */

  addRelation: function(params, values) {
    return new Promise(function(resolve, reject) {
      const relation = _.find(strapi.models.invoicesale.associations, { alias: params.relation })

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
            Invoicesale.forge(_.omit(params, "relation"))
              [params.relation]()
              .attach(values)
              .then(function(invoicesale) {
                resolve(invoicesale)
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
   * Edit relation to a specific invoicesale.
   *
   * @return {Object}
   */

  editRelation: function(params, values) {
    return new Promise(function(resolve, reject) {
      const relation = _.find(strapi.models.invoicesale.associations, { alias: params.relation })

      if (!_.isEmpty(relation) && _.isArray(values)) {
        switch (relation.nature) {
          case "oneWay":
          case "oneToOne":
          case "oneToMany":
            const data = _.set({}, params.relation, _.first(values) || null)

            Invoicesale.forge(_.omit(params, "relation"))
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

            Invoicesale.forge(_.omit(params, "relation"))
              .fetch({
                withRelated: _.get(params, "relation")
              })
              .then(function(invoicesale) {
                const data = invoicesale.toJSON() || {}
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
            Invoicesale.forge(_.omit(params, "relation"))
              .fetch({
                withRelated: _.get(params, "relation")
              })
              .then(function(invoicesale) {
                const data = invoicesale.toJSON() || {}
                const PK = utils.getPK("Invoicesale", Invoicesale, strapi.models)

                const currentValues = _.keys(_.groupBy(_.get(data, _.get(params, "relation")), PK))
                const valuesToAdd = _.difference(
                  _.map(values, function(o) {
                    return o.toString()
                  }),
                  currentValues
                )

                return Invoicesale.forge(_.omit(params, "relation"))
                  [params.relation]()
                  .attach(valuesToAdd)
                  .then(function() {
                    return invoicesale
                  })
              })
              .then(function(invoicesale) {
                const data = invoicesale.toJSON() || {}
                const PK = utils.getPK("Invoicesale", Invoicesale, strapi.models)

                const currentValues = _.keys(_.groupBy(_.get(data, _.get(params, "relation")), PK))
                const valuesToDrop = _.difference(
                  currentValues,
                  _.map(values, function(o) {
                    return o.toString()
                  })
                )

                return Invoicesale.forge(_.omit(params, "relation"))
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
   * Promise to remove a specific entry from a specific invoicesale (only from a to-many relationships).
   *
   * @return {Promise}
   */

  removeRelation: function(params, values) {
    return new Promise(function(resolve, reject) {
      const relation = _.find(strapi.models.invoicesale.associations, { alias: params.relation })

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
            Invoicesale.forge(_.omit(params, "relation"))
              [params.relation]()
              .detach(values)
              .then(function(invoicesale) {
                resolve(invoicesale)
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
  updateInvoiceSale: async function(ctx) {
    const values = ctx.request.body
    const { id } = ctx.params

    const schema = joi.object().keys({
      amount: joi
        .number()
        .required()
        .positive()
        .max(999999.99),
      minimumBid: joi
        .number()
        .positive()
        .max(joi.ref("amount")),
      selloutBid: joi
        .number()
        .min(joi.ref("minimumBid"))
        .max(joi.ref("amount")),
      sendInvoice: joi.boolean()
    })

    const result = joi.validate(values, schema, { allowUnknown: false, abortEarly: false })

    // Throw validate errors
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }

    // checkout owner
    let invoice = await new Invoice({
      invoicesale: id,
      owner: ctx.session.passport.user.id
    }).fetch() // or null

    if (invoice === null) {
      throw new JsonApiError(`E_RESOURCE_NOT_EXISTS`, 404)
    }

    let invoicesaleModel = await Invoicesale.forge({ id: id }).fetch()
    if (invoicesaleModel === null) {
      throw new JsonApiError(`E_RESOURCE_NOT_EXISTS`, 404)
    }

    const clearValues = result.value

    let invoiceSaleData = _.pick(clearValues, [
      "debtorRating",
      "debtorRegion",
      "minimumBid",
      "selloutBid",
      "sendInvoice",
      "sentInvoice"
    ])
    await invoicesaleModel.save(invoiceSaleData, { patch: true })

    return invoicesaleModel
  },
  acceptBid: async function(ctx) {
    let invoicesaleId = ctx.params.id
    let bidId = ctx.params.bidid
    let bidObj
    const schema = joi.object().keys({
      id: joi
        .string()
        .required()
        .guid(),
      bidid: joi.string().guid()
    })

    const result = joi.validate(ctx.params, schema, { allowUnknown: false })
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    // check invoice exist and owner
    let invoiceTableName = strapi.models.invoice.collectionName
    let invoicesaleTableName = strapi.models.invoicesale.collectionName
    // let invoicesale = await Invoicesale.forge({id: invoicesaleId, seller: ctx.session.passport.user.id}).fetch()
    let invoicesale = await Invoicesale.query(function(qb) {
      qb.innerJoin(`${invoiceTableName}`, `${invoiceTableName}.id`, `${invoicesaleTableName}.invoice`)
      qb.where(`${invoiceTableName}.owner`, "=", ctx.session.passport.user.id)
      qb.andWhere(`${invoicesaleTableName}.id`, "=", invoicesaleId)
    }).fetch()
    let invoice = await Invoice.forge({ invoicesale: invoicesale.id }).fetch()
    if (invoicesale === null) {
      throw new JsonApiError(`E_RESOURCE_NOT_EXISTS`, 404)
    } else if (invoice.attributes.status === "sold") {
      throw new JsonApiError(`E_INVOICE_ALREADY_SOLD`, 406, `The invoice is sold`)
    }

    // check have any bids and get highestBid
    let bidHighestModel = await Bid.forge({ invoicesale: invoicesaleId })
      .orderBy("amount", "desc")
      .fetch({ withRelated: ["bidder"] })
    if (!bidHighestModel) {
      throw new JsonApiError(`E_INVOICE_NOT_HAVE_ANY_BID`, 406, `The invoice didn't have any bid`)
    }

    if (bidId) {
      bidObj = await new Bid({
        id: bidId,
        invoicesale: invoicesaleId
      }).fetch()

      if (bidObj === null) {
        throw new JsonApiError(`E_BID_NOT_EXISTS`, 404)
      }
    } else {
      bidObj = bidHighestModel
    }

    await invoicesale.save(
      { highestBid: bidObj.attributes.amount, buyer: bidObj.attributes.bidder, winningBid: bidObj.id },
      { patch: true }
    )
    await invoice.save({ status: "sold" }, { patch: true })

    await Notification.forge({
      type: "invoiceYouAcceptedBid",
      data: {
        faktooraId: invoice.attributes.faktooraId,
        buyerName: bidHighestModel.related("bidder").attributes.companyName,
        invoiceNumber: invoice.attributes.invoiceNumber
      },
      invoice: invoice.id,
      recipient: invoice.attributes.owner
    }).save()

    await Notification.forge({
      type: "invoiceBidWasAccepted",
      data: {
        invoice: invoice.attributes.invoiceNumber,
        faktooraId: invoice.attributes.faktooraId
      },
      invoice: invoice.id,
      recipient: bidObj.attributes.bidder
    }).save()

    return invoicesale
  },
  abort: async function(ctx) {
    let invoicesaleId = ctx.params.id
    const schema = joi.object().keys({
      id: joi
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
    const invoice = Invoice.forge({ owner: ctx.session.passport.user.id, invoicesale: invoicesaleId })

    if (invoice === null) {
      throw new JsonApiError(`E_RESOURCE_NOT_EXISTS`, 404)
    } else if (invoice.attributes.status !== "available") {
      throw new JsonApiError(`E_INVOICE_CANNOT_ABORT`, 406, `The invoice cannot abort`)
    }

    await invoice.save({ status: "aborted" }, { patch: true })

    return invoice
  }
}
