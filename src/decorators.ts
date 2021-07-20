import 'reflect-metadata';

import * as _Types from "./types";
import {ReqMethodParamType} from "./types";

/**
 * Router pattern bindings
 * @type Map<Function, _Types.RouterForClz>
 * Function:RouterClass
 */
export const routerPtnBindings: Map<Function, _Types.RouterForClz> = new Map<Function, _Types.RouterForClz>();

export const routerPathBindings: Map<Function, string> = new Map<Function, string>();

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

function getRouterForClz(target) {
  let fn = target.constructor;
  return routerPtnBindings.get(fn) || (routerPtnBindings.set(fn, new _Types.RouterForClz(() => {
    return routerPathBindings.get(fn)
  })).get(fn));
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