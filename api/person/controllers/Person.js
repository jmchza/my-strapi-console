'use strict'

/**
 * A set of functions called "actions" for `Person`
 */

module.exports = {
  /**
   * Get person entries.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.person, ctx.query)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Get a specific person.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.person, ctx.params)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * @api {post} /person Create a new person
   * @apiName Createperson
   * @apiPermission isAuthenticated
   * @apiUse JsonApiHeaders
   * @apiGroup Person
   *
   *  @apiDescription Creates a new person
   *
   *  @apiParam {Object} data
   *  @apiParam {String} data.type Must be `person`
   *  @apiParam {Object} data.attributes
   *  @apiParam {String} data.attributes.name Name of person
   *  @apiParam {String} data.attributes.gender Gender (male / female)
   *  @apiParam {String} data.attributes.phoneNo Phone Number
   *  @apiParam {String} data.attributes.eMail Email
   *  @apiParam {String} data.attributes.note Note
   * @apiParamExample {json} Request-Example:
   {
     "data": {
       "type": "person",
       "attributes": {
         "name": "Max Mustermann",
         "eMail": "test@test.com",
         "phoneNo": "123 456789",
         "postcode": "12345",
         "gender": "female"
       }
     }
   }
   *
   * @apiError Unauthenticated 401 The user is not logged in.
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   {
     "links": {
       "self": "http://localhost:1337/api/v1/person"
     },
     "data": {
       "type": "person",
       "id": "2",
       "attributes": {
         "updatedAt": "2016-07-27T11:31:51.281Z",
         "createdAt": "2016-07-27T11:31:51.281Z",
         "id": "2"
         "name": "Max Mustermann",
         "eMail": "test@test.com",
         "phoneNo": "123 456789",
         "postcode": "12345",
         "gender": "female"
       }
     }
   }
   */
  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.person, ctx.request.body)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Update a/an person entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.person, ctx.params, ctx.request.body)
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
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.person, ctx.params)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Add relation to a specific person.
   *
   * @return {Object}
   */

  createRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.addRelation(strapi.models.person, ctx.params, ctx.request.body)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Update relation to a specific person.
   *
   * @return {Object}
   */

  updateRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.editRelation(strapi.models.person, ctx.params, ctx.request.body)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Destroy relation to a specific person.
   *
   * @return {Object}
   */

  destroyRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.removeRelation(strapi.models.person, ctx.params, ctx.request.body)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  }
}
