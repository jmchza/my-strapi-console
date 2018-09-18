'use strict'

/**
 * Module dependencies
 */

// Public dependencies.
const _ = require('lodash')

// Strapi utilities.
const utils = require('strapi-hook-bookshelf/lib/utils/')

/**
 * A set of functions called "actions" for `Template`
 */

module.exports = {

  search: function (ctx) {
    const type = ctx.params.type || 'inoivce'
    if (typeof ctx.params.keyword !== 'string' || ctx.params.keyword === '') {
      return Template.query(qb => {
        qb.where('user', '=', ctx.session.passport.user.id).andWhere('type', '=', type)
        qb.orderBy('updated_at', 'desc')
      }).fetchPage({limit: 20})
    }
    const keyword = `%${ctx.params.keyword}%`

    return Template.query(qb => {
      qb.where('user', '=', ctx.session.passport.user.id)
      qb.where(function () {
        this.where('name', 'ILIKE', keyword).andWhere('type', '=', type)
      })
    }).fetchPage({limit: 5})
  },
  /**
   * Promise to fetch all templates.
   *
   * @return {Promise}
   */

  fetchAll: function (params) {
    return new Promise(function (resolve, reject) {
      Template.forge(params).query(params).fetchAll({
        withRelated: _.keys(_.groupBy(_.reject(strapi.models.template.associations, {autoPopulate: false}), 'alias'))
      })
        .then(function (templates) {
          resolve(templates)
        })
        .catch(function (err) {
          reject(err)
        })
    })
  },

  /**
   * Promise to fetch a/an template.
   *
   * @return {Promise}
   */

  fetch: function (params) {
    return new Promise(function (resolve, reject) {
      Template.forge(_.pick(params, 'id')).fetch({
        withRelated: _.keys(_.groupBy(_.reject(strapi.models.template.associations, {autoPopulate: false}), 'alias'))
      })
        .then(function (template) {
          resolve(template)
        })
        .catch(function (err) {
          reject(err)
        })
    })
  },

  /**
   * Promise to add a/an template.
   *
   * @return {Promise}
   */

  add: function (values) {
    return new Promise(function (resolve, reject) {
      Template.forge(values).save()
        .then(function (template) {
          resolve(template)
        })
        .catch(function (err) {
          reject(err)
        })
    })
  },

  /**
   * Promise to edit a/an template.
   *
   * @return {Promise}
   */

  edit: function (params, values) {
    return new Promise(function (resolve, reject) {
      Template.forge(params).save(values, {path: true})
        .then(function (template) {
          resolve(template)
        })
        .catch(function (err) {
          reject(err)
        })
    })
  },

  /**
   * Promise to remove a/an template.
   *
   * @return {Promise}
   */

  remove: function (params) {
    return new Promise(function (resolve, reject) {
      Template.forge(params).destroy()
        .then(function (template) {
          resolve(template)
        })
        .catch(function (err) {
          reject(err)
        })
    })
  },

  /**
   * Add relation to a specific template (only from a to-many relationships).
   *
   * @return {Object}
   */

  addRelation: function (params, values) {
    return new Promise(function (resolve, reject) {
      const relation = _.find(strapi.models.template.associations, {alias: params.relation})

      if (!_.isEmpty(relation) && _.isArray(values)) {
        switch (relation.nature) {
          case 'manyToOne':
            const PK = utils.getPK(_.get(relation, relation.type), undefined, strapi.models)

            const arrayOfPromises = _.map(values, function (value) {
              const parameters = {}

              _.set(parameters, PK, value)
              _.set(parameters, 'relation', relation.via)

              return strapi.services[_.get(relation, relation.type)].editRelation(parameters, [_.get(params, 'id') || null])
            })

            Promise.all(arrayOfPromises)
              .then(function () {
                resolve()
              })
              .catch(function (err) {
                reject(err)
              })
            break
          case 'manyToMany':
            Template.forge(_.omit(params, 'relation'))[params.relation]().attach(values)
              .then(function (template) {
                resolve(template)
              })
              .catch(function (err) {
                reject(err)
              })
            break
          default:
            reject('Impossible to add relation on this type of relation')
        }
      } else {
        reject('Bad request')
      }
    })
  },

  /**
   * Edit relation to a specific template.
   *
   * @return {Object}
   */

  editRelation: function (params, values) {
    return new Promise(function (resolve, reject) {
      const relation = _.find(strapi.models.template.associations, {alias: params.relation})

      if (!_.isEmpty(relation) && _.isArray(values)) {
        switch (relation.nature) {
          case 'oneWay':
          case 'oneToOne':
          case 'oneToMany':
            const data = _.set({}, params.relation, _.first(values) || null)

            Template.forge(_.omit(params, 'relation')).save(data, {path: true})
              .then(function (user) {
                resolve()
              })
              .catch(function (err) {
                reject(err)
              })
            break
          case 'manyToOne':
            const PK = utils.getPK(_.get(relation, relation.type), undefined, strapi.models)

            Template.forge(_.omit(params, 'relation')).fetch({
              withRelated: _.get(params, 'relation')
            })
              .then(function (template) {
                const data = template.toJSON() || {}
                const currentValues = _.keys(_.groupBy(_.get(data, _.get(params, 'relation')), PK))
                const valuesToRemove = _.difference(currentValues, values)

                const arrayOfPromises = _.map(valuesToRemove, function (value) {
                  const params = {}

                  _.set(params, PK, value)
                  _.set(params, 'relation', relation.via)

                  return strapi.services[_.get(relation, relation.type)].editRelation(params, [null])
                })

                return Promise.all(arrayOfPromises)
              })
              .then(function () {
                const arrayOfPromises = _.map(values, function (value) {
                  const params = {}

                  _.set(params, PK, value)
                  _.set(params, 'relation', relation.via)

                  return strapi.services[_.get(relation, relation.type)].editRelation(params, [_.get(params, 'id') || null])
                })

                return Promise.all(arrayOfPromises)
              })
              .then(function () {
                resolve()
              })
              .catch(function (err) {
                reject(err)
              })
            break
          case 'manyToMany':
            Template.forge(_.omit(params, 'relation')).fetch({
              withRelated: _.get(params, 'relation')
            })
              .then(function (template) {
                const data = template.toJSON() || {}
                const PK = utils.getPK('Template', Template, strapi.models)

                const currentValues = _.keys(_.groupBy(_.get(data, _.get(params, 'relation')), PK))
                const valuesToAdd = _.difference(_.map(values, function (o) {
                  return o.toString()
                }), currentValues)

                return Template.forge(_.omit(params, 'relation'))[params.relation]().attach(valuesToAdd)
                  .then(function () {
                    return template
                  })
              })
              .then(function (template) {
                const data = template.toJSON() || {}
                const PK = utils.getPK('Template', Template, strapi.models)

                const currentValues = _.keys(_.groupBy(_.get(data, _.get(params, 'relation')), PK))
                const valuesToDrop = _.difference(currentValues, _.map(values, function (o) {
                  return o.toString()
                }))

                return Template.forge(_.omit(params, 'relation'))[params.relation]().detach(valuesToDrop)
              })
              .then(function () {
                resolve()
              })
              .catch(function (err) {
                reject(err)
              })
            break
          default:
            reject('Impossible to update relation on this type of relation')
        }
      } else {
        reject('Bad request')
      }
    })
  },

  /**
   * Promise to remove a specific entry from a specific template (only from a to-many relationships).
   *
   * @return {Promise}
   */

  removeRelation: function (params, values) {
    return new Promise(function (resolve, reject) {
      const relation = _.find(strapi.models.template.associations, {alias: params.relation})

      if (!_.isEmpty(relation) && _.isArray(values)) {
        switch (relation.nature) {
          case 'manyToOne':
            const PK = utils.getPK(_.get(relation, relation.type), undefined, strapi.models)

            const arrayOfPromises = _.map(values, function (value) {
              const parameters = {}

              _.set(parameters, PK, value)
              _.set(parameters, 'relation', relation.via)

              return strapi.services[_.get(relation, relation.type)].editRelation(parameters, [null])
            })

            Promise.all(arrayOfPromises)
              .then(function () {
                resolve()
              })
              .catch(function (err) {
                reject(err)
              })
            break
          case 'manyToMany':
            Template.forge(_.omit(params, 'relation'))[params.relation]().detach(values)
              .then(function (template) {
                resolve(template)
              })
              .catch(function (err) {
                reject(err)
              })
            break
          default:
            reject('Impossible to delete relation on this type of relation')
        }
      } else {
        reject('Bad request')
      }
    })
  }
}
