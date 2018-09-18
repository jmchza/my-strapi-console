const path = require('path');
const fs = require('fs');
const _ = require('lodash');

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
};
String.prototype.replaceAll = function(search, replacement) {
  var target = this;
  return target.replace(new RegExp(search, 'g'), replacement);
};
const createFolderIfNotExit = (dir) => {
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }
};

const copyFileSync = (source, target) => {
  let targetFile = target;
    //if target is a directory a new file with the same name will be created
  if ( fs.existsSync( target ) ) {
    if ( fs.lstatSync( target ).isDirectory() ) {
      targetFile = path.join( target, path.basename( source ) );
    }
  }
  fs.writeFileSync(targetFile, fs.readFileSync(source));
};
const copyFolderRecursiveSync =( source, target ) => {
  let files = [];
    //check if folder needs to be created or integrated
  let targetFolder = path.join( target, path.basename( source ) );
  if ( !fs.existsSync( targetFolder ) ) {
    fs.mkdirSync( targetFolder );
  }

    //copy
  if ( fs.lstatSync( source ).isDirectory() ) {
    files = fs.readdirSync( source );
    files.forEach( function ( file ) {
      let curSource = path.join( source, file );
      if ( fs.lstatSync( curSource ).isDirectory() ) {
        copyFolderRecursiveSync( curSource, targetFolder );
      } else {
        copyFileSync( curSource, targetFolder );
      }
    } );
  }
};

const newPath = path.resolve(__dirname, '../api');
// Define files/dir paths
const apisPath = path.resolve(__dirname, '../api-v2');
const apis = fs.readdirSync(apisPath).filter(x => x[0] !== '.');
let listMorph = [];
_.forEach(apis, api => {
  const newApiPath = path.join(newPath, api);

    //Convert routes
  createFolderIfNotExit(newApiPath);
  const apiPath = path.join(apisPath, api);
  const modelName = api.capitalize();
  const routerPath = path.join(apiPath, 'config/routes.json');
  if(fs.existsSync(routerPath)) {
    let convertedRoutes = {routes: []};
    createFolderIfNotExit(path.join(newApiPath, 'config'));
    const routes = require(routerPath);
    Object.keys(routes.routes).map(route => {
      const method = route.split(' ')[0];
      const pathRoute = route.split(' ')[1];
      const routeOldObject = routes.routes[route];
      convertedRoutes.routes.push({
        method,
        path: pathRoute,
        handler: `${routeOldObject.controller}.${routeOldObject.action}`,
        type: routeOldObject.type,
        ...(!_.isEmpty(routeOldObject.policies) && {config: {policies: routeOldObject.policies.map(o => `global.${o}`)}})
      });
    });
    fs.writeFileSync(path.join(newApiPath, 'config/routes.json'), JSON.stringify(convertedRoutes, null, 4));
  }

    //Convert models
  const modelPath = path.join(apiPath, `models/${modelName}.settings.json`);
  if(fs.existsSync(modelPath)) {
    let convertedModel = {};
    createFolderIfNotExit(path.join(newApiPath, 'models'));
    const modelSettings = require(modelPath);
    convertedModel.connection = modelSettings.connection;
    convertedModel.collectionName = modelSettings.tableName || api;
    convertedModel.info = {name: api, description: ''};
    convertedModel.options = modelSettings.options;
    convertedModel.options = {increments: false, ...convertedModel.options, idAttribute: 'id', idAttributeType: 'uuid'};
    convertedModel.attributes = modelSettings.attributes;
    Object.keys(convertedModel.attributes).map(o => {
      delete convertedModel.attributes[o].required;
      if (convertedModel.attributes[o].enum || convertedModel.attributes[o].values) {
        convertedModel.attributes[o] = {type: 'string', defaultTo: convertedModel.attributes[o].defaultTo};
      }
      if (_.isArray(convertedModel.attributes[o].morph)) {
        _.forEach(convertedModel.attributes[o].morph, morphRef => {
          listMorph.push({
            file: path.join(newPath, morphRef,`models/${morphRef.capitalize()}.settings.json`),
            via: o,
            model: api,
            attributes: morphRef
          });
        });
        convertedModel.attributes[o] = {model: '*', filter: 'field'};
      }
    });
    if (convertedModel.attributes.id) {
      delete convertedModel.attributes.id;
    }
    fs.writeFileSync(path.join(newApiPath, `models/${modelName}.settings.json`), JSON.stringify(convertedModel, null, 4));
  }
  const modelJsPath = path.join(apiPath, `models/${modelName}.js`);
  if(fs.existsSync(modelJsPath)) {
    createFolderIfNotExit(path.join(newApiPath, 'models'));
    let content = fs.readFileSync(modelJsPath, 'utf8');
    content = content.replace(/strapi\.config/g, 'strapi.config.environments[strapi.config.environment]');
    fs.writeFileSync(path.join(newApiPath, `models/${modelName}.js`), content);
  }
    //Convert controller
  const controllerPathJs = path.join(apiPath, `controllers/${modelName}.js`);
  if(fs.existsSync(controllerPathJs)) {
    createFolderIfNotExit(path.join(newApiPath, 'controllers'));
    let content = fs.readFileSync(controllerPathJs, 'utf8');
    content = content.replace(/function \* \(\)/g, 'async (ctx) =>');
    content = content.replace(/function\*\(\)/g, 'async (ctx) =>');
    content = content.replace(/function\*/g, 'async function');
    content = content.replaceAll('yield', 'await');
    content = content.replaceAll('this', 'ctx');
    content = content.replace(/\.call\(/g, '(');
    content = content.replace(/strapi\.config/g, 'strapi.config.environments[strapi.config.environment]');
    content = content.replace(/ctx\.passport\.\_passport\.instance/g, 'ctx.state._passport.instance');
    fs.writeFileSync(path.join(newApiPath, `controllers/${modelName}.js`), content);
  }

    //Convert services
  const servicesPath = path.join(apiPath, 'services');
  if(fs.existsSync(servicesPath)) {
    copyFolderRecursiveSync(servicesPath, newApiPath);
    const servicesPathJs = path.join(apiPath, `services/${modelName}.js`);
    if(fs.existsSync(servicesPathJs)) {
      let content = fs.readFileSync(servicesPathJs, 'utf8');
      content = content.replace(/\.call\(/g, '(');
      content = content.replace(/strapi\.config/g, 'strapi.config.environments[strapi.config.environment]');
      content = content.replace(/ctx\.passport\.\_passport\.instance/g, 'ctx.state._passport.instance');
      content = content.replace(/strapi\-bookshelf\/lib\/utils/g, 'strapi-hook-bookshelf/lib/utils');
      content = content.replace(/\.tableName/g, '.collectionName');
      fs.writeFileSync(path.join(newApiPath, `services/${modelName}.js`), content);
    }
  }
});

//Update morph related

_.forEach(listMorph, o => {
  let targetModel = require(o.file);
  targetModel.attributes[o.model] = _.pick(o, ['model', 'via']);
  fs.writeFileSync(o.file, JSON.stringify(targetModel, null, 4));
});