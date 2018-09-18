"use strict"

/**
 * A set of functions called "actions" for `settings`
 */
const _ = require("lodash")

module.exports = {
  /**
   * Get a specific preview
   *
   * @return stream pdf
   */

  preview: async (ctx) => {
    try {
      ctx.body = await strapi.services.document.preview(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status || 400
    }
  },
  /**
   * Get a specific settings.
   *
   * @return {Object|Array}
   */

  send: async (ctx) => {
    try {
      ctx.body = await strapi.services.document.send(ctx)
    } catch (err) {
      console.log(err)
      ctx.body = err.toString()
    }
  },

  findByReference: async (ctx) => {
    try {
      ctx.body = await Document.forge(ctx.params).fetch({ withRelated: ["upload", "reference", "customer"] })
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Get industry settings.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.document, ctx.query)
    } catch (err) {
      ctx.body = err.toString()
    }
  },

  /**
   * Get a specific settings.
   *
   * @return {Object|Array}
   */

  findOne: async (ctx) => {
    try {
      let model = await strapi.services.jsonapi.fetch(strapi.models.document, ctx.params)
      if (model && model.attributes.reference_type === "offer") {
        let letter = await Letter.forge({ offer: model.attributes.reference_id }).fetch({ withRelated: ["customer"] })
        model.attributes.attachLetter = letter && letter.toJSON()
      } else if (model && model.attributes.reference_type === "invoice") {
        let letter = await Letter.forge({ invoice: model.attributes.reference_id }).fetch({ withRelated: ["customer"] })
        model.attributes.attachLetter = letter && letter.toJSON()
      } else if (
        model &&
        model.attributes.reference_type === "letter" &&
        model.attributes.documentType === "reminder"
      ) {
        let letter = await Letter.forge({ id: model.attributes.reference_id }).fetch({ withRelated: ["invoice"] })
        model.attributes.attachLetter = letter && letter.toJSON()
      }
      ctx.body = model
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  /**
   * Create a/an model entry.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.document, ctx.request.body)
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
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.document, ctx.params, ctx.request.body)
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
      const user = ctx.session.passport.user
      if (user.role === "admin") {
        ctx.body = await strapi.services.jsonapi.remove(strapi.models.document, ctx.params)
      } else {
        // Regular users can only destroy documents with status draft
        let document = await Document.forge(Object.assign({}, ctx.params, { user: user.id, status: "draft" })).fetch()
        ctx.body = await document.destroy()
      }
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Delete document and the data which have relationship
   *
   * @return {Object}
   */

  deleteDocument: async (ctx) => {
    try {
      let result = await strapi.services.document.deleteDocument(ctx)
      ctx.body = result
    } catch (err) {
      console.log({ err })
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

  getInvoiceDocumentsByTimeRange: async (ctx) => {
    try {
      ctx.body = await strapi.services.document.getInvoiceDocumentsByTimeRange(ctx)
    } catch (err) {
      if (err.status === undefined) {
        console.log(err)
      }
      ctx.body = { errors: err.details }
      ctx.status = err.status || 400
    }
  }
}
