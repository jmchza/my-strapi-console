module.exports = {
  /**
 * Get model entries.
 *
 * @return {Object|Array}
 */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.supporttask, ctx.query)
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
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.supporttask, ctx.params)
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
      ctx.body = await strapi.services.jsonapi.add(strapi.models.supporttask, ctx.request.body)
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
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.supporttask, ctx.params, ctx.request.body)
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
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.supporttask, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  }
}
