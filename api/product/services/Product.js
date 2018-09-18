/* eslint-disable no-undef */ /*, no-unused-vars */
const _ = require("lodash")
const builderQuery = require("../../../utils/builder-query")
const JsonApiError = require("../../../utils/json-api-error")
const joi = require("joi")

const validProduct = joi.object().keys({
  code: joi.string().allow("", null),
  name: joi.string().required(),
  description: joi.string().allow(["", null]),
  unit: joi.string().required(),
  tax: joi.number().required(),
  price: joi.number().required(),
  inventoryCount: joi.number().allow("", null),
  project:joi.string().guid().allow(""),
  time: joi.number(),
  estimate: joi.number().allow("")
})

module.exports = {
  findProducts: async function(ctx) {
    const user = ctx.session.passport.user
    let params = ctx.query

    // parsing params from url queryString
    let parsedParams = {}
    _.keys(params).forEach(key => {
      _.set(parsedParams, key, params[key])
    })
    // Pagination
    let pageOptions = parsedParams.page || {}
    let page = parseInt(pageOptions.number, 10) || 1
    let pageSize = parseInt(pageOptions.size, 10) || 25
    let sort = "-created_at"

    let lastSort = await Usersetting.forge({ user: user.id, key: "productLastSorting" }).fetch()
    if (!_.isUndefined(parsedParams.sort)) {
      sort = parsedParams.sort
    } else {
      if (lastSort) {
        sort = lastSort.toJSON().value.sort
      }
    }
    // build query
    let productTable = strapi.models.product.collectionName

    let queryModel = Product.query(function(qb) {
      // [START] appen sort query
      let distinctFields = [`${productTable}.*`]
      if (!_.isNull(sort)) {
        let sortOption = sort
          .replace("-", "")
          .replace("+", "")
          .replace(" ", "")
        // add sort fields
        distinctFields.push(`${productTable}.${sortOption}`)
      }

      qb.distinct(distinctFields)
      // [END] appen sort query

      // set default filter by ownner user
      qb.where(function() {
        this.where(`${productTable}.user`, "=", user.id)
      })

      // filter
      let filterParams = parsedParams.filter
      const filterFields = ["code", "name", "price"]
      if (!_.isEmpty(filterParams) && _.isString(filterParams)) {
        qb.andWhere(function() {
          filterFields.map(field => {
            this.orWhere(function() {
              builderQuery(this, _.assign({}, { [field]: { like: filterParams } }), productTable)
            })
          })
        })
      }
      // debug
      // qb.debug(true)
    })

    // add sort
    if (!_.isNull(sort)) {
      let _sort
      if (sort && sort.indexOf("-") === 0) {
        _sort = sort.slice(1)
      } else if (sort) {
        _sort = sort
      }
      const _order = sort && sort.indexOf("-") === 0 ? "DESC" : "ASC"
      queryModel = queryModel.orderBy(_sort, _order)
    }
    // Save the last sort
    if (!_.isUndefined(parsedParams.sort)) {
      let lastSortData = {
        user: user.id,
        key: "productLastSorting",
        value: JSON.stringify({ sort: _.trim(parsedParams.sort) })
      }
      if (lastSort) {
        await lastSort.save(lastSortData, { patch: true })
      } else {
        await Usersetting.forge(lastSortData).save()
      }
    }

    let productModel = await queryModel.fetchPage({
      page: page, // Defaults to 1 if not specified
      pageSize: pageSize // Defaults to 25 if not specified
    })

    return productModel
  },
  createOrUpdate: async function(ctx) {
    const { id } = ctx.params || {}
    if (id) {
      productModel = await Product.forge({ id }).fetch()
      if (!productModel) {
        throw new JsonApiError(`E_PRODUCT_NOT_EXIST`, 400, `Cannot update a product not exist.`)
      }
    }
    const body = ctx.request.body
    let values = _.pick(body, ["code", "name", "description", "unit", "tax", "price", "inventoryCount", "project", "time", "estimate", "progress"])
    const result = joi.validate(values, validProduct, {
      allowUnknown: false,
      abortEarly: false
    })
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    const user = ctx.session.passport.user
    const data = _.assign(result.value, { user: user.id })
    const product = id ? await productModel.save(data, { patch: true }) : await Product.forge(data).save()

    return product
  }

}
