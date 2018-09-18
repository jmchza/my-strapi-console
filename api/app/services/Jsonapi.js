'use strict';

/**
 * Module dependencies
 */

/**
 * @apiDefine Pagination
 * @apiParam (Parameters) {Number} [page[number]=1] page number to load
 * @apiParam (Parameters) {Number} [page[size]=20] number of items to load
 */

/**
 * @apiDefine Sorting
 * @apiParam (Parameters) {String} [sort] sorts the resultset by an attribute
 *   e.g. `sort=name` would sort ascending by name whereas `sort=-name` would
 *   sort the results by name descending
 *   Can be used multiple times. The order of sort parameters determines the
 *   priority of each sort parameter.
 */

/**
 * @apiDefine Filtering
 * @apiParam (Filter) {String} [filter[where]] All of the following filters start with `filter[where]`
 * @apiParam (Filter) {String} [fieldname[comparator]=5]
filter `fieldname` using `comparator` and value.
 *   Valid `comparators` are:
 *   `gt` = greater than
 *   `gte` = greater than or equals
 *   `neq` = does not equal
 *   `lt` = lower than
 *   `lte` = lower than or equals
 *   `like` = like (use `%` as wildcards)
 *
 * Examples: `filter[where][id][eq]=1`
 * `filter[where][name][like]=%needle%`
 *
 *
 * @apiParam (Filter) {Number} [fieldname[between][0]=8]
 *  filters between two numeric or date values. To a `filter[where][fieldname][between][0]`
 *  there needs to be a corresponding `filter[where][fieldname][between][1]` value to
 *  restrict the range of values
 *
 * Examples: `filter[where][id][between][0]=8&filter[where][id][between][1]=1620`
 *
 */

/**
 * @apiDefine JsonApiHeaders
 * @apiHeader (JsonApiHeaders) {String} Content-Type application/vnd.api+json
 * @apiHeader (JsonApiHeaders) {String} Accept application/vnd.api+json
 */

// Public dependencies.
const _ = require('lodash');

const operatorMap = {
  gt: '>',
  eq: '=',
  neq: '!=',
  lt: '<',
  gte: '>=',
  lte: '<=',
  between: 'between',
  like: 'like',
  ilike: 'ilike'
};
// Strapi utilities.
const utils = require('strapi-hook-bookshelf/lib/utils/');

module.exports = {
  fetchAll: (model, params, options = {}, permissions = {}) => {
    let modelName = model.globalId;
    return new Promise(function(resolve, reject) {
      // 1. Create empty model
      let queryModel = global[modelName].forge();

      // 2. Parase query parameters
      let parsedParams = {};

      _.keys(params).forEach(key => {
        _.set(parsedParams, key, params[key]);
      });

      // 2. Add filters
      let filterParams = {};
      if (options.where !== undefined) {
        filterParams.where = options.where;
      }
      if (options.andwhere !== undefined) {
        filterParams.andwhere = options.andwhere;
      }
      if (options.orwhere !== undefined) {
        filterParams.orwhere = options.orwhere;
      }
      if (permissions.options !== false) {
        filterParams = _.merge(filterParams, parsedParams.filter);
      }
      let exitsJoinTables = [];
      let sortItems = [];
      if (options.sort !== undefined) {
        sortItems = options.sort;
      }
      if (!Array.isArray(parsedParams.sort)) {
        if (parsedParams.sort && parsedParams.sort.indexOf(',') > 0) {
          parsedParams.sort = parsedParams.sort.split(',');
        } else {
          parsedParams.sort = [parsedParams.sort];
        }
      }

      sortItems = _.merge(sortItems, parsedParams.sort);
      if (options.distinct && options.distinct.on) {
        let additionalIncludes = '';
        for (let i = 0; i < options.distinct.include.length; i++) {
          if (i === options.distinct.include.length - 1) {
            additionalIncludes = additionalIncludes + `${options.distinct.include[i]}`;
          } else {
            additionalIncludes = additionalIncludes + `${options.distinct.include[i]}, `;
          }
        }
        let distinctSort = _.map(sortItems, item => {
          let formatText = item.replace(/[+-]/g, '').trim();
          if (item.indexOf('.') < 0) {
            return `"${model.tableName}"."${formatText}"`;
          }
          return formatText;
        });
        let distinctOn = _.isEmpty(distinctSort)
          ? `ON (${options.distinct.on})`
          : `ON (${options.distinct.on}, ${distinctSort.toString()})`;
        queryModel = queryModel.query(qb => {
          qb.distinct(strapi.connections.default.raw(`${distinctOn} ${model.tableName}.*, ${additionalIncludes}`));
        });
      }
      if (!_.isEmpty(filterParams)) {
        queryModel = queryModel.query(qb => {
          if (options.join !== undefined) {
            if (_.isArray(options.join)) {
              options.join.map(joinObject => {
                if (exitsJoinTables.indexOf(joinObject.table) < 0) {
                  qb[joinObject.type](joinObject.table, joinObject.comparator1, joinObject.comparator2);
                  exitsJoinTables.push(joinObject.table);
                }
              });
            } else if (_.isObject(options.join)) {
              if (exitsJoinTables.indexOf(options.join.table) < 0) {
                qb[options.join.type](options.join.table, options.join.comparator1, options.join.comparator2);
                exitsJoinTables.push(options.join.table);
              }
            }
          }
          let whereParams = (filterParams && filterParams.where) || {};
          let andWhereParams = filterParams && filterParams.andwhere;
          let orWhereParams = filterParams && filterParams.orwhere;

          if (!andWhereParams && orWhereParams) {
            andWhereParams = _.assign({}, orWhereParams);
            orWhereParams = null;
          } else {
            orWhereParams = orWhereParams ? _.assign({}, whereParams, orWhereParams) : orWhereParams;
          }
          andWhereParams = _.assign({}, whereParams, andWhereParams);
          // add join options
          if (andWhereParams !== undefined) {
            for (let prop in andWhereParams) {
              let objFilter = andWhereParams[prop];
              for (let idx in objFilter) {
                let key;
                let obj = objFilter[idx];
                key = Object.keys(objFilter)[0];
                if (!operatorMap[key]) {
                  key = Object.keys(obj)[0];
                  const joinField = prop;
                  const columnConfig = _.find(model.associations, o => o.alias === joinField);
                  if (columnConfig && columnConfig.model && strapi.models[columnConfig.model]) {
                    const modelRelate = strapi.models[columnConfig.model];
                    if (exitsJoinTables.indexOf(modelRelate.tableName) < 0) {
                      qb.leftJoin(
                        modelRelate.tableName,
                        `${modelRelate.tableName}.id`,
                        `${model.tableName}.${joinField}`
                      );
                      exitsJoinTables.push(modelRelate.tableName);
                    }
                  }
                }
              }
            }
          }
          if (orWhereParams !== undefined) {
            for (let prop in orWhereParams) {
              let objFilter = orWhereParams[prop];
              for (let idx in objFilter) {
                let key;
                let obj = objFilter[idx];
                key = Object.keys(objFilter)[0];

                if (!operatorMap[key]) {
                  key = Object.keys(obj)[0];
                  const joinField = prop;
                  const columnConfig = _.find(model.associations, o => o.alias === joinField);
                  if (columnConfig && columnConfig.model && strapi.models[columnConfig.model]) {
                    const modelRelate = strapi.models[columnConfig.model];
                    if (exitsJoinTables.indexOf(modelRelate.tableName) < 0) {
                      qb.leftJoin(
                        modelRelate.tableName,
                        `${modelRelate.tableName}.id`,
                        `${model.tableName}.${joinField}`
                      );
                      exitsJoinTables.push(modelRelate.tableName);
                    }
                  }
                }
              }
            }
          }
          // add filter
          qb.where(function() {
            if (andWhereParams !== undefined) {
              let firstWhere = true;

              for (let prop in andWhereParams) {
                let objFilter = andWhereParams[prop];
                for (let idx in objFilter) {
                  let field, key, value;
                  let obj = objFilter[idx];
                  key = Object.keys(objFilter)[0];

                  if (operatorMap[key]) {
                    value = obj;
                    field = prop;
                  } else {
                    const columnConfig = _.find(model.associations, o => o.alias === prop);
                    const modelRelate = columnConfig && strapi.models[columnConfig.model];
                    key = Object.keys(obj)[0];
                    field = `${(modelRelate && modelRelate.tableName) || prop}.${idx}`;
                    value = obj[key];
                  }
                  switch (key) {
                    case 'gt':
                    case 'lt':
                    case 'eq':
                    case 'neq':
                    case 'gte':
                    case 'lte':
                    case 'like':
                    case 'ilike':
                      if (firstWhere === true) {
                        this.where(field, operatorMap[key], value);
                      } else {
                        this.andWhere(field, operatorMap[key], value);
                      }
                      break;
                    case 'between':
                    case 'notbetween':
                      // console.log('between for', prop, obj[key])
                      if (Array.isArray(value) && value.length === 2) {
                        let and = firstWhere ? 'where' : 'andWhere';
                        let not = key === 'notbetween' ? 'Not' : '';
                        this[`${and}${not}Between`](field, value);
                      } else {
                        throw new Error(`The ${key} filter needs two arguments`);
                      }

                      break;
                    default:
                      throw new Error(`${key} is not a valid operator`);
                  }
                  /* console.log("o." + prop + " = " + whereParams[prop]); */
                }
              }
            }
          });

          if (orWhereParams) {
            qb.orWhere(function() {
              let firstWhere = true;

              for (let prop in orWhereParams) {
                let objFilter = orWhereParams[prop];
                for (let idx in objFilter) {
                  let field, key, value;
                  let obj = objFilter[idx];
                  key = Object.keys(objFilter)[0];

                  if (operatorMap[key]) {
                    value = obj;
                    field = prop;
                  } else {
                    key = Object.keys(obj)[0];
                    field = `${prop}.${idx}`;
                    value = obj[key];
                  }

                  switch (key) {
                    case 'gt':
                    case 'lt':
                    case 'eq':
                    case 'neq':
                    case 'gte':
                    case 'lte':
                    case 'like':
                    case 'ilike':
                      if (firstWhere === true) {
                        this.where(field, operatorMap[key], value);
                      } else {
                        this.andWhere(field, operatorMap[key], value);
                      }
                      break;
                    case 'between':
                    case 'notbetween':
                      // console.log('between for', prop, obj[key])
                      if (Array.isArray(value) && value.length === 2) {
                        let and = firstWhere ? 'where' : 'andWhere';
                        let not = key === 'notbetween' ? 'Not' : '';
                        this[`${and}${not}Between`](field, value);
                      } else {
                        throw new Error(`The ${key} filter needs two arguments`);
                      }

                      break;
                    default:
                      throw new Error(`${key} is not a valid operator`);
                  }
                }
              }
            });
          }
          // qb.debug(true)
        });
      }
      // 4. Pagination
      let pageOptions = parsedParams.page || {};
      let pageNumber = parseInt(pageOptions.number, 10) || 1;
      let pageSize = parseInt(pageOptions.size, 10) || 20;
      if (sortItems.length > 0) {
        sortItems.forEach(sortItem => {
          const splitSortItem = sortItem && sortItem.trim().split('.');
          if (splitSortItem && splitSortItem.length === 2 && splitSortItem[1] !== '*') {
            let sortType = 'ASC';
            let fieldRelateName = splitSortItem[0];
            if (fieldRelateName.indexOf('-') === 0) {
              sortType = 'DESC';
              fieldRelateName = fieldRelateName.substring(1, fieldRelateName.length);
            }
            const fieldOnTableRelate = splitSortItem[1];
            const columnConfig = _.find(model.associations, o => o.alias === fieldRelateName);
            if (columnConfig && columnConfig.model && strapi.models[columnConfig.model]) {
              const modelRelate = strapi.models[columnConfig.model];
              queryModel = queryModel.query(qb => {
                if (exitsJoinTables.indexOf(modelRelate.tableName) < 0) {
                  qb.leftJoin(
                    modelRelate.tableName,
                    `${modelRelate.tableName}.id`,
                    `${model.tableName}.${fieldRelateName}`
                  );
                  exitsJoinTables.push(modelRelate.tableName);
                }
                qb.orderBy(`${modelRelate.tableName}.${fieldOnTableRelate}`, sortType);
              });
            }
          } else {
            queryModel = queryModel.orderBy(sortItem === `"${model.tableName}".*` ? `${model.tableName}.*` : sortItem);
          }
        });
      }

      // 6. Add relations
      let includeRelations = _.difference(
        Array.isArray(options.include)
          ? options.include
          : _.keys(_.groupBy(_.reject(model.associations, { autoPopulate: false }), 'alias')),
        options.exclude
      );
      const { columns } = options;
      queryModel
        .fetchPage({
          pageSize,
          page: pageNumber,
          withRelated: includeRelations,
          columns
        })
        .then(results => {
          resolve(results);
        })
        .catch(err => {
          console.log('ERROR IN CATCH', err);
          reject(err);
        });
    }); /* .catch(function (err) {
console.log("Error vorher",err, typeof err, JSON.stringify(err))
}); */
  },
  /**
   * Promise to fetch a model instance.
   *
   * @return {Promise}
   */
  fetch: (model, params, options = {}, query) => {
    let modelName = model.globalId;
    options = options || {};
    // 1. Parase query parameters
    let parsedParams = {};

    _.keys(query).forEach(key => {
      _.set(parsedParams, key, query[key]);
    });
    // 2. Pagination
    let pageOptions = parsedParams.page || {};
    let pageNumber = parseInt(pageOptions.number, 10) || 1;
    let pageSize = parseInt(pageOptions.size, 10) || 25;
    let includeRelations = [];
    // 5. Sorting
    let sortItems = [];
    if (options.sort !== undefined) {
      sortItems = options.sort;
    }
    if (!Array.isArray(parsedParams.sort)) {
      parsedParams.sort = (parsedParams.sort && [parsedParams.sort]) || [];
    }
    sortItems = _.merge(sortItems, parsedParams.sort);
    if (Array.isArray(options.includeAll)) {
      includeRelations = options.includeAll;
    } else {
      _.forEach(model.associations, function(relation) {
        if (!_.includes(options.exclude, relation.alias) && relation.type === 'collection') {
          if (_.isEmpty(options.include) || _.includes(options.include, relation.alias)) {
            let relationWithPaging = {};
            relationWithPaging[relation.alias] = function(query) {
              query.limit(pageSize).offset((pageNumber - 1) * pageSize);
              if (sortItems.length > 0 && params.relation && params.relation === relation.alias) {
                sortItems.forEach(sortItem => {
                  let _sort;
                  if (sortItem && sortItem.indexOf('-') === 0) {
                    _sort = sortItem.slice(1);
                  } else if (sortItem) {
                    _sort = sortItem;
                  }
                  const _order = sortItem && sortItem.indexOf('-') === 0 ? 'DESC' : 'ASC';
                  query.orderBy(_sort, _order);
                });
              }
            };
            includeRelations.push(relationWithPaging);
          }
        } else {
          if (
            !_.includes(options.exclude, relation.alias) &&
            (_.isEmpty(options.include) || _.includes(options.include, relation.alias))
          ) {
            includeRelations.push(relation.alias);
          }
        }
      });
    }
    return new Promise((resolve, reject) => {
      global[modelName]
        .forge(_.pick(params, 'id'))
        .fetch({
          withRelated: includeRelations
        })
        .then(function(modelInstance) {
          resolve(modelInstance);
        })
        .catch(function(err) {
          reject(err);
        });
    });
  },

  /**
   * Promise to add a/an customer.
   *
   * @return {Promise}
   */

  add: (model, values) => {
    const modelName = model.globalId;
    return new Promise((resolve, reject) => {
      global[modelName]
        .forge(values)
        .save()
        .then(result => {
          resolve(result);
        })
        .catch(err => {
          reject(err);
        });
    });
  },
  /**
   * Promise to edit a/an invoice.
   *
   * @return {Promise}
   */
  edit: function(model, params, values) {
    const modelName = model.globalId;
    return new Promise((resolve, reject) => {
      global[modelName]
        .forge(params)
        .fetch()
        .then(function(model) {
          model
            .save(values, { path: true })
            .then(result => {
              resolve(result);
            })
            .catch(err => {
              reject(err);
            });
        })
        .catch(err => {
          reject(err);
        });
    });
  },
  /**
   * Remove an item.
   *
   * @return {Promise}
   */
  remove: function(model, params) {
    const modelName = model.globalId;
    return new Promise((resolve, reject) => {
      global[modelName]
        .forge(params)
        .destroy()
        .then(result => {
          resolve(result);
        })
        .catch(err => {
          reject(err);
        });
    });
  },

  /**
   * Add relation to a specific model (only from a to-many relationships).
   *
   * @return {Object}
   */
  addRelation: function(model, params, values) {
    const modelName = model.globalId;
    return new Promise(function(resolve, reject) {
      const relation = _.find(model.associations, { alias: params.relation });
      console.log(relation, params.relation, values);
      if (!_.isEmpty(relation) && _.isArray(values)) {
        switch (relation.nature) {
          case 'manyToOne':
            const PK = utils.getPK(_.get(relation, relation.type), undefined, strapi.models);
            const arrayOfPromises = _.map(values, function(value) {
              const parameters = {};
              _.set(parameters, PK, value);
              _.set(parameters, 'relation', relation.via);
              return strapi.services.jsonapi.editRelation(strapi.models[_.get(relation, relation.type)], parameters, [
                _.get(params, 'id') || null
              ]);
            });
            Promise.all(arrayOfPromises)
              .then(() => {
                resolve();
              })
              .catch(err => {
                reject(err);
              });
            break;
          case 'manyToMany':
            global[modelName]
              .forge(_.omit(params, 'relation'))
              [params.relation]()
              .attach(values)
              .then(result => {
                resolve(result);
              })
              .catch(err => {
                reject(err);
              });
            break;
          default:
            reject('Impossible to add relation on this type of relation');
        }
      } else {
        reject('Bad request');
      }
    });
  },

  /**
   * Edit relation to a specific model.
   *
   * @return {Object}
   */

  editRelation: function(model, params, values) {
    const modelName = model.globalId;
    return new Promise((resolve, reject) => {
      const relation = _.find(model.associations, { alias: params.relation });

      if (!_.isEmpty(relation) && _.isArray(values)) {
        switch (relation.nature) {
          case 'oneWay':
          case 'oneToOne':
          case 'oneToMany':
            const data = _.set({}, params.relation, _.first(values) || null);

            global[modelName]
              .forge(_.omit(params, 'relation'))
              .save(data, { path: true })
              .then(user => {
                resolve();
              })
              .catch(err => {
                reject(err);
              });
            break;
          case 'manyToOne':
            const PK = utils.getPK(_.get(relation, relation.type), undefined, strapi.models);

            global[modelName]
              .forge(_.omit(params, 'relation'))
              .fetch({
                withRelated: _.get(params, 'relation')
              })
              .then(function(model) {
                const data = model.toJSON() || {};
                const currentValues = _.keys(_.groupBy(_.get(data, _.get(params, 'relation')), PK));
                const valuesToRemove = _.difference(currentValues, values);

                const arrayOfPromises = _.map(valuesToRemove, function(value) {
                  const params = {};

                  _.set(params, PK, value);
                  _.set(params, 'relation', relation.via);

                  return strapi.services[_.get(relation, relation.type)].editRelation(params, [null]);
                });

                return Promise.all(arrayOfPromises);
              })
              .then(function() {
                const arrayOfPromises = _.map(values, function(value) {
                  const params = {};

                  _.set(params, PK, value);
                  _.set(params, 'relation', relation.via);

                  return strapi.services[_.get(relation, relation.type)].editRelation(params, [
                    _.get(params, 'id') || null
                  ]);
                });

                return Promise.all(arrayOfPromises);
              })
              .then(function() {
                resolve();
              })
              .catch(function(err) {
                reject(err);
              });
            break;
          case 'manyToMany':
            global[modelName]
              .forge(_.omit(params, 'relation'))
              .fetch({
                withRelated: _.get(params, 'relation')
              })
              .then(function(model) {
                const data = model.toJSON() || {};
                const PK = utils.getPK(modelName, global[modelName], strapi.models);

                const currentValues = _.keys(_.groupBy(_.get(data, _.get(params, 'relation')), PK));
                const valuesToAdd = _.difference(
                  _.map(values, function(o) {
                    return o.toString();
                  }),
                  currentValues
                );

                return global[modelName]
                  .forge(_.omit(params, 'relation'))
                  [params.relation]()
                  .attach(valuesToAdd)
                  .then(function() {
                    return model;
                  });
              })
              .then(function(model) {
                const data = model.toJSON() || {};
                const PK = utils.getPK(modelName, global[modelName], strapi.models);

                const currentValues = _.keys(_.groupBy(_.get(data, _.get(params, 'relation')), PK));
                const valuesToDrop = _.difference(
                  currentValues,
                  _.map(values, function(o) {
                    return o.toString();
                  })
                );

                return global[modelName]
                  .forge(_.omit(params, 'relation'))
                  [params.relation]()
                  .detach(valuesToDrop);
              })
              .then(function() {
                resolve();
              })
              .catch(function(err) {
                reject(err);
              });
            break;
          default:
            reject('Impossible to update relation on this type of relation');
        }
      } else {
        reject('Bad request');
      }
    });
  },

  /**
   * Remove a specific entry from a specific model (only from a to-many relationships).
   *
   * @return {Promise}
   */

  removeRelation: function(model, params, values) {
    const modelName = model.globalId;
    return new Promise((resolve, reject) => {
      const relation = _.find(model.associations, { alias: params.relation });

      if (!_.isEmpty(relation) && _.isArray(values)) {
        switch (relation.nature) {
          case 'manyToOne':
            const PK = utils.getPK(_.get(relation, relation.type), undefined, strapi.models);

            const arrayOfPromises = _.map(values, function(value) {
              const parameters = {};

              _.set(parameters, PK, value);
              _.set(parameters, 'relation', relation.via);

              return strapi.services[_.get(relation, relation.type)].editRelation(parameters, [null]);
            });

            Promise.all(arrayOfPromises)
              .then(() => {
                resolve();
              })
              .catch(err => {
                reject(err);
              });
            break;
          case 'manyToMany':
            global[modelName]
              .forge(_.omit(params, 'relation'))
              [params.relation]()
              .detach(values)
              .then(function(model) {
                resolve(model);
              })
              .catch(function(err) {
                reject(err);
              });
            break;
          default:
            reject('Impossible to delete relation on this type of relation');
        }
      } else {
        reject('Bad request');
      }
    });
  }
};
