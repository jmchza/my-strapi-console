'use strict';

const JsonApiError = require('../../utils/json-api-error');
const _ = require('lodash');
/**
 * @apiDefine isAuthenticated User is logged in
 */
module.exports = async (ctx, next) => {
  let authenticated = ctx.isAuthenticated();

  if (authenticated === undefined) {
    ctx.throw('Passport is not installed', 500); // doesn't work
    ctx.status = 500;
    ctx.body = 'Passport is not installed';
  }

  if (authenticated === false) {
    throw new JsonApiError('E_AUTHENTICATED', 403);
  }
  const user = _.get(ctx, 'session.passport.user');
  if (!user || user.isValidated) {
    throw new JsonApiError('E_NOT_REGISTERED', 401);
  }
  if (ctx.status === 404) {
    return await next();
  }
};
