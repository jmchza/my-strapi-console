'use strict';

/**
 * `isDisabled` policy.
 */

module.exports = async (ctx, next) => {
  ctx.throw('Passport is not installed', 404);
};
