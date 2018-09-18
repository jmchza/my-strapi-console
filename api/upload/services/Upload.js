'use strict'

const path = require('path')
const co = require('co')
const JsonApiError = require('../../../utils/json-api-error')
const fs = require('fs-extra-promise')
const meter = require('stream-meter')

module.exports = {
  upload: function * (part, ctx, type, subfolder, displayName) {
    let stream
    ctx = ctx || {}

    if (!type) {
      type = 'invoice'
    }
    const filename = type + '-' + Date.now().toString() + '-' + Math.floor(Math.random() * 1000).toString() + path.extname(part.filename)

    // Construct path in format /public/upload/YYYY/MM
    const currentDate = new Date()
    const year = currentDate.getFullYear().toString()
    const month = ('0' + currentDate.getMonth()).slice(-2)
    const fullPath = subfolder ? path.join(strapi.config.environments[strapi.config.environment].uploadFolder, subfolder, year, month) : path.join(strapi.config.environments[strapi.config.environment].uploadFolder, year, month)
    try {
      yield fs.isDirectoryAsync(fullPath)
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Create directory /public/upload/YYYY/MM
        yield fs.mkdirsAsync(fullPath)
      }
    }

    return new Promise(function (resolve, reject) {
      // Start uploading
      let user = ctx.session && ctx.session.passport && ctx.session.passport.user && ctx.session.passport.user.id
      stream = fs.createWriteStream(path.join(fullPath, filename))
      let m = meter()
      part.pipe(m).pipe(stream).on('finish', function () {
        Upload.forge({
          filename: filename,
          path: subfolder ? path.join(subfolder, year, month) : path.join(year, month),
          uploadType: type,
          displayName,
          user,
          size: m.bytes
        }).save()
        .then(function (result) {
          resolve(result)
        })
      })
    })
  },
  downloadInvoiceFile: async function (ctx) {
    let invoiceId = ctx.params.invoiceid
    let fileId = ctx.params.fileid
    let userId = ctx.session.passport.user.id
    /* let invoiceModel  = await new Invoice({invoice: invoiceId}).query(qb => {
      qb.innerJoin(`invoicesale`, `invoice.id`, `invoicesale.invoice`);
      qb.where('invoice.invoiceFile', '=', fileid)
      qb.orWhere('invoicesale.subrogationLetter', '=', fileid)
    }).fetch() */

    let fileModel = await Upload.query({where: {id: fileId}}).fetch()

    /*
    if (invoiceModel === null) {
      throw new JsonApiError(`E_RESOURCE_NOT_EXISTS`, 404);
    }

    let invoicesaleModel= await Invoice.forge({id: invoiceId}).fetch()
    if (!(userId === invoiceModel.attributes.owner || userId === invoicesaleModel.attributes.buyer)) {
      throw new JsonApiError('E_DONT_HAVE_PERMISSION', 400, `You don't have permission for download this file.`)
    }

    let uploadModel = await Upload.query({where: {id: fileid}}).fetch()
    if (uploadModel === null) {
      throw new JsonApiError('E_RESOURCE_INVOICE_FILE_NOT_EXISTS', 400, `Invoice don't have any attachment file or file have been deleted.`)
    } */

    let filepath = `${strapi.config.environments[strapi.config.environment].uploadFolder}/${fileModel.attributes.path}/${fileModel.attributes.filename}`
    // let filepath = `${strapi.config.environments[strapi.config.environment].uploadFolder}/${uploadModel.attributes.path}/${uploadModel.attributes.filename}`;
    if (!fs.existsSync(filepath)) {
      throw new JsonApiError('E_RESOURCE_INVOICE_FILE_NOT_EXISTS', 400, `File have been deleted.`)
    }

    return filepath
  },
  downloadFile: co.wrap(function * (ctx) {
    let fileId = ctx.params.id
    let user = ctx.session.passport.user
    let uploadModel
    if (user.role === 'admin') {
      uploadModel = yield Upload.query({where: {id: fileId}}).fetch()
    } else {
      uploadModel = yield Upload.query({where: {id: fileId, user: user.id}}).fetch()
    }
    if (uploadModel === null) {
      throw new JsonApiError('E_RESOURCE_INVOICE_FILE_NOT_EXISTS', 400, `Invoice don't have any attachment file or file have been deleted.`)
    }
    let filepath = `${strapi.config.environments[strapi.config.environment].uploadFolder}/${uploadModel.attributes.path}/${uploadModel.attributes.filename}`
    if (!fs.existsSync(filepath)) {
      throw new JsonApiError('E_RESOURCE_INVOICE_FILE_NOT_EXISTS', 400, `File have been deleted.`)
    }
    return filepath
  }),
  downloadImage: co.wrap(function * (ctx) {
    let fileId = ctx.params.id

    let uploadModel = yield Upload.query({where: {id: fileId, uploadType: 'image'}}).fetch()
    if (uploadModel === null) {
      throw new JsonApiError('E_RESOURCE_INVOICE_FILE_NOT_EXISTS', 400, `Invoice don't have any attachment file or file have been deleted.`)
    }
    let filepath = `${strapi.config.environments[strapi.config.environment].uploadFolder}/${uploadModel.attributes.path}/${uploadModel.attributes.filename}`
    if (!fs.existsSync(filepath)) {
      throw new JsonApiError('E_RESOURCE_INVOICE_FILE_NOT_EXISTS', 400, `File have been deleted.`)
    }
    return filepath
  })
}
