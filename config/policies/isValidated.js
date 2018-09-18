'use strict';

const JsonApiError = require('../../utils/json-api-error');
const _ = require('lodash');
/**
 * @apiDefine isAuthenticated User is logged in
 */
module.exports = async (ctx, next) => {
  const user = _.get(ctx, 'session.passport.user');
  if (!user || !user.isValidated) {
    throw new JsonApiError('E_AUTHENTICATED', 403);
  }
  if (user.isBuyer && !user.hasValidDirectDebitMandate) {
    throw new JsonApiError('E_NO_VALID_DIRECT_DEBIT_MANDATE', 403);
  }

  if (ctx.status === 404) {
    return await next();
  }
};
