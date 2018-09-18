module.exports = {
  feedBack: async (ctx) => {
    try {
      ctx.body = await strapi.services.email.createFeedback(ctx)
    } catch (err) {
      ctx.body = err
    }
  },
  /**
   * Create error reporting
   */
  createErrorReporting: async (ctx) => {
    try {
      ctx.body = await strapi.services.contact.createErrorReporting(ctx)
    } catch (err) {
      ctx.status = isNaN(err.status) ? 400 : err.status
      if (err.details) {
        ctx.body = { errors: err.details }
      } else {
        ctx.body = { errors: JSON.stringify(err) }
      }
    }
  },
  /**
   * Get model entries.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.contact, ctx.query)
      // strapi.services.invoice.fetchAll(ctx.query)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Get a specific bid.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.contact, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Create a/an model entry.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.contact, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Update a/an model entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.contact, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Destroy a/an model entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.contact, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  }
}
