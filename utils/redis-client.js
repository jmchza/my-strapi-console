const createClient = require("then-redis").createClient
let instance
module.exports = function(config) {
  config = config || strapi.config.currentEnvironment.genericSession
  function createInstance() {
    return createClient(config)
  }
  return {
    getInstance: function() {
      if (!instance) {
        instance = createInstance()
      }
      return instance
    }
  }
}
