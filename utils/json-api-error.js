'use strict'

module.exports = class JsonApiError extends Error {
  constructor (code, status, details) {
    super(`Error`)
    this.status = status
    this.details = Array.isArray(details) ? details : [{code: code, message: details}]
  }
}
