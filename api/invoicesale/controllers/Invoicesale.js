'use strict'

/**
 * A set of functions called "actions" for `Invoicesale`
 */

module.exports = {
  /**
   * Get invoicesale entries.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.invoicesale, ctx.query)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Get a specific invoicesale.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.invoicesale, ctx.params, null, ctx.query)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Create a/an invoicesale entry.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.invoicesale, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Update a/an invoicesale entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.invoicesale, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Destroy a/an invoicesale entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.invoicesale, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Add relation to a specific invoicesale.
   *
   * @return {Object}
   */

  createRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.invoicesale.addRelation(ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Update relation to a specific invoicesale.
   *
   * @return {Object}
   */

  updateRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.invoicesale.editRelation(ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Destroy relation to a specific invoicesale.
   *
   * @return {Object}
   */

  destroyRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.invoicesale.removeRelation(ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
  * @api {post} /invoicesale/:id/acceptbid Accept a highest bid
  * @apiName AcceptHighestBid
  * @apiGroup Invoicesale
  * @apiPermission isAuthenticated
  * @apiUse JsonApiHeaders
  *
  * @apiDescription the seller can manual accept a bid (=status: available)
  *  @apiParam {String} id UUID of invoicesale to accept
  *  @apiParam {Object} data
  *  @apiParam {String} data.type Must be `invoice`
  *
  *  @apiSuccess {Object} invoicesale
  *  @apiError E_RESOURCE_NOT_EXISTS 404 Either the invoice doesn't exist or it
  *  doesn't belong to the logged in user
  *  @apiError E_INVOICE_ALREADY_SOLD 406 The invoice has been sold
  *  @apiError E_INVOICE_NOT_HAVE_ANY_BID 406 The invoice did not have any bid
  *
  */
  acceptbid: async (ctx) => {
    try {
      ctx.body = await strapi.services.invoicesale.acceptBid(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
  * @api {post} /invoicesale/:id/abort Abort an invoicesale
  * @apiName AbortInvoice
  * @apiGroup Invoicesale
  * @apiPermission isAuthenticated
  * @apiUse JsonApiHeaders
  *
  * @apiDescription Seller is able abort selling invoicesale (=status: abort)
  *  @apiParam {String} id UUID of invoicesale to abort
  *  @apiParam {Object} data
  *  @apiParam {String} data.type Must be `invoicesale`
  *
  *  @apiSuccess {Object} invoicesale
  *  @apiError E_RESOURCE_NOT_EXISTS 404 Either the invoice doesn't exist or it
  *  doesn't belong to the logged in user
  *  @apiError E_INVOICE_CANNOT_ABORT 406 The invoicesale cannnot abort
  *
  */
  abort: async (ctx) => {
    try {
      ctx.body = await strapi.services.invoicesale.abort(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  /**
   * Update invoicesale
   */

  updateInvoiceSale: async (ctx) => {
    try {
      ctx.body = await strapi.services.invoicesale.updateInvoiceSale(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }

      ctx.body = { 'errors': err.details }
      ctx.status = err.status
    }
  }
}
