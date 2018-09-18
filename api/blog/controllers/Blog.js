"use strict"

/**
 * A set of functions called "actions" for `Blog`
 */

module.exports = {
  search: async (ctx) => {
    try {
      ctx.body = await strapi.services.blog.search(ctx)
    } catch (err) {
      if (isNaN(err.status)) {
        ctx.status = 400
      } else {
        ctx.status = err.status
      }
      if (err.details) {
        ctx.body = { errors: err.details }
      } else {
        ctx.body = { errors: JSON.stringify(err) }
      }
    }
  },

  /**
   * @api {get} /Blog Request a list of blog
   * @apiName getNews
   * @apiGroup blog
   * @apiPermission isAuthenticated
   * @apiParam {String} language Language of blog.
   *
	 * @apiError Unauthenticated 401 The user is not logged in.
	 * @apiSuccessExample {json} Success-Response:
	 *     HTTP/1.1 200 OK
    {
      "data": [
        {
          "type": "blog",
          "id": "1",
          "attributes": {
            "id":"1",
            "created_at":"2016-11-11T12:52:16.209Z",
            "updated_at":"2016-11-11T12:52:16.209Z",
            "content":"content",
            "category":"forUser"
          }
        }
      ]
    }
   */
  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.blog, ctx.query)
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  /**
   * Get a specific bid.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.blog, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },
  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.blog, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Update a/an blog entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.blog, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.blog, ctx.params)
    } catch (err) {
      ctx.body = err.toString()
    }
  }
}
