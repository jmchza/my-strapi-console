"use strict"

/**
 * A set of functions called "actions" for `Blog`
 */

module.exports = {
  getChangelog: async (ctx) => {
    try {
      ctx.body = await strapi.services.changelog.getNewest(ctx)
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
   * @api {get} /Changelog Request a list of Changelog
   * @apiName getNews
   * @apiGroup changelog
   * @apiPermission isAuthenticated
   * @apiParam {String} language Language of Changelog.
   *
	 * @apiError Unauthenticated 401 The user is not logged in.
	 * @apiSuccessExample {json} Success-Response:
	 *     HTTP/1.1 200 OK
    {
      "data": [
        {
          "type": "changelog",
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
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.changelog, ctx.query)
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
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.changelog, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },
  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.changelog, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Update a changelog.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.changelog, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.changelog, ctx.params)
    } catch (err) {
      ctx.body = err.toString()
    }
  }
}
