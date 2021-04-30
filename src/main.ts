import {init, Logger, _Tracelocal} from '@mybricks/rocker-commons';

import Application = require('koa');
import * as compress from 'koa-compress';
import 'reflect-metadata';

import midRouter from './router';
import * as util from 'util';
import * as Util from './util';
import * as _Types from './types';
import * as co from 'co';

import {ReqMethodParamType, RouterConfig, RouterMap, MVCError, RenderWrap} from './types';
import * as Path from 'path';
import * as FS from 'fs';
import * as Https from 'https'

import {Start, Router} from './config';

require('zone.js');
// 
import 'zone.js'
import {Stream} from 'stream';

interface IConfigParam {
  port?: number;
  gZipThreshold?: number;
  key?: string;
  cert?: string
}

let routerReg: RouterConfig & { all: RouterMap } = {all: {}};

/**
 * Router pattern bindings
 * @type Map<Function, _Types.RouterForClz>
 * Function:RouterClass
 */
const routerPtnBindings: Map<Function, _Types.RouterForClz> = new Map<Function, _Types.RouterForClz>();

const routerPathBindings: Map<Function, string> = new Map<Function, string>();

/**
 * The param's decorator for Request object of koa
 * @param {object} target
 * @param {string} methodName
 * @param {number} index
 * @constructor
 */
export function Request(target: object, methodName: string, index: number): void {
  let rfc: _Types.RouterForClz = getRouterForClz(target);
  rfc.regMethodParam(methodName, index, ReqMethodParamType.Request, {required: true}, v => {
    return v
  });
}

export function Response(target: object, methodName: string, index: number): void {
  let rfc: _Types.RouterForClz = getRouterForClz(target);
  rfc.regMethodParam(methodName, index, ReqMethodParamType.Response, {required: true}, v => {
    return v
  });
}

export function Params(target: object, methodName: string, index: number): void {
  let rfc: _Types.RouterForClz = getRouterForClz(target);
  rfc.regMethodParam(methodName, index, ReqMethodParamType.Params, {required: true}, v => {
    return v
  });
}

export function Param(_cfg: _Types.RouterParamType): Function {
  return function (target: Function, paramName: string, index: number) { // Use @Get(string|{url:string,render:string})
    let rfc: _Types.RouterForClz = getRouterForClz(target);
    let dt = Reflect.getMetadata('design:paramtypes', target, paramName);
    if (!dt) {
      dt = Reflect.getMetadata('design:paramtypes', target.constructor, paramName);
    }
    if (!dt) {
      throw new Error('Reflect error occured.');
    }
    rfc.regMethodParam(paramName, index, ReqMethodParamType.Normal, _cfg, v => {
      if (v === undefined || v === null) {
        return v;
      }
      let tfn = dt[index];
      if (tfn.name.toUpperCase() === 'OBJECT') {
        if (typeof v === 'string') {
          try {
            return JSON.parse(v)
          } catch (ex) {
            try {
              return (new Function('', `return ${v}`))()
            } catch (ex) {
              throw new Error(`JSON.parse(${v}) error,check the type for @Param('${paramName}') is Object or not .`);
            }
          }
        } else {
          return v
        }
      } else {
        return tfn(v);
      }
    });
  }
}

export function Head(...args: (_Types.RPParam)[]): Function | any {
  return decoratorMethod('head', args);
}

export function Get(...args: (_Types.RPParam)[]): Function | any {
  return decoratorMethod('get', args);
}

export function Post(...args: (_Types.RPParam)[]): Function | any {
  return decoratorMethod('post', args);
}


export class RedirectResp extends _Types.ResponseWrap {

  private _url: string;
  /**
   * Response header's code,301\302(default)
   */
  private _code: 302 | 301 = 302;

  constructor(url: string) {
    super();
    this._url = url;
  }

  get url() {
    return this._url;
  }

  get code() {
    return this._code;
  }

  set code(code: 302 | 301) {
    this._code = code;
  }
}

export class DownloadResp extends _Types.ResponseWrap {
  private _stream: Stream;
  private _name: string;

  constructor(name: string, stream: Stream) {
    super();
    this._name = name;
    this._stream = stream;
  }

  get name() {
    return this._name;
  }

  get stream() {
    return this._stream;
  }
}

/**
 * Render for return
 */
export class RenderResp extends RenderWrap {
  private _name: string;
  private _model: object;

  /**
   * Constructor
   * @param name The key in render description of
   * @param model
   */
  constructor(name: string, model: object) {
    super();
    this._name = name;
    this._model = model;
  }

  get name(): string {
    return this._name;
  }

  get model(): object {
    return this._model;
  }
}

export class ResourceResp extends RenderWrap {
  private _name: string;

  /**
   * Constructor
   * @param name The key in render description of
   */
  constructor(name: string) {
    super();
    this._name = name;
  }

  get name(): string {
    return this._name;
  }
}


// --------------------------------------------------------------------------------------------

export function pipe(midware: Application.Middleware) {
  if (!midware) {
    throw new _Types.MVCError('The midware for pipe should be a Promise or Generator function');
  }
  koaMidAry.push(midware);
  return {
    route,
    pipe,
    start
  }
}

let koaMidAry: Application.Middleware[] = [];

export function route(routerMap: _Types.RouterMap | RouterConfig)
  : {
  pipe: Function,
  start: Function
  (routerMap: _Types.RouterMap | RouterConfig): {
    pipe: Function,
    start: Function
  }
} {
  if (Util.isEmpty(routerMap)) {
    throw new _Types.MVCError('The routerMap is empty');
  }

  if (Object.keys(routerMap).filter(k => {
    return !/^\//.test(k);
  }).length > 0) {//Configuration
    let rc: RouterConfig = routerMap;
    let bootstrapModule = Util.getBootstrapModule(module);
    ['renderStart', 'renderEnd'].forEach(name => {
      if (rc[name]) {
        let tpath: string = Path.resolve(Path.dirname(bootstrapModule.filename), rc[name]);
        if (!FS.existsSync(tpath)) {
          throw new _Types.MVCError(`The render.start file[${tpath}] is empty`);
        }
        routerReg[name] = tpath;
      }
    })

    //Set configurations
    Router.assets = rc.assets;
    Router.gZipThreshold = rc.gZipThreshold || Router.gZipThreshold;//Default value is Router.gZipThreshold
    Router.errorProcessor = rc.errorProcessor;

    return Object.assign(route, {pipe, start});
  }

  for (let nm in routerMap) {
    let obj = routerMap[nm], fn = obj['default'] || obj;
    let md = getModule(fn);
    if (!md) {
      // throw new Error(`No file for router ${nm} defined.`);
      // router支持非node module，可以为变量
      routerPathBindings.set(fn, process.cwd());
    } else {
      routerPathBindings.set(fn, md['filename']);
    }

    routerMap[nm] = fn;
  }

  let t: any = routerMap;
  routerReg['all'] = t;

  //Merge all
  routerPtnBindings.forEach(function (clzReg, fna) {
    routerPathBindings.forEach(function (fnPath, fnb) {
      //Notice,here may be an error,if more than one parent inherit here
      if (fna.isPrototypeOf(fnb)) {
        let rtc: _Types.RouterForClz = routerPtnBindings.get(fnb);
        if (rtc) {
          rtc.setParent(clzReg);//Process inherit
        } else {
          routerPtnBindings.set(fnb, clzReg);
        }
        routerPtnBindings.delete(fna);
        routerPathBindings.set(fna, routerPathBindings.get(fnb));
      }
    })
  });

  let rn: any = {
    pipe,
    start,
    build
  };
  return rn;
}

/**
 *  Startup MVC front-end building
 * @param {function} buildFn
 */
function build(buildFn: { (input: Types.Pluginput): void }): void {
  let ref: Types.Pluginput = new Map();
  routerPtnBindings.forEach((v, k) => {
    let tv = new Map();
    ref.set(k, tv);
    v['methodReg'].forEach((mr) => {
      mr.forEach((rp) => {
        tv.set(rp.urlPattern, rp);
      })
    })
  })

  Logger.info(`[Rocker-mvc]Starting building ${buildFn}...`);
  buildFn(ref);
}

let pluginAry: { (input: Types.Pluginput): void }[] = [];


/**
 *
 * @param path
 */
let routerResou

export function resource(path: string): void {

}

/**
 * Startup MVC container
 * @param {object}  Configuration object
 */
