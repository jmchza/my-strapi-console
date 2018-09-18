'use strict';

const JsonApiError = require('../../utils/json-api-error');
const _ = require('lodash');
/**
 * @apiDefine isBuyer
 */
module.exports = async (ctx, next) => {
  const user = _.get(ctx, 'session.passport.user');
  if (!user || user.isBuyer !== true) {
    throw new JsonApiError('E_NOT_BUYER', 401);
  }

  return await next();
};
