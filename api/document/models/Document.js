const _ = require('lodash');
/**
 * Lifecycle callbacks for the `Settings` model.
 */
const bindReference = async (model) => {
  const reference_type = _.get(model, 'attributes.reference_type');
  const reference_id = _.get(model, 'attributes.reference_id');
  const modelConfig = strapi.models[reference_type];
  if (reference_id && reference_type && modelConfig) {
    const modelName = modelConfig.globalId;
    const reference = await global[modelName].forge({id: reference_id}).fetch();
    model.attributes.reference = reference.toJSON();
  }
};
module.exports = {
  // Before saving a value.
  // Fired before an `insert` or `update` query.
  // beforeSave: (model, attrs, options) =>  {
  //   return new Promise();
  // },

  // After saving a value.
  // Fired after an `insert` or `update` query.
  //afterSave: (model, response, options) =>  {
  //   return new Promise();
  //},

  // Before fetching a value.
  // Fired before a `fetch` operation.
  // beforeFetch: (model, columns, options) =>  {
  //   return new Promise();
  // },

  // After fetching a value.
  // Fired after a `fetch` operation.
  // afterFetch: (model, response, options) =>  {
  //   return new Promise();
  // },

  // Before creating a value.
  // Fired before `insert` query.
  // beforeCreate: (model, attrs, options) =>  {
  //   return new Promise();
  // },

  // After creating a value.
  // Fired after `insert` query.
  // afterCreate: (model, attrs, options) =>  {
  //   return new Promise();
  // },

  // Before updating a value.
  // Fired before an `update` query.
  // beforeUpdate: (model, attrs, options) => {
  //   return new Promise();
  // },

  // After updating a value.
  // Fired after an `update` query.
  // afterUpdate: (model, attrs, options) =>  {
  //   return new Promise();
  // },

  // Before destroying a value.
  // Fired before a `delete` query.
  // beforeDestroy: (model, attrs, options) => {
  //   return new Promise();
  // },
  afterFetch: async (model) =>  {
    await bindReference(model);
  },
  afterFetchCollection: async (collection) =>  {
    let promise = [];
    for (let index = 0; index < collection.models.length; index++) {
      const model = collection.models[index];
      promise.push(bindReference(model));
    }
    await Promise.all(promise);
  },
  beforeSave: async (model) => {
    if (!model.attributes.reference_type || !model.attributes.reference_id) {
      model.attributes.reference_type = 'upload';
    }
    delete model.attributes.reference;
  },

  // After destroying a value.
  // Fired after a `delete` query.
  afterDestroy: async (model) => {
    const previousAttributes = model.previousAttributes();
    const { reference_type, reference_id } = previousAttributes;
    let promise = [];

    // Delete reference document (e.g. invoice)
    if (reference_type === 'invoice') {
      // delete invoice
      let referenceModel = await Invoice.where({ id: reference_id }).fetch();
      promise.push(referenceModel.destroy());
    } else if (reference_type === 'offer') {
      // delete offer
      let offerModel = await Offer.where({ id: reference_id }).fetch();
      offerModel && promise.push(offerModel.destroy());
    } else if (reference_type === 'letter') {
      // delete letter
      let letterModel = await Letter.where({ id: reference_id }).fetch();
      letterModel && promise.push(letterModel.destroy());
    }
    // remove all document
    if (model.attributes.upload) {
      let uploadModel = await Upload.where({ id: model.attributes.upload }).fetch();
      uploadModel && promise.push(uploadModel.destroy());
    }
    await promise;
  }
};