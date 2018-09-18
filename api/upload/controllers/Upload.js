'use strict'

const path = require('path')
const fs = require('fs')
const parse = require('co-busboy')
const _ = require('lodash')
const JsonApiError = require('../../../utils/json-api-error')
const acceptExtensions = ['.jpg', '.jpeg', '.pdf', '.png', '.bmp']

/**
 * A set of functions called "actions" for `Upload`
 */

module.exports = {
  downloadFile: async (ctx) => {
    try {
      let fileDownload = await strapi.services.upload.downloadFile(ctx)
      let filename = path.basename(fileDownload)
      let filestream = fs.createReadStream(fileDownload)
      ctx.body = filestream
      if (ctx.query.view) {
        let mime = {
          gif: 'image/gif',
          jpg: 'image/jpeg',
          png: 'image/png',
          pdf: 'application/pdf'
        }
        let type = mime[path.extname(filename).slice(1)]
        ctx.type = type
      } else {
        ctx.attachment(filename)
      }
    } catch (err) {
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },
  downloadImage: async (ctx) => {
    try {
      let mime = {
        gif: 'image/gif',
        jpg: 'image/jpeg',
        png: 'image/png'
      }
      let fileDownload = await strapi.services.upload.downloadImage(ctx)
      let filename = path.basename(fileDownload)
      let filestream = fs.createReadStream(fileDownload)
      let type = mime[path.extname(filename).slice(1)] || 'image/jpeg'
      ctx.body = filestream
      ctx.type = type
    } catch (err) {
      ctx.body = { 'errors': err.details }
      ctx.status = err.status || 400
    }
  },
  find: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.fetchAll(strapi.models.upload, ctx.query)
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
      ctx.body = await strapi.services.jsonapi.fetch(strapi.models.upload, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  },

  /**
   * Create a/an model entry.
   *
   * @return {Object}
   */

  upload: async (ctx) => {
    try {
      const promises = []
      const type = ctx.query.uploadType
      let part, realName
      const parts = parse(ctx, {
        autoFields: true,
        checkFile: function (fieldname, file, filename) {
          realName = filename
          if (!_.includes(acceptExtensions, path.extname(filename.toLowerCase()))) {
            return new JsonApiError(`E_NOT_ALLOW_TYPE`, 400)
          }
        }
      })
      while (part = await parts) {
        promises.push(await strapi.services.upload.upload(part, ctx, type, null, realName))
      }
      const uploadDescriptions = await promises
      ctx.body = uploadDescriptions && uploadDescriptions[0]
    } catch (err) {
      ctx.status = 400
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
      ctx.body = await strapi.services.jsonapi.add(strapi.models.upload, ctx.request.body)
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
      let user = ctx.session.passport.user
      let isAdmin = user && user.role === 'admin'
      if (!isAdmin) {
        let upload = await Upload.forge(Object.assign({}, ctx.params, {user: user.id})).fetch()
        if (!upload) {
          throw new JsonApiError(`E_NOT_ALLOW`, 400)
        }
      }
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.upload, ctx.params, ctx.request.body)
    } catch (err) {
      if (isNaN(err.status)) {
        console.log(err)
        ctx.status = 400
      } else {
        ctx.status = err.status
      }
      if (err.details) {
        ctx.body = { 'errors': err.details }
      } else {
        ctx.body = { 'errors': JSON.stringify(err) }
      }
    }
  },

  /**
   * Destroy a/an model entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.upload, ctx.params)
    } catch (err) {
      ctx.body = err
    }
  }
}
