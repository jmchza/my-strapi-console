const superagent = require('superagent')
const methods = ['get', 'post', 'put', 'patch', 'del']
class RESTClient {
  constructor (req) {
    methods.forEach((method) =>
      this[method] = (path, {
        params,
        data,
        onProgress,
        type = 'application/json'
      } = {}) => new Promise((resolve, reject) => {
        const request = superagent[method](path)

        if (type) {
          request.type(type)
        }

        if (params) {
          request.query(params)
        }
        if (data) {
          request.send(data)
        }

        request.end((err, { body } = {}) => err ? reject(body || err) : resolve(body))
      }))
  }
}
module.exports = new RESTClient()
