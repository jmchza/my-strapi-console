"use strict"

/**
 * A set of functions called "actions" for `User`
 */

module.exports = {
  /**
   * Get user entries.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.user, ctx.query)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Get a specific user.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.user, ctx.params)
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  getLoginUser: async (ctx) => {
    try {
      let user = ctx.session.passport.user
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.user, { id: user.id })
    } catch (err) {
      ctx.body = err.toString()
      ctx.status = err.status || 400
    }
  },

  /**
   * Create decimo Principal
   *
   * @return {Object}
   */

  createDecimoPrincipal: async (ctx) => {
    try {
      ctx.body = await strapi.services.user.transferDecimo(ctx)
    } catch (err) {
      console.log(err)
      ctx.status = 400
      ctx.body = err
    }
  },
  /**
   * redirect decimo entries.
   *
   * @return {Object|Array}
   */
  callbackDecimo: async (ctx) => {
    try {
      const query = ctx.request.query || {}
      const user = ctx.session.passport.user
      if (query.principal_id && query.status === "success") {
        await User.forge({ id: user.id }).save({ principalDecimoId: query.principal_id }, { patch: true })
        let paylod = await strapi.services.jsonapi.fetch(strapi.models.user, { id: user.id })
        io.to(user.id).emit("decimo_completed", paylod.toJSON())
      }
      ctx.body = ""
    } catch (err) {
      ctx.status = 400
      ctx.body = err.toString()
    }
  },

  /**
   * Create a/an user entry.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.user, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Update a/an user entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.user, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Destroy a/an user entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.user, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Add relation to a specific user.
   *
   * @return {Object}
   */

  createRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.addRelation(strapi.models.user, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Update relation to a specific user.
   *
   * @return {Object}
   */

  updateRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.editRelation(strapi.models.user, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * Destroy relation to a specific user.
   *
   * @return {Object}
   */

  destroyRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.removeRelation(strapi.models.user, ctx.params, ctx.request.body)
    } catch (err) {
      ctx.status = 400
      ctx.body = err
    }
  },

  /**
   * change user password.
   *
   * @return {Object}
   */
  changePassword: async (ctx) => {
    try {
      ctx.body = await strapi.services.user.changePassword(ctx)
    } catch (err) {
      ctx.body = err.details ? { errors: err.details } : err
      ctx.status = err.status || 400
    }
  },

  /**
   * update BankAccount of user.
   *
   * @return {Object}
   */
  udpateUserBankAccount: async (ctx) => {
    try {
      ctx.body = await strapi.services.user.udpateUserBankAccount(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = err.details ? { errors: err.details } : err
      ctx.status = err.status || 400
    }
  },

  getCustomers: async (ctx) => {
    var ctx = ctx;

    // await ctx.state._passport.instance.authenticate('bearer', { session: false }, async function (err, user, info) {
    //   if (err) ctx.body = { error: err }
    //   if (!user) ctx.body = { error: info }
    //   else{
    //     ctx.body = await strapi.services.customer.fullTextSearch(ctx);
    //   }
    // });
    try {
      ctx.body = await strapi.services.customer.fullTextSearch(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = err.details ? { errors: err.details } : err
      ctx.status = err.status || 400
    }
  },

  /**
   * update BankAccount of user.
   *
   * @return {Object}
   */
  updateUserField: async (ctx) => {
    try {
      ctx.body = await strapi.services.user.updateUserField(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = err.details ? { errors: err.details } : err
      ctx.status = err.status || 400
    }
  },

  /**
   * Delete logo or signature of user
   *
   * @return {Object}
   */
  deleteUserImage: async (ctx) => {
    try {
      ctx.body = await strapi.services.user.deleteUserImage(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = err.details ? { errors: err.details } : err
      ctx.status = err.status || 400
    }
  },
  uploadUserImage: async (ctx) => {
    try {
      ctx.body = await strapi.services.user.updateUserProfileImage(ctx)
    } catch (err) {
      ctx.body = err.details ? { errors: err.details } : err
      ctx.status = err.status || 400
    }
  },
  userOverview: async (ctx) => {
    try {
      ctx.body = await strapi.services.user.userOverview(ctx)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * update Tax of user.
   *
   * @return {Object}
   */
  saveTax: async (ctx) => {
    try {
      ctx.body = await strapi.services.user.saveTax(ctx)
    } catch (err) {
      ctx.body = err.details ? { errors: err.details } : err
      ctx.status = err.status || 400
    }
  }
}