function start(config: IConfigParam = {
  port: Start.port
}): { plugin: Function, koaServer: Application } {
  if (typeof config['port'] !== 'number') {
    throw new _Types.MVCError('\n[Rocker-mvc]Start server error, server port expect for start config.\n');
  }
  Start.port = config.port;

  //Router middleware
  let rfn: Function = midRouter(routerReg, routerPtnBindings);

  //Compress middleware
  let cfn: Function = compress({threshold: Router.gZipThreshold});

  koaMidAry.push(async function (context: Application.Context, next) {
    await rfn(context, next);
    await cfn(context, next);//GZip
  });

  let koa: Application = new Application();
  setImmediate(() => {
    let ss = new Array(160).join('-');
    Logger.info(`${ss}`);
    Logger.info(`[Rocker-mvc]Server(${Util.getLocalIp()}) starting...`);

    //Startup plugins
    if (pluginAry.length > 0) {
      let ref: Types.Pluginput = new Map();
      routerPtnBindings.forEach((v, k) => {
        let tv = new Map();
        ref.set(k, tv);
        v['methodReg'].forEach((mr) => {
          mr.forEach((rp) => {
            tv.set(rp.urlPattern, rp);
          })
        })
      })

      pluginAry.forEach((pl) => {
        Logger.info(`[Rocker-mvc]Starting plugin ${pl}...`);
        pl(ref);
      })
    }

    //-------------------------------------------------------------------------
    try {
      //Startup koa
      if (koaMidAry.length > 0) {
        koaMidAry.forEach((mid, index) => {
          koa.use(async function (context: Application.Context, next) {
            if (index == 0) {
              let zone = Zone.current.fork({
                name: 'koa-context',
                properties: {
                  context,
                  store: {}//Cache {key,value} for an request trace
                }
              });
              context['_zone'] = zone;

              //Generate trace id
              if (!context.request.header[_Types.TRACE_ID_KEY_IN_HEADER]) {
                context.request.header[_Types.TRACE_ID_KEY_IN_HEADER] = Util.genTraceId();
              }
            }
            await new Promise((resolve, reject) => {
              context['_zone'].run(async function () {
                try {
                  if (Util.isGeneratorFunction(mid) || Util.isGenerator(mid)) {
                    await co(mid.call(context, next));
                  } else {
                    await mid(context, next);
                  }
                  resolve();
                } catch (ex) {
                  reject(ex);
                }
              });
            })
          })
        })
      }

      //Init global Tracelocal
      init({
        Tracelocal: function () {
          return new class extends _Tracelocal {
            get id() {
              try {
                return Zone.current.get('context').request.header[_Types.TRACE_ID_KEY_IN_HEADER];
              } catch (ex) {
                throw new _Types.MVCError(`Get trace id error\n${ex}`, 500);
              }
            }

            get(key: string) {
              let r = Zone.current.get('store')[key];
              return r !== undefined ? r : Zone.current.get('context')[key];
            }

            set(key: string, value: any): void {
              Zone.current.get('store')[key] = value;
            }
          }();
        }
      })
      Logger.info(`\n[Rocker-mvc]Init Tracelocal completed.`);

      koa.on('error', (err, context) => {
        Logger.error(`Rocker-mvc net error, context: ${JSON.stringify(context)}`, err);
      });
      koa.context.onerror = onKoaErr;

      if (config.key && config.cert) {
        (<any>koa).server = Https.createServer({
          key: typeof config.key === 'string' ? FS.readFileSync(config.key) : config.key,
          cert: typeof config.cert === 'string' ? FS.readFileSync(config.cert) : config.cert
        }, koa.callback()).listen(config.port, '0.0.0.0')
      } else {
        (<any>koa).server = koa.listen(config.port, '0.0.0.0');
      }

      Logger.info(bootstrapMsg());

      Logger.info(`\n[Rocker-mvc]Server(${Util.getLocalIp()}) start completed,listening on port ${config.port}...`);
      Logger.info(`${ss}`);

      process.on('uncaughtException', function (err) {
        Logger.error(err);
      });
    } catch (ex) {
      Logger.error('[Rocker-mvc]Start server ${address} error.\n');
      Logger.error(ex);
      Logger.info(`${ss}`);
      throw ex;
    }
  })

  return {
    plugin,
    koaServer: koa
  };
}

function plugin(pluginFn: { (input: Types.Pluginput): void }): { plugin: Function } {
  if (util.isFunction(pluginFn)) {
    pluginAry.push(pluginFn);
  } else {
    throw new _Types.MVCError(`The Plugin must be a function.`);
  }
  return {
    plugin
  }
}

export namespace Const {
  export const Assets: string = 'Assets';
}

export namespace Types {
  export type Pluginput = Map<Function,
    Map<String,
      {
        render:
          {
            path: string,//Template absolute path
            factory: Function//Factory function
          }[]
      }>>
}

