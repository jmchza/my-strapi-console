"use strict"

/**
 * A set of functions called "actions" for `Bid`
 */

module.exports = {
  /**
   * Get bid entries.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.bid, ctx.query)
      // strapi.services.invoice.fetchAll(ctx.query)
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
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.bid, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Get bid entries.
   *
   * @return {Object|Array}
   */
  getBidsOfInvoice: async (ctx) => {
    try {
      ctx.body = await strapi.services.bid.getBidsOfInvoice(ctx)
    } catch (err) {
      console.log(err)
      ctx.body = { errors: err.details }
      ctx.status = isNaN(err.status) ? 400 : err.status
    }
  },

  /**
   * @api {post} /bid Create a new bid on an invoice
   * @apiName CreateBid
   * @apiGroup Bid
   * @apiPermission isAuthenticated
   * @apiUse JsonApiHeaders
   *
   * @apiDescription Place a bid on an invoice as the currently logged in user
   * If the amount is lower than the current highest bid an error with the code
   * `E_HIGHER_BID` is returned
   *
   * @apiParam {Object} data
   * @apiParam {String} data.type Must be `bid`
   * @apiParam {Object} data.attributes
   * @apiParam {Number} data.attributes.amount Amount of bid to place on invoice
   * @apiParam {Number} data.attributes.invoice ID of invoice to place the bid on
   *
   * @apiSuccess {Object} data The newly created `Bid` model
   */
  create: async (ctx) => {
    try {
      ctx.request.body.bidder = ctx.session.passport.user.id
      ctx.body = await strapi.services.jsonapi.add(strapi.models.bid, ctx.request.body)
    } catch (err) {
      ctx.body = { errors: err.details }
      ctx.status = err.status
    }
  },

  /**
   * Update a/an bid entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.bid.edit(ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Destroy a/an bid entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.bid.remove(ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Add relation to a specific bid.
   *
   * @return {Object}
   */

  createRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.bid.addRelation(ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Update relation to a specific bid.
   *
   * @return {Object}
   */

  updateRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.bid.editRelation(ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Destroy relation to a specific bid.
   *
   * @return {Object}
   */

  destroyRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.bid.removeRelation(ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  }
}
