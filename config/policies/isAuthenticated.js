'use strict';

const JsonApiError = require('../../utils/json-api-error');
const _ = require('lodash');
/**
 * @apiDefine isAuthenticated User is logged in
 */
module.exports = async (ctx, next) => {
  const user = _.get(ctx, 'session.passport.user');
  if (!user) {
    throw new JsonApiError('E_AUTHENTICATED', 401);
  }
  if (ctx.status === 404) {
    return await next();
  }
};
