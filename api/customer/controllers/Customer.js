'use strict'
const _ = require('lodash')
const common = require('../../../utils/common')
/**
 * A set of functions called "actions" for `Customer`
 */

module.exports = {
  /**
   * Get customer entries.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.customer, ctx.query)
      // strapi.services.invoice.fetchAll(ctx.query);
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Get a specific customer.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.customer, ctx.params)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * @api {post} /customer Create a new customer
   * @apiName Createcustomer
   * @apiPermission isAuthenticated
   * @apiUse JsonApiHeaders
   * @apiGroup Customer
   *
   *  @apiDescription Creates a new customer
   *
   *  @apiParam {Object} data
   *  @apiParam {String} data.type Must be `customer`
   *  @apiParam {Object} data.attributes
   *  @apiParam {Boolean} [data.attributes.isCompany=false] Customer is a company?
   *  @apiParam {String} data.attributes.name Name of individual or company
   *  @apiParam {String} data.attributes.address Street and housenumber
   *  @apiParam {String} data.attributes.postcode Postcode
   *  @apiParam {String} data.attributes.city City
   *  @apiParam {String} [data.attributes.nameAuthorisedSignatory] Name of the authorised signatory. Only required for companies.

   * @apiParamExample {json} Request-Example:
   {
       "data": {
           "type": "customer",
           "attributes": {
               "isCompany": false,
               "name": "Max Mustermann",
               "email": "test@test.com",
               "address": "Kollbachstraße 1A",
               "postcode": "12345",
               "city": "Dortmund"
           }
       }
   }
   *
   * @apiError Unauthenticated 401 The user is not logged in.
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   {
     "links": {
       "self": "http://localhost:1337/api/v1/customer"
     },
     "data": {
       "type": "customer",
       "id": "2",
       "attributes": {
         "isCompany": false,
         "name": "Max Mustermann",
         "email": "test@test.com",
         "address": "Kollbachstraße 1A",
         "postcode": "12345",
         "city": "Dortmund",
         "updatedAt": "2016-07-27T11:31:51.281Z",
         "createdAt": "2016-07-27T11:31:51.281Z",
         "id": "2"
       }
     }
   }
   */
  create: async (ctx) => {
    try {
      let data = ctx.request.body
      if (_.isObject(data)) {
        let user = ctx.session.passport.user
        data.user = user.id
        const isCompany = _.get(data, 'isCompany')
        // const count = await Customer.query({where: {isCompany}}).count()
        let obj = await strapi.services.customer.generateCustomerNumber(ctx)
        // using faktooraID for save defaultCustomer Id for checking
        data.faktooraId = common.genarateReferenceNumber(obj.customerNumber, isCompany)
      }
      ctx.body = await strapi.services.jsonapi.add(strapi.models.customer, data)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Update a/an customer entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.customer, ctx.params, ctx.request.body)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Destroy a/an customer entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.customer, ctx.params)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Add relation to a specific customer.
   *
   * @return {Object}
   */

  createRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.addRelation(strapi.models.customer, ctx.params, ctx.request.body)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Update relation to a specific customer.
   *
   * @return {Object}
   */

  updateRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.editRelation(strapi.models.customer, ctx.params, ctx.request.body)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Destroy relation to a specific customer.
   *
   * @return {Object}
   */

  destroyRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.removeRelation(strapi.models.customer, ctx.params, ctx.request.body)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Delete customer
   *
   * @return {Object}
   */
  deleteCustomer: async (ctx) => {
    try {
      ctx.body = await strapi.services.customer.deleteCustomer(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },
  /**
   * Generate an customerNumber
   *
   * @return {Object}
   */
  generateCustomerNumber: async (ctx) => {
    try {
      ctx.body = await strapi.services.customer.generateCustomerNumber(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },
  /**
   * @api {get} /customer/search/:searchstring Search for a customer based on his name
   * @apiParam {String} searchstring Needle to search for
   * @apiName SearchCustomer
   * @apiPermission isAuthenticated
   * @apiGroup Customer
   *
   * @apiDescription
   * This endpoint looks for customers matching `searchstring` partially and case-insensitive.
   *
   * @apiError Unauthenticated 401 The user is not logged in.
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   [
     {
       "id": 1,
       "created_at": "2016-08-03T16:25:23.622Z",
       "updated_at": "2016-08-03T16:25:23.622Z",
       "isCompany": false,
       "name": "Heiner Lauterbach",
       "nameAuthorisedSignatory": null,
       "address": "Katschhöf 23",
       "postcode": "12435",
       "city": "Berlin"
     }
   ]
   */
}