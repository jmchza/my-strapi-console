'use strict'

/**
 * A set of functions called "actions" for `Userlogin`
 */

module.exports = {
  /**
   * Get userlogin entries.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.userlogin, ctx.query)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Get a specific userlogin.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.userlogin, ctx.params)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Create a/an userlogin entry.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.userlogin, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Update a/an userlogin entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.userlogin, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString
    }
  },

  updateUserlogin: async (ctx) => {
    try {
      ctx.body = await strapi.services.userlogin.updateUserlogin(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  addUserlogin: async (ctx) => {
    try {
      ctx.body = await strapi.services.userlogin.addUserlogin(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },

  deleteUserlogin: async (ctx) => {
    try {
      ctx.body = await strapi.services.userlogin.deleteUserlogin(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },
  /**
   * Destroy a/an userlogin entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.userlogin, ctx.params)
    } catch (err) {
      ctx.body = err.toString
    }
  },

  /**
   * forgot user password.
   *
   * @return {Object}
   */
  forgotPassword: async (ctx) => {
    try {
      ctx.body = await strapi.services.userlogin.forgotPassword(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status
    }
  },

  /**
   * change user password.
   *
   * @return {Object}
   */
  changePassword: async (ctx) => {
    try {
      ctx.body = await strapi.services.userlogin.changePassword(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { 'errors': err.details }
      ctx.status = err.status
    }
  },

  /**
   * Add relation to a specific userlogin.
   *
   * @return {Object}
   */

  createRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.addRelation(strapi.models.userlogin, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Update relation to a specific userlogin.
   *
   * @return {Object}
   */

  updateRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.editRelation(strapi.models.userlogin, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Destroy relation to a specific userlogin.
   *
   * @return {Object}
   */

  destroyRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.removeRelation(strapi.models.userlogin, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  }
}
