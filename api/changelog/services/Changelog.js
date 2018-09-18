/* eslint-disable no-undef */ /*, no-unused-vars */
const moment = require("moment")
module.exports = {
  getNewest: async function(ctx) {
    let params = ctx.query
    let now = moment()
    let queryModel
    try {
      // build query
      const maxPublishedDate = await Changelog.query(function(qb) {
        qb.max("publishedDate").where("publishedDate", "<=", now.format("YYYY-MM-DD"))
      }).fetch()
      if (maxPublishedDate) {
        queryModel = await Changelog.query(function(qb) {
          qb.where("publishedDate", maxPublishedDate.get("max"))
        }).fetch()
      }
    } catch (e) {
      console.log(e)
    }

    return queryModel
  }
}
