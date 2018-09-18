"use strict"

/**
 * Module dependencies
 */

/**
 * A set of functions called "actions" for `Customer`
 */
const joi = require("joi")
const _ = require("lodash")
const JsonApiError = require("../../../utils/json-api-error")
const common = require("../../../utils/common")
const padLeft = require("../../../utils/common").padLeft
const builderQuery = require("../../../utils/builder-query")

module.exports = {
  addOrEditMyCustomer: async function(ctx) {
    const user = ctx.session.passport.user
    const body = ctx.request.body
    const id = ctx.params && ctx.params.id
    let values = body
    const schema = joi.object().keys({
      isCompany: joi.bool().required(),
      name: joi.string().allow(""),
      title: joi.string().allow(""),
      firstName: joi.string().allow(""),
      lastName: joi.string().allow(""),
      nameAuthorisedSignatory: joi.string(),
      address: joi.string().required(),
      postcode: joi
        .string()
        .required()
        .when("country", { is: "DE", then: joi.string().length(5) })
        .when("country", { is: "AT", then: joi.string().length(4) })
        .when("country", { is: "CH", then: joi.string().length(4) }),
      city: joi.string().required(),
      legalform: joi
        .string()
        .guid()
        .empty(""),
      industry: joi
        .string()
        .guid()
        .empty(""),
      email: joi
        .string()
        .email()
        .allow(""),
      customerId: joi.string().allow(""),
      category: joi.string().allow(""),
      country: joi.string().allow(""),
      phoneNo: joi.string().allow(""),
      faxNo: joi.string().allow(""),
      gender: joi.string().allow(""),
      taxId: joi.string().allow(""),
      vatId: joi.string().allow(""),
      extras: joi.object().required()
    })

    const result = joi.validate(values, schema, { allowUnknown: false, abortEarly: false })
    const clearValues = result.value
    if (result.error !== null) {
      let details = Array.from(result.error.details, el => {
        return { message: el.message }
      })
      throw new JsonApiError(`E_VALIDATION`, 400, details)
    }
    if (!_.isUndefined(values.legalform) && _.isUndefined(clearValues.legalform)) {
      clearValues.legalform = null
    }
    if (!_.isUndefined(values.industry) && _.isUndefined(clearValues.industry)) {
      clearValues.industry = null
    }
    let customer
    if (id) {
      customer = await Customer.forge({ id, user: user.id }).fetch()
      if (!customer) {
        throw new JsonApiError(`E_CUSTOMER_RESOURCE_NOT_EXISTS`, 400, `Customer with ${id} dose not exists`)
      }
      await customer.save(_.omit(clearValues, ["isCompany"]), { patch: true })
    } else {
      // const count = await Customer.query({where: {isCompany: clearValues.isCompany}}).count()
      clearValues.user = user.id
      let obj = await strapi.services.customer.generateCustomerNumber(ctx)
      // using faktooraID for save defaultCustomer Id for checking
      clearValues.faktooraId = common.genarateReferenceNumber(obj.customerNumber, clearValues.isCompany)
      customer = await Customer.forge(clearValues).save()
    }
    return await strapi.services.jsonapi.fetch(strapi.models.customer, {
      id: customer.id
    })
  },
  editFielValue: async function(ctx) {
    const user = ctx.session.passport.user
    const body = ctx.request.body
    const id = ctx.params && ctx.params.id
    let customer = await Customer.forge({ id, user: user.id }).fetch()
    if (!customer) {
      throw new JsonApiError(`E_CUSTOMER_RESOURCE_NOT_EXISTS`, 400, `Customer with ${id} dose not exists`)
    }
    customer.save(body, { patch: true })
    customer.attributes = _.assign(customer.attributes, body)
    return customer
  },
  search: function(ctx) {
    if (typeof ctx.params.needle !== "string" || ctx.params.needle === "") {
      return Customer.query(qb => {
        qb.where("user", "=", ctx.session.passport.user.id)
        qb.where("isDelete", "=", false)
        qb.orderBy("updated_at", "desc")
      }).fetchPage({ limit: 20 })
    }
    const needle = `%${ctx.params.needle}%`
    return Customer.query(qb => {
      qb.where("user", "=", ctx.session.passport.user.id)
      qb.where("isDelete", "=", false)
      qb.where(function() {
        this.where("name", "ILIKE", needle)
        this.orWhere("nameAuthorisedSignatory", "ILIKE", needle)
        this.orWhere("address", "ILIKE", needle)
        this.orWhere("postcode", "ILIKE", needle)
        this.orWhere("city", "ILIKE", needle)
        this.orWhere("email", "ILIKE", needle)
        this.orWhere("country", "ILIKE", needle)
        this.orWhere("customerId", "ILIKE", needle)
      })
      // qb.debug(true)
    }).fetchPage({ limit: 5 })
  },
  fullTextSearch: async function(ctx) {
    let userId = ctx.session.passport.user.id
    let params = ctx.query
    // parsing param
    let parsedParams = {}
    _.keys(params).forEach(key => {
      _.set(parsedParams, key, params[key])
    })
    // Pagination
    let pageOptions = parsedParams.page || {}
    let page = parseInt(pageOptions.number, 10) || 1
    let pageSize = parseInt(pageOptions.size, 10) || 25
    // sorting
    if (parsedParams.sort && parsedParams.sort.indexOf(",") > 0) {
      parsedParams.sort = parsedParams.sort.split(",")
    } else {
      parsedParams.sort = parsedParams.sort ? [parsedParams.sort] : []
    }
    let sortItems = parsedParams.sort || []
    // filter
    let filterParams = parsedParams.filter

    let customerTableName = strapi.models.customer.collectionName
    let invoiceTableName = strapi.models.invoice.collectionName
    let queryModel = Customer.query(function(qb) {
      let distinctFields = [`${customerTableName}.*`]
      if (!_.isEmpty(sortItems)) {
        sortItems.forEach(sortItem => {
          let sortOption = sortItem
            .replace("-", "")
            .replace("+", "")
            .replace(" ", "")
          if (sortOption.indexOf(".") >= 0) {
            // join field order
            distinctFields.push(sortOption)
          } else {
            distinctFields.push(`${customerTableName}.${sortOption}`)
          }
        })
      }
      qb.leftJoin(`${invoiceTableName}`, `${invoiceTableName}.debtor`, `${customerTableName}.id`)

      let whereParams = (filterParams && filterParams.where) || {}
      let andWhereParams = (filterParams && filterParams.andwhere) || []
      andWhereParams = !_.isArray(andWhereParams) ? [andWhereParams] : andWhereParams
      let orWhereParams = filterParams && filterParams.orwhere
      if (_.isEmpty(andWhereParams) && _.isEmpty(orWhereParams)) {
        andWhereParams.push({ orwhere: whereParams })
      } else {
        andWhereParams.push({ orwhere: orWhereParams })
      }

      qb.distinct(distinctFields)
      qb.where(function() {
        this.where(`${invoiceTableName}.owner`, "=", userId).orWhere(`${customerTableName}.user`, "=", userId)
        this.andWhere("isDelete", "=", false)
      })
      if (_.isArray(andWhereParams)) {
        andWhereParams.map(andWhere => {
          if (andWhere.orwhere) {
            let subOrWhere = andWhere.orwhere
            qb.andWhere(function() {
              // process mutiple orWhere only
              if (_.isArray(subOrWhere)) {
                subOrWhere.map(orWhere => {
                  this.orWhere(function() {
                    builderQuery(this, _.assign({}, whereParams, orWhere), customerTableName)
                  })
                })
              } else {
                this.orWhere(function() {
                  builderQuery(this, _.assign({}, whereParams, subOrWhere), customerTableName)
                })
              }
            })
          }
        })
      }
      // debug
      // qb.debug(true)
    })

    // add sort
    !_.isEmpty(sortItems) &&
      sortItems.forEach(sortItem => {
        let _sort
        if (sortItem && sortItem.indexOf("-") === 0) {
          _sort = sortItem.slice(1)
        } else if (sortItem) {
          _sort = sortItem
        }
        const _order = sortItem && sortItem.indexOf("-") === 0 ? "DESC" : "ASC"
        queryModel = queryModel.orderBy(_sort, _order)
      })

    let customerModel = await queryModel.fetchPage({
      pageSize: pageSize,
      page: page,
      withRelated: ["invoices"]
    })

    return customerModel
    /*
    queryModel = queryModel.query(qb => {
      qb.leftJoin(`${invoiceTableName}`,
          `${invoiceTableName}.debtor`, `${customerTableName}.id`)
      qb.where("isDelete", "=", false)
      qb.andWhere(function () {
        if (searchKey) {
          const needle = `%${searchKey}%`
          this.where(function () {
            this.where(`${invoiceTableName}.owner`, '=', userId)
          .orWhere(`${customerTableName}.user`, '=', userId)
          }).andWhere(function () {
            this.where(`${customerTableName}.name`, 'ILIKE', needle).orWhere('nameAuthorisedSignatory', 'ILIKE', needle)
            this.orWhere(`${customerTableName}.address`, 'ILIKE', needle)
          })
          if (category) {
            this.where(`${customerTableName}.category`, '=', category)
          }
        } else {
          if (category) {
            this.where(function () {
              this.where(`${invoiceTableName}.owner`, '=', userId)
              .orWhere(`${customerTableName}.user`, '=', userId)
            }).andWhere(function () {
              this.where(`${customerTableName}.category`, '=', category)
            })
          } else {
            this.where(`${invoiceTableName}.owner`, '=', userId)
            .orWhere(`${customerTableName}.user`, '=', userId)
          }
        }
      })
      // qb.debug(true)
    })
    */
  },
  deleteCustomer: async function(ctx) {
    let id = ctx.params.id
    let userId = ctx.session.passport.user.id

    // check customer is link to userid
    let customerModel = await Customer.forge({ id: id, user: userId }).fetch()
    if (!customerModel) {
      throw new JsonApiError("E_CUSTOMER_NOT_EXIST", 400, `Customer is not exist`)
    }
    await customerModel.save({ isDelete: true }, { patch: true })
    return { id }
  },
  /**
   * Generate an customerNumber
   */
  generateCustomerNumber: async function(ctx) {
    let userId = ctx.session.passport.user.id
    const statisticModel = await Usersetting.where({
      user: userId,
      key: "userStatistics"
    }).fetch({ withRelated: ["user"] })
    let number
    if (!statisticModel) {
      number = 0
    } else {
      let statistics = statisticModel.toJSON()
      number = (!_.isEmpty(statistics) && !_.isEmpty(statistics.value) && statistics.value.customerCount) || 0
    }

    return { customerNumber: padLeft(parseInt(number) + 1, 3, "0") }
  }
}
