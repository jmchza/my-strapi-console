/* eslint-disable no-undef */ /*, no-unused-vars */
const _ = require("lodash")
const builderQuery = require("../../../utils/builder-query")
const Chance = require("chance")
const chance = new Chance()
module.exports = {
  search: async function(ctx) {
    let params = ctx.query
    let date = new Date()
    let currentDay = date.getDate()
    let currentMonth = date.getMonth()
    let currentYear = date.getFullYear()
    let now = chance.date({
      string: true,
      day: currentDay,
      month: currentMonth,
      year: currentYear
    })

    // parsing params from url queryString
    let parsedParams = {}
    _.keys(params).forEach(key => {
      _.set(parsedParams, key, params[key])
    })

    // Pagination
    let pageOptions = parsedParams.page || {}
    let page = parseInt(pageOptions.number, 10) || 1
    let pageSize = parseInt(pageOptions.size, 10) || 25

    let sortItems = []
    if (!_.isEmpty(parsedParams.sort)) {
      // process mutiple sort only
      if (parsedParams.sort.indexOf(",") > 0) {
        parsedParams.sort = parsedParams.sort.split(",")
      }

      sortItems = _.isArray(parsedParams.sort) ? parsedParams.sort : [parsedParams.sort]
    }
    // build query
    const blogTable = strapi.models.blog.collectionName
    let queryModel = Blog.query(function(qb) {
      // [START] appen sort query
      let distinctFields = [`${blogTable}.*`]
      if (!_.isEmpty(sortItems)) {
        sortItems.forEach(sortItem => {
          let sortOption = sortItem
            .replace("-", "")
            .replace("+", "")
            .replace(" ", "")

          // add sort fields
          distinctFields.push(`${blogTable}.${sortOption}`)
        })
      }

      qb.distinct(distinctFields)
      // [END] appen sort query
      // filter
      let categoryFilter = parsedParams.category
      if (!_.isEmpty(categoryFilter)) {
        qb.where(function() {
          builderQuery(this, _.assign({}, { category: { eq: categoryFilter } }), blogTable)
        })
      }

      let searchKeyword = parsedParams.filter
      const filterFields = ["content"]
      if (!_.isEmpty(searchKeyword) && _.isString(searchKeyword)) {
        qb.andWhere(function() {
          filterFields.map(field => {
            this.orWhere(function() {
              builderQuery(this, _.assign({}, { [field]: { like: searchKeyword } }), blogTable)
            })
          })
        })
      }
      // debug
      // qb.debug(true)
      qb.where("blog.updatedDate", "<=", now)
    })
    // add sort
    !_.isEmpty(sortItems) &&
      sortItems.forEach(sortItem => {
        let _sort
        if (sortItem && sortItem.indexOf("-") === 0) {
          _sort = sortItem.slice(1)
        } else if (sortItem) {
          _sort = sortItem
        }
        const _order = sortItem && sortItem.indexOf("-") === 0 ? "DESC" : "ASC"
        queryModel = queryModel.orderBy(_sort, _order)
      })

    let blogModel = await queryModel.fetchPage({
      page: page, // Defaults to 1 if not specified
      pageSize: pageSize // Defaults to 25 if not specified
    })

    return blogModel
  }
}
