'use strict';

const path = require('path');
const fs = require('fs');
const parse = require('co-busboy');
const JsonApiError = require('../../../utils/json-api-error');
const _ = require('lodash');

/**
 * A set of functions called "actions" for `Invoice`
 */

module.exports = {
  /**
   * @api {get} /invoices Request a list of invoices
   * @apiName GetInvoices
   * @apiPermission isAuthenticated
   * @apiUse JsonApiHeaders
   * @apiUse Pagination
   * @apiUse Sorting
   * @apiUse Filtering
   * @apiGroup Invoice
   *
   *
   * @apiError Unauthenticated 401 The user is not logged in.
   *
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * {
  "links": {
    "self": "https://test.faktoora.de:1337/api/v1/invoices",
    "first": null,
    "prev": null,
    "next": "https://test.faktoora.de:1337/api/v1/invoices?page[number]=2",
    "last": "https://test.faktoora.de:1337/api/v1/invoices?page[number]=3"
  },
  "data": [
    {
      "type": "invoice",
      "id": "1",
      "links": {
        "self": "https://test.faktoora.de:1337/api/v1/invoices/1"
      },
      "attributes": {
        "id": "1",
        "createdAt": "2016-07-24T01:50:41.871Z",
        "updatedAt": "2016-07-24T01:50:41.871Z",
        "amount": "8528.66",
        "debtorRating": "5.10",
        "minimumBid": "67.70",
        "issueDate": "2016-05-09T00:00:00.000Z",
        "invoiceNumber": "B63FDBD466",
        "lastPaymentDate": "2016-09-27T00:00:00.000Z",
        "sentInvoice": false
      },
      "relationships": {
        "seller": {
          "links": {
            "self": "https://test.faktoora.de:1337/invoice/1/relationships/seller",
            "related": "https://test.faktoora.de:1337/invoice/1"
          }
        }
      }
    },
  [...]
   */

  find: async (ctx) => {
    try {
      let filter = {};
      let exclude = ['invoicepositions', 'debtor'];
      const user = ctx.session.passport.user;
      filter = {
        where: {
          status: {
            eq: 'available'
          }
        },
        exclude: exclude
      };
      if (user.clientId) {
        filter.where.clientId = {
          eq: user.clientId
        };
      }
      let result = await strapi.services.jsonapi.fetchAll(strapi.models.invoice, ctx.query, filter);
      ctx.body = result;
    } catch (err) {
      ctx.body = err.toString();
      ctx.status = err.status || 400;
    }
  },
  findAll: async (ctx) => {
    try {
      let result = await strapi.services.jsonapi.fetchAll(strapi.models.invoice, ctx.query);
      ctx.body = result;
    } catch (err) {
      ctx.body = err.toString();
      ctx.status = err.status || 400;
    }
  },

  createDecimoInvoice: async (ctx) => {
    try {
      let result = await strapi.services.invoice.createDecimoInvoice(ctx);
      ctx.body = result;
    } catch (err) {
      console.log(err);
      ctx.body = err.toString();
      ctx.status = err.status || 400;
    }
  },

  /**
   * @api {get} /invoice/:id Request single invoice
   * @apiName GetInvoice
   * @apiPermission isAuthenticated
   * @apiUse JsonApiHeaders
   * @apiGroup Invoice
   * @apiHeader (Headers) {String} Accept application/x-www-form-urlencoded
   *
   * @apiError Unauthenticated 401 The user is not logged in.
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *     "data": {
   *     "type": "invoice",
   *     "id": "1",
   *     "attributes": {
   *       "id": "1",
   *       "createdAt": "2016-07-24T01:50:41.871Z",
   *       "updatedAt": "2016-07-24T01:50:41.871Z",
   *       "amount": "8528.66",
   *       "debtorRating": "5.10",
   *       "minimumBid": "67.70",
   *       "issueDate": "2016-05-09T00:00:00.000Z",
   *       "invoiceNumber": "B63FDBD466",
   *       "lastPaymentDate": "2016-09-27T00:00:00.000Z",
   *       "sentInvoice": false
   *       }
   *     }
   *
   */
  findOne: async (ctx) => {
    try {
      let user = ctx.session.passport.user;
      let isAdmin = user && user.role === 'admin';
      let exclude = [];

      let prefetchInvoice = await Invoice.forge(_.pick(ctx.params, 'id')).fetch({
        withRelated: ['invoicesale']
      });
      const invoicesale = prefetchInvoice.relations && prefetchInvoice.relations.invoicesale;
      let isSeller = user && user.id === prefetchInvoice.attributes.owner;
      let isBuyer = user && user.id === (invoicesale && invoicesale.attributes && invoicesale.attributes.buyer);

      if (isBuyer) {
        exclude = [''];
      } else if (!isSeller && !isAdmin) {
        exclude = ['invoiceFile', 'invoicepositions', 'debtor'];
      }

      let result = await strapi.services.jsonapi.fetch(
        strapi.models.invoice,
        ctx.params,
        { exclude: exclude },
        ctx.query
      );
      if (!isSeller && !isAdmin && !isBuyer && result.attributes.status !== 'available') {
        let error = new JsonApiError('E_RESOUCE_NOT_ACCESSIABLE', 404, 'Resource could not be found');
        ctx.body = error.details;
        ctx.status = error.status;
      }
      ctx.body = result;
    } catch (err) {
      ctx.body = err.toString();
      ctx.status = err.status || 400;
    }
  },

  findOneByFaktooraId: async (ctx) => {
    try {
      let user = ctx.session.passport.user;
      let isAdmin = user && user.role === 'admin';
      let exclude = [];
      let faktooraId = ctx.params.faktooraId || '';
      let prefetchInvoice = await Invoice.where({
        faktooraId: faktooraId
      }).fetch({
        withRelated: ['invoicesale', 'transactions']
      });
      const invoicesale = prefetchInvoice && prefetchInvoice.relations && prefetchInvoice.relations.invoicesale;
      let isSeller = user && user.id === prefetchInvoice.attributes.owner;
      let isBuyer = user && user.id === (invoicesale && invoicesale.attributes && invoicesale.attributes.buyer);

      if (isBuyer) {
        exclude = [''];
      } else if (!isSeller && !isAdmin) {
        exclude = ['invoiceFile', 'invoicepositions', 'debtor'];
      }

      let result = await strapi.services.jsonapi.fetch(
        strapi.models.invoice,
        { id: prefetchInvoice.id },
        { exclude: exclude },
        ctx.query
      );

      // Add statushistory
      const statusHistorys = await Statushistory.where({reference_type: 'invoice', reference_id: prefetchInvoice.id}).fetchAll();
      if (statusHistorys && statusHistorys.toJSON && result) {
        result.attributes.statusHistorys = statusHistorys.toJSON();
      }

      if (
        (!isSeller && !isAdmin && !isBuyer && result.attributes.status !== 'available') ||
        ((user.clientId || result.attributes.clientId) && user.clientId !== result.attributes.clientId)
      ) {
        let error = new JsonApiError('E_RESOUCE_NOT_ACCESSIABLE', 404, 'Resource could not be found');
        ctx.body = error.details;
        ctx.status = error.status;
        return;
      }
      ctx.body = result;
    } catch (err) {
      ctx.body = err.toString();
      ctx.status = err.status || 400;
    }
  },

  findBuyer: async (ctx) => {
    try {
      let buyer = await User.forge(_.pick(ctx.params, 'id')).fetch();
      buyer = buyer.toJSON();
      ctx.body = _.pick(buyer, ['companyName']);
    } catch (err) {
      ctx.body = err.toString();
      ctx.status = err.status || 400;
    }
  },
  /**
   * @api {post} /invoice Creates an invoice
   * @apiName CreateInvoice
   * @apiGroup Invoice
   * @apiPermission isAuthenticated
   * @apiUse JsonApiHeaders
   *
   * @apiDescription An invoice is created with ctx step which will have the status "draft"
   * Either an `invoiceFile` after an upload has to be provided or the array `invoicePositions`.
   * Every object in `invoiceposition` needs the following format:
   * ```
   * {
   *   "quantity": 1  // positive integer
   *   "price": 12.14 // positive price of a single item in €
   *   "description": "description of the invoice position"
   *   "tax": the tax percentage, can be either `0`, `9` or `17`
   * }
   * ```
   *
   * The created invoice is returned which can then be used to actually create the invoice by calling POST /invioice/:id/publish
   * Note: When invoicepositions are entered the `amount` parameter is ignored. The server calculates the invoice amount automatically.
   *  @apiParam {Object} data
   *  @apiParam {String} data.type Must be `invoice`
   *  @apiParam {Object} data.attributes
   *
   *  @apiParam {Number} data.attributes.debtor The ID of ctx invoice's debitor
   *  @apiParam {Number} data.attributes.amount Amount in € of the invoice
   *  @apiParam {Number} data.attributes.minimumBid Send Minimum amount in € that is accepted for offers
   *  @apiParam {Number} data.attributes.selloutBid Amount of € at which the invoice is instantly sold
   *  @apiParam {String} data.attributes.issueDate Date of the invoice
   *  @apiParam {String} data.attributes.lastPaymentDate Last date when the invoice has to be paid
   *  @apiParam {String} data.attributes.invoiceNumber Invoice number
   *  @apiParam {Boolean} data.attributes.sendInvoice Send invoice after its sold automatically
   *  @apiParam {String} [data.attributes.invoiceFile] ID of uploaded invoice file
   *  @apiParam {Array} [data.attributes.invoicePositions] Array containing at least one invoice position
   *  @apiParam {Array} [data.attributes.invoicePositions.count] Array containing at least one invoice position

   *
   *  @apiSuccess {Object} invoice and related entities
   *  @apiError E_NO_INVOICE 400 Neither an invoice file has been specified nor invoice positions have been supplied
   *
   */
  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.invoice.create(ctx);
    } catch (err) {
      if (err.status === undefined) {
        console.log(err);
      }
      ctx.body = { errors: err.details };
      ctx.status = err.status || 400;
    }
  },

  /**
   * Update a/an invoice entry.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.edit(strapi.models.invoice, ctx.params, ctx.request.body);
    } catch (err) {
      ctx.body = err;
    }
  },

  /**
   * Destroy a/an invoice entry.
   *
   * @return {Object}
   */

  destroy: async (ctx) => {
    try {
      const user = ctx.session.passport.user;
      // add params to prevent people who are not the actual seller to delete the invoice
      let params = Object.assign(ctx.params, {
        owner: user.id,
        status: 'draft'
      });
      if (user.role === 'admin') {
        params = ctx.params;
      }
      ctx.body = await strapi.services.jsonapi.remove(strapi.models.invoice, params);
    } catch (err) {
      ctx.body = err;
    }
  },

  /**
   * Destroy a/an invoice entry.
   *
   * @return {Object}
   */

  abort: async (ctx) => {
    try {
      const user = ctx.session.passport.user;
      let params = Object.assign(ctx.params, {
        owner: user.id,
        status: 'available'
      });
      let invoice = await Invoice.forge(params).fetch();
      if (invoice) {
        invoice = await invoice.save({ status: 'aborted' });
      }
      ctx.body = invoice;
    } catch (err) {
      ctx.body = err;
    }
  },

  /**
   * Add relation to a specific invoice.
   *
   * @return {Object}
   */

  createRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.addRelation(strapi.models.invoice, ctx.params, ctx.request.body);
    } catch (err) {
      ctx.status = err.status || 400;
      ctx.body = err;
    }
  },

  /**
   * Update relation to a specific invoice.
   *
   * @return {Object}
   */

  updateRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.editRelation(strapi.models.invoice, ctx.params, ctx.request.body);
    } catch (err) {
      ctx.status = err.status || 400;
      ctx.body = err;
    }
  },

  /**
   * Destroy relation to a specific invoice.
   *
   * @return {Object}
   */

  destroyRelation: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.removeRelation(strapi.models.invoice, ctx.params, ctx.request.body);
    } catch (err) {
      ctx.status = err.status || 400;
      ctx.body = err;
    }
  },
  /**
   * Publishing an invoice
   */
  publishAnInvoice: async (ctx) => {
    try {
      ctx.body = await strapi.services.invoice.publishAnInvoice(ctx);
    } catch (err) {
      if (err.status === undefined) {
        console.log(err);
      }

      ctx.body = { errors: err.details };
      ctx.status = err.status;
    }
  },

  /**
   * @api {post} /invoice/upload Upload an invoice file
   * @apiName UploadInvoice
   * @apiPermission isAuthenticated
   * @apiGroup Invoice
   *
   * @apiDescription
   * Only PDF files may be uploaded via form-data (multipart)
   *
   * @apiParam {File} invoiceFile
   *
   * @apiError Unauthenticated 401 The user is not logged in.
   * @apiSuccessExample {json} Success-Response:
   * HTTP/1.1 200 OK
   * [
  {
    "filename": "invoice-1470846411112-74.pdf",
    "path": "2016/07",
    "uploadType": "invoice",
    "updated_at": "2016-08-10T16:26:51.117Z",
    "created_at": "2016-08-10T16:26:51.117Z",
    "id": 10
  }
]
   */
  getDemandInvoices: async (ctx) => {
    try {
      let result = await strapi.services.invoice.getDemandInvoices(ctx);
      ctx.body = result;
    } catch (err) {
      ctx.body = err.toString();
      ctx.status = err.status || 400;
    }
  },
  uploadInvoice: async function(opts) {
    // Init variables
    const promises = [];
    let part;

    const parts = parse(ctx, {
      autoFields: true,
      // Validadon used by `co-busboy`
      checkFile: function(fieldname, file, filename) {
        const acceptedExtensions = ['.pdf'];
        if (!acceptedExtensions.includes(path.extname(filename))) {
          var err = new Error('invalid filetype. Only .pdf is allowed');
          err.status = 400;
          return new JsonApiError('E_VALIDATION', 400, 'invalid filetype. Only .pdf is allowed');
        }
      }
    });

    try {
      while ((part = await parts)) {
        promises.push(await strapi.services.upload.upload(part, ctx));
      }

      const uploadDescriptions = await promises;
      ctx.body = uploadDescriptions;
    } catch (err) {
      ctx.body = err.details ? { errors: err.details } : err;
      ctx.status = err.status || 400;
    }
  },
  downloadInvoiceFile: async (ctx) => {
    try {
      let fileDownload = await strapi.services.upload.downloadInvoiceFile(ctx);
      let filename = path.basename(fileDownload);
      let filestream = fs.createReadStream(fileDownload);
      ctx.attachment(filename);
      ctx.body = filestream;
    } catch (err) {
      ctx.body = err.details ? { errors: err.details } : err;
      ctx.status = err.status || 400;
    }
  },
  confirmBuyerCanPay: async (ctx) => {
    try {
      let result = await strapi.services.invoice.confirmBuyerCanPay(ctx);
      ctx.body = result;
    } catch (err) {
      if (isNaN(err.status)) {
        ctx.status = 400;
      } else {
        ctx.status = err.status;
      }
      if (err.details) {
        ctx.body = { errors: err.details };
      } else {
        ctx.body = { errors: JSON.stringify(err) };
      }
    }
  },
  sendInvoice: async (ctx) => {
    try {
      ctx.body = await strapi.services.invoice.sendInvoice(ctx);
    } catch (err) {
      console.log(err);
      ctx.body = err.details ? { errors: err.details } : err;
      ctx.status = err.status || 400;
    }
  },
  exportCsv: async (ctx) => {
    try {
      ctx.attachment('invoice.csv');
      // ctx.set("Content-disposition", "attachment; filename=invoice.csv")
      ctx.set('Content-type', 'text/csv');
      ctx.body = await strapi.services.invoice.exportCsv(ctx);
    } catch (err) {
      console.log(err);
      ctx.body = err.details ? { errors: err.details } : err;
      ctx.status = err.status || 400;
    }
  },
  exportAllCsv: async (ctx) => {
    try {
      ctx.attachment('invoice.csv');
      // ctx.set("Content-disposition", "attachment; filename=invoice.csv")
      ctx.set('Content-type', 'text/csv');
      ctx.body = await strapi.services.invoice.exportAllCsv(ctx);
    } catch (err) {
      console.log(err);
      ctx.body = err.details ? { errors: err.details } : err;
      ctx.status = err.status || 400;
    }
  },
  exportXls: async (ctx) => {
    try {
      ctx.attachment('invoice.xlsx');
      //ctx.set("Content-disposition", "attachment; filename=invoice.xlsx")
      ctx.set('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      ctx.body = await strapi.services.invoice.exportXls(ctx);
    } catch (err) {
      console.log(err);
      ctx.body = err.details ? { errors: err.details } : err;
      ctx.status = err.status || 400;
    }
  },

  /**
   * @api {post} /invoice/generate-faktoora-id Upload an invoice file
   * @apiName generateFaktooraIdForInvoice
   * @apiPermission isAuthenticated
   * @apiGroup Invoice
   *
   * @apiDescription
   * This api return the FaktooraId for creating invoice
   *
   */
  generateFaktooraId: async (ctx) => {
    try {
      let result = await strapi.services.invoice.generateFaktooraId(ctx);
      ctx.body = { faktooraId: result };
    } catch (err) {
      if (isNaN(err.status)) {
        ctx.status = 400;
      } else {
        ctx.status = err.status;
      }
      if (err.details) {
        ctx.body = { errors: err.details };
      } else {
        ctx.body = { errors: JSON.stringify(err) };
      }
    }
  },
  /**
   * Import a invoice
   */
  importInvoice: async (ctx) => {
    try {
      let result = await strapi.services.invoice.importInvoice(ctx);
      ctx.body = result;
    } catch (err) {
      strapi.log.error(err);
      if (isNaN(err.status)) {
        ctx.status = 400;
      } else {
        ctx.status = err.status;
      }
      if (err.details) {
        ctx.body = { errors: err.details };
      } else {
        ctx.body = { errors: JSON.stringify(err) };
      }
    }
  },
  /**
   * Generate an invoiceNumber
   *
   * @return {Object}
   */
  generateInvoiceNumber: async (ctx) => {
    try {
      ctx.body = await strapi.services.invoice.generateInvoiceNumber(ctx);
    } catch (err) {
      if (err.status === undefined) {
        console.log(err);
      }
      ctx.body = { errors: err.details };
      ctx.status = err.status || 400;
    }
  },
  /**
   * Marks an invoice without payment control as paid
   */
  markAsPaid: async (ctx) => {
    try {
      ctx.body = await strapi.services.invoice.markAsPaid(ctx);
    } catch (err) {
      if (err.status === undefined) {
        console.log(err);
      }

      ctx.body = { errors: err.details };
      ctx.status = err.status;
    }
  },
  /**
   * Marks an invoice without payment control as paid
   */
  generateSubrogationAndAssignmentAgreementLetters: async (ctx) => {
    try {
      ctx.body = await strapi.services.invoice.generateSubrogationAndAssignmentAgreementLetters(
        _.get(ctx.params, 'id')
      );
    } catch (err) {
      if (err.status === undefined) {
        console.log(err);
      }
    }
  },
  /**
   * get all the document of invoice by FaktooraId
   */
  getInvoiceDocumentByFaktooraId: async (ctx) => {
    try {
      let result = await strapi.services.invoice.getInvoiceDocumentByFaktooraId(ctx);
      ctx.body = result;
    } catch (err) {
      strapi.log.error(err);
      if (isNaN(err.status)) {
        ctx.status = 400;
      } else {
        ctx.status = err.status;
      }
      if (err.details) {
        ctx.body = { errors: err.details };
      } else {
        ctx.body = { errors: JSON.stringify(err) };
      }
    }
  }
};
