/* eslint-disable no-undef */ /*, no-unused-vars */
const _ = require("lodash")
const builderQuery = require("../../../utils/builder-query")
const JsonApiError = require("../../../utils/json-api-error")
const joi = require("joi")

const validProduct = joi.object().keys({
  code: joi.string().allow("", null),
  name: joi.string().required(),
  description: joi.string().allow(["", null]),
  price: joi.number().required(),
  totalTime: joi.number().allow("", null),
  customer: joi.string().guid().allow(""),
  afterhours: joi.boolean().allow(""),
  duedate: joi.date().allow(""),
  estimate: joi.number().allow(""),
  fixprice: joi.boolean().allow("")
})

module.exports = {
  // findProducts: async function(ctx) {
  //   const user = ctx.session.passport.user
  //   let params = ctx.query
  //
  //   // parsing params from url queryString
  //   let parsedParams = {}
  //   _.keys(params).forEach(key => {
  //     _.set(parsedParams, key, params[key])
  //   })
  //   // Pagination
  //   let pageOptions = parsedParams.page || {}
  //   let page = parseInt(pageOptions.number, 10) || 1
  //   let pageSize = parseInt(pageOptions.size, 10) || 25
  //   let sort = "-created_at"
  //
  //   let lastSort = await Usersetting.forge({ user: user.id, key: "productLastSorting" }).fetch()
  //   if (!_.isUndefined(parsedParams.sort)) {
  //     sort = parsedParams.sort
  //   } else {
  //     if (lastSort) {
  //       sort = lastSort.toJSON().value.sort
  //     }
  //   }
  //   // build query
  //   let productTable = strapi.models.product.collectionName
  //
  //   let queryModel = Product.query(function(qb) {
  //     // [START] appen sort query
  //     let distinctFields = [`${productTable}.*`]
  //     if (!_.isNull(sort)) {
  //       let sortOption = sort
  //         .replace("-", "")
  //         .replace("+", "")
  //         .replace(" ", "")
  //       // add sort fields
  //       distinctFields.push(`${productTable}.${sortOption}`)
  //     }
  //
  //     qb.distinct(distinctFields)
  //     // [END] appen sort query
  //
  //     // set default filter by ownner user
  //     qb.where(function() {
  //       this.where(`${productTable}.user`, "=", user.id)
  //     })
  //
  //     // filter
  //     let filterParams = parsedParams.filter
  //     const filterFields = ["code", "name", "price"]
  //     if (!_.isEmpty(filterParams) && _.isString(filterParams)) {
  //       qb.andWhere(function() {
  //         filterFields.map(field => {
  //           this.orWhere(function() {
  //             builderQuery(this, _.assign({}, { [field]: { like: filterParams } }), productTable)
  //           })
  //         })
  //       })
  //     }
  //     // debug
  //     // qb.debug(true)
  //   })
  //
  //   // add sort
  //   if (!_.isNull(sort)) {
  //     let _sort
  //     if (sort && sort.indexOf("-") === 0) {
  //       _sort = sort.slice(1)
  //     } else if (sort) {
  //       _sort = sort
  //     }
  //     const _order = sort && sort.indexOf("-") === 0 ? "DESC" : "ASC"
  //     queryModel = queryModel.orderBy(_sort, _order)
  //   }
  //   // Save the last sort
  //   if (!_.isUndefined(parsedParams.sort)) {
  //     let lastSortData = {
  //       user: user.id,
  //       key: "productLastSorting",
  //       value: JSON.stringify({ sort: _.trim(parsedParams.sort) })
  //     }
  //     if (lastSort) {
  //       await lastSort.save(lastSortData, { patch: true })
  //     } else {
  //       await Usersetting.forge(lastSortData).save()
  //     }
  //   }
  //
  //   let productModel = await queryModel.fetchPage({
  //     page: page, // Defaults to 1 if not specified
  //     pageSize: pageSize // Defaults to 25 if not specified
  //   })
  //
  //   return productModel
  // },
  createOrUpdate: async function(ctx) {
    const { id } = ctx.params || {}
    if (id) {
      projectModel = await Project.forge({ id }).fetch()
      if (!projectModel) {
        throw new JsonApiError(`E_PRODUCT_NOT_EXIST`, 400, `Cannot update a project does not exist.`)
      }
    }
    const body = ctx.request.body
    let values = _.pick(body, ["code", "name", "description", "price", "totalTime", "fixprice", "afterhours", "customer", "duedate", "estimate"])
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
    // const user = ctx.session.passport.user
    const data = _.assign(result.value)
    const project = id ? await projectModel.save(data, { patch: true }) : await Project.forge(data).save()

    return project
  },
  // findProductByProject: async function(ctx){
  //   const { project } = ctx.params || {}
  //   console.log(ctx.params);
  //   if (project) {
  //     productModel = await Product.forge({ project }).fetch()
  //     if (!productModel) {
  //       throw new JsonApiError(`E_PRODUCT_NOT_EXIST`, 400, `Cannot update a product not exist.`)
  //     }
  //     console.log(productModel);
  //     return productModel;
  //   }
  // }

}
