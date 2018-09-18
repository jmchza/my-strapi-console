'use strict'

/**
 * A set of functions called "actions" for `Faq`
 */

module.exports = {
  /**
   * @api {get} /faqs Request a list of faqs
   * @apiName getFaqs
   * @apiGroup Faq
   * @apiPermission isAuthenticated
   * @apiParam {String} language Language of Faq.
   *
	 * @apiError Unauthenticated 401 The user is not logged in.
	 * @apiSuccessExample {json} Success-Response:
	 *     HTTP/1.1 200 OK
    {
      "data": [
        {
          "type": "faq",
          "id": "1",
          "attributes": {
            "id":"1",
            "created_at":"2016-11-11T12:52:16.209Z",
            "updated_at":"2016-11-11T12:52:16.209Z",
            "question":"question",
            "answer":"answer",
            "language":"en",
            "category":"buying"
          }
        }
      ]
    }
   */

  find: async (ctx) => {
    try {
      let filter = {
        where: {
          language: {
            eq: ctx.query && ctx.query.language || 'en'
          }
        }
      }
      const user = ctx.session.passport && ctx.session.passport.user
      if (user && user.role === 'admin' && (ctx.query && !ctx.query.language)) {
        filter = {}
      }
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.faq, ctx.query, filter)
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
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.faq, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },
  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.faq, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Update a/an faq entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.faq, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.faq, ctx.params)
    } catch (err) {
      ctx.body = err.toString()
    }
  }
}
