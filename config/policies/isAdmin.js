'use strict';

/**
 * `isAdmin` policy.
 */
const JsonApiError = require('../../utils/json-api-error');
const _ = require('lodash');

module.exports = async (ctx, next) => {
  if (ctx.isAuthenticated === undefined) {
    ctx.throw('Passport is not installed', 500);
  }
  const user = _.get(ctx, 'session.passport.user');
  if (user && user.role === 'admin') {
    return await next();
  } else {
    throw new JsonApiError('E_MISSING_PERMISSION', 401);
  }
};
