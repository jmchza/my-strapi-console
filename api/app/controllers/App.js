"use strict"

const ua = require("universal-analytics")
const countries = require("document-generator/lib/countries.json")
// const routes = require('../config/oauth2');

module.exports = {
  /**
   * @api {post} /login User login
   * @apiName Login
   * @apiGroup App
   * @apiPermission none
   *
   * @apiDescription Tries to log in a user or admin
   * @apiParam (required) {String} email
   * @apiParam (required) {String} password

   * @apiSuccess {Boolean}  success       Indicator whether login was successful
   * @apiSuccess {Object}   user          User data
   * @apiSuccess {Number}   user.id       ID of user
   * @apiSuccess {String}   user.username Users name
   * @apiSuccess {String}   user.role     Users role (user or admin)
   *
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "success": true,
   *       "user": {
   *         "id": "1",
   *         "username": "test"
   *         "role": "user"
   *       }
   *     }
   *
   *
   * @apiError {Boolean}    success       Indicator whether login was successful
   * @apiErrorExample {json} Error-Response:
   *  HTTP/1.1 401 Unauthorized
   *  {
   *    "success": "false"
   *  }
   */

  login: async (ctx) => {
    var ctx = ctx
    ctx.request.nojsonapi = true
    const { email } = ctx.request.body || {}
    const checkExitsEmail = await Userlogin.forge({ email }).fetch()
    if (!checkExitsEmail) {
      ctx.body = { wrongEmail: true }
      ctx.status = 403
      return
    }
    await ctx.state._passport.instance
      .authenticate("local", async function(err, user, info) {
        if (err) {
          console.log(err, user, info)
        }
        if (info !== undefined) {
          ctx.body = { error: info }
        }

        // Create monthly payments when a user logs in for test purposes
        // let userModel = await User.forge({id: user.id}).fetch()
        // await strapi.services.transaction.payMonthlyBuyerFee(userModel)

        if (user === false) {
          let loginAttemptNumber = await strapi.services.account.loginAttemps(ctx, false)
          ctx.status = 401
          ctx.body = { success: false, loginAttempts: loginAttemptNumber }
        } else {
          // Successful login
          await strapi.services.account.loginAttemps(ctx, true)
          // Side effects
          await strapi.services.account.login(user)
          await ctx.login(user)
          console.log(`${user.id}`)
          let visitor = ua(strapi.config.environments[strapi.config.environment].gaId, `${user.id}`)
          visitor
            .event(
              "Invoice",
              "Invoice Factored",
              "User factored an invoice",
              /* {
              user: userModel.attributes.companyName,
              amount: clearValues.amount,
              minBid: clearValues.minimumBid,
              selloutBid: clearValues.selloutBid
            }, */
              err => {
                if (err) console.log("err:", err)
              }
            )
            .send()
          ctx.body = {
            success: true,
            user: user
          }
        }
      })
      (ctx)
  },

  /**
   * @api {get} /logout User logout
   * @apiName Logout
   * @apiGroup App
   *
   */
  logout: async (ctx) => {
    try {
      ctx.request.nojsonapi = true
      ctx.session.passport.user = null
    } catch (e) {}

    ctx.logout()
    ctx.body = {}
    ctx.status = 200
  },

  /**
   * @api {Post} /app/update-decimo-order
   * @apiName update invoice decimo
   * @apiGroup App
   *
   */
  updateDecimoOrder: async (ctx) => {
    try {
      ctx.body = strapi.services.app.callBackDecimoOrder(ctx)
    } catch (err) {
      if (isNaN(err.status)) {
        console.log(err)
        ctx.status = 400
      } else {
        ctx.status = err.status
      }
      if (err.details) {
        ctx.body = { errors: err.details }
      } else {
        ctx.body = { errors: JSON.stringify(err) }
      }
    }
  },

  /**
   * @api {get} /app/models
   * @apiName Get models strapi json
   * @apiGroup App
   *
   */
  getAllCountry: async (ctx) => {
    var ctx = ctx
    ctx.request.nojsonapi = true
    ctx.body = countries

    // console.log(ctx.passport._passport);
    // console.log('::::: ' + ctx.server);
    // await ctx.state._passport.instance
    //   .authenticate("bearer", { session: false }, async function(err, user, info) {
    //     if (err) {
    //       console.log(err, user, info)
    //     }
    //     if (info !== undefined) {
    //       console.log(info)
    //       ctx.body = { error: info }
    //     } else {
    //       console.log("user: " + user + " info: " + info)
    //       ctx.body = countries
    //     }
    //   })
    //   (ctx)
  },

  /**
   * @api {get} /app/models
   * @apiName Get models strapi json
   * @apiGroup App
   *
   */
  getStrapiModel: async (ctx) => {
    ctx.request.nojsonapi = true
    ctx.body = strapi.models
  },

  /**
   * @api {get} /version Backend version
   * @apiName Version
   * @apiDescription
   * Details about the version of ctx backend deployment
   * @apiGroup App
   *
   *    * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   {
     "commitId": "441f545",
     "commitMsg": "switch to Overlay2 driver",
     "commitDateTime": "2016-09-15T16:18:01.520Z"
   }
   */
  version: async (ctx) => {
    try {
      ctx.body = await strapi.services.app.version()
    } catch (err) {
      ctx.body = err
    }
  },

  create: async (ctx) => {
    try {
      ctx.body = await strapi.services.jsonapi.add(strapi.models.repository, ctx.request.body)
    } catch (err) {
      ctx.body = err
    }
  },

  findOne: async (ctx) => {
    try {
      let model = await strapi.services.jsonapi.fetch(strapi.models.repository, ctx.params)
      if (model && model.attributes.reference_type === "offer") {
        let letter = await Letter.forge({ offer: model.attributes.reference_id }).fetch({ withRelated: ["customer"] })
        model.attributes.attachLetter = letter && letter.toJSON()
      } else if (model && model.attributes.reference_type === "invoice") {
        let letter = await Letter.forge({ invoice: model.attributes.reference_id }).fetch({ withRelated: ["customer"] })
        model.attributes.attachLetter = letter && letter.toJSON()
      }
      ctx.body = model
    } catch (err) {
      ctx.body = err.toString()
    }
  },
  /**
   * verify phone number
   */
  verifyPhoneNumber: async (ctx) => {
    try {
      ctx.body = await strapi.services.app.verifyPhoneNumber(ctx)
    } catch (err) {
      if (isNaN(err.status)) {
        ctx.status = 400
      } else {
        ctx.status = err.status
      }
      if (err.details) {
        ctx.body = { errors: err.details }
      } else {
        ctx.body = { errors: JSON.stringify(err) }
      }
    }
  }
}
