import {init, Logger, _Tracelocal} from '@mybricks/rocker-commons';

import Application = require('koa');
import * as compress from 'koa-compress';

import midRouter from './router';
import * as SysUtils from 'util';
import * as MyUtils from './utils';
import * as _Types from './types';
import * as co from 'co';

import {ReqMethodParamType, RouterConfig, RouterMap, MVCError, RenderWrap} from './types';
import * as Path from 'path';
import * as FS from 'fs';
import * as Https from 'https'

import {Start, Router} from './config';

require('zone.js');

import 'zone.js'

import {routerPathBindings, routerPtnBindings} from "./decorators";

interface IConfigParam {
  port?: number;
  gZipThreshold?: number;
  key?: string;
  cert?: string
}

let routerReg: RouterConfig & { all: RouterMap } = {all: {}};


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
  if (MyUtils.isEmpty(routerMap)) {
    throw new _Types.MVCError('The routerMap is empty');
  }

  if (Object.keys(routerMap).filter(k => {
    return !/^\//.test(k);
  }).length > 0) {//Configuration
    let rc: RouterConfig = routerMap as RouterConfig;
    let bootstrapModule = MyUtils.getBootstrapModule(module);
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
    Logger.info(`[Rocker-mvc]Server(${MyUtils.getLocalIp()}) starting...`);

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
                context.request.header[_Types.TRACE_ID_KEY_IN_HEADER] = MyUtils.genTraceId();
              }
            }
            await new Promise((resolve, reject) => {
              context['_zone'].run(async function () {
                try {
                  if (MyUtils.isGeneratorFunction(mid) || MyUtils.isGenerator(mid)) {
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

      Logger.info(`\n[Rocker-mvc]Server(${MyUtils.getLocalIp()}) start completed,listening on port ${config.port}...`);
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
  if (SysUtils.isFunction(pluginFn)) {
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
      let newError
      try {
        newError = new Error(JSON.stringify(err));
      } catch (ex) {
        newError = ex;
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


/**
 * Get it's defined module,Notice! here may be an error
 * @param md
 * @param {Function} clz
 * @returns [module,subClass]
 */
function getModule(clz: Function): Promise<any> {
  const mcpc: { _cache } = module.constructor.prototype.constructor;

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