// --------------------------------------------------------------------------------------------

function decoratorMethod(method: string, args): Function | any {
  let md = method.charAt(0).toUpperCase() + method.substring(1);
  if (args.length == 1) { //@Get(string|{url:string,render:string})
    let cfg: any = args[0];
    return function (target: Function, methodName: string, desc: object) {
      let rfc: _Types.RouterForClz = getRouterForClz(target);
      rfc[`set${md}`](methodName, cfg);
    }
  } else if (args.length == 3) { //@Get
    let rfc: _Types.RouterForClz = getRouterForClz(args[0]);
    let meta = rfc.getMethodMeta(<string>args[1]);
    if (meta) {
      rfc[`set${md}`](<string>args[1], meta.rpp);
    } else {
      throw new Error(`${md} decorator's param error.`);
    }
  }
}

function bootstrapMsg() {
  let startMsg = [];
  if (Router.errorProcessor) {
    startMsg.push(`  Router errorProcessor:`);
    startMsg.push(`    ${Router.errorProcessor}\n`);
  }

  if (Router.assets) {
    startMsg.push(`  Router assets:`);
    startMsg.push(`    ${JSON.stringify(Router.assets)}\n`);
  }

  if (routerReg.all) {
    startMsg.push(`  Router mappings:`);
    let all = routerReg.all;
    for (let rootUrl in all) {
      let tv = routerPtnBindings.get(all[rootUrl]);
      if (tv) {
        startMsg.push(`    ${rootUrl} => "${tv.fnPath()}"`);
        startMsg.push(`${tv.toString(8)}`);
      } else {
        startMsg.push(`    ${rootUrl}:None`);
      }
    }
  }
  return startMsg.join('\n');
}

function onKoaErr(err: any) {
  if (!err) return;
  let th = this;
  this['_zone'].run(function () {
    // wrap non-error object
    if (!(err instanceof Error)) {
      const newError: any = new Error('non-error thrown: ' + err);
      // err maybe an object, try to copy the name, message and stack to the new error instance
      if (err) {
        if (err.name) newError.name = err.name;
        if (err.message) newError.message = err.message;
        if (err.stack) newError.stack = err.stack;
        if (err.status) newError.status = err.status;
        if (err.headers) newError.headers = err.headers;
      }
      err = newError;
    }

    let errCode = typeof err['getCode'] === 'function' ? err['getCode']() : 500;
    let content: string;
    if (Router.errorProcessor) {
      content = Router.errorProcessor(err);
      if (typeof (content) == 'boolean' && !content) {
        return;
      }
      errCode = 200;//statuscode is 200 when errorProcessor exist
    }

    th.response.status = errCode;
    if (content !== undefined && content !== null) {
      let data: string;
      if (typeof (content) == 'object') {
        th.set('Content-Type', 'application/json;charset=utf-8');
        data = JSON.stringify(content);
      } else {
        th.set('Content-Type', 'text/html');
        data = content;
      }
      th.res.end(data);
    } else {
      th.set('Content-Type', 'text/html');
      th.res.end('<h1>' + errCode + '</h1>' + '<div>' + err + '</div>');
    }
    setTimeout(function () {
      if (err.stack) {
        Logger.error(err.stack);
      } else if (err.message) {
        Logger.error(err.message);
      } else {
        Logger.error('Unknown error occurred.');
      }
    })
  });
}


function getRouterForClz(target) {
  let fn = target.constructor;
  return routerPtnBindings.get(fn) || (routerPtnBindings.set(fn, new _Types.RouterForClz(() => {
    return routerPathBindings.get(fn)
  })).get(fn));
}

/**
 * Get it's defined module,Notice! here may be an error
 * @param md
 * @param {Function} clz
 * @returns [module,subClass]
 */
function getModule(clz: Function): Promise<any> {
  const mcpc = module.constructor.prototype.constructor;

  if (typeof mcpc === 'undefined' || typeof mcpc._cache !== 'object') {
    throw new Error('@rocker-mvc not support the node version.');
  }
  let md
  for (let nm in mcpc._cache) {
    if (nm.indexOf('node_modules') == -1) {
      md = mcpc._cache[nm];
      if (md && md.exports) {
        for (let nnm in md.exports) {
          if (md.exports[nnm] === (clz['default'] || clz)) {
            return md;
          }
        }
      }
    }
  }
}
