import * as Util from './utils';
import * as FS from 'fs';
import * as Path from 'path';
import * as Ejs from 'ejs';

export const TRACE_ID_KEY_IN_HEADER: string = 'X-Trace-Id';

export enum ReqMethodType {
  Head, Get, Post, Delete, Update,
}

export enum ReqMethodParamType {
  Normal, Request, Params, Response, Context,
}

export class RouterPattern {
  fnPath: Function;
  urlPattern: string | RegExp;
  regexp: boolean;
  /**
   * Render code like:
   * {'a':'./t.ejs'} or {'a':['./t0.ejs','./t1.ejs']} or './t0.ejs' or ['./t0.ejs','./t1.ejs']
   */
  render: { path: string, compile: Function }[] | { [index: string]: { path: string, compile: Function }[] };
  clzMethod: string;
  wrapper: string;

  constructor(fnPath: Function, _clzMethod: string, _config?: RPParam, idx?: number) {
    this.fnPath = fnPath;
    this.clzMethod = _clzMethod;
    if (Util.isEmpty(_config)) {
      this.urlPattern = '/';
    } else if (typeof _config === 'string') {
      this.urlPattern = <string>_config;
    } else if (typeof _config === 'object') {
      this.urlPattern = _config['url'];
      this.regexp = _config['url'] instanceof RegExp;
      this.wrapper = _config['wrapper'];
      let renderCfg = _config['render'];
      let renderType = _config['renderType'];
      if (renderCfg) {
        let ary = [];
        let th = this;

        let proFn = function (_item, _type?) {
          return {
            get path() {
              if (typeof _item == 'string') {
                let rp: string = Path.resolve(Path.dirname(th.fnPath()), _item);
                /* if (!FS.existsSync(rp)) {
                    throw new MVCError(`The template file[${rp}] not Found.`, 404);
                } */
                return rp;
              } else {
                throw new MVCError(`The config: render's item type(string|{[index:string]:string}) error.`, 500);
              }
            }, compile: function (_name: string) {
              let thPath = this.path;
              let rp = typeof (thPath) == 'object' ? thPath[_name] : thPath;
              let content = FS.readFileSync(rp, 'utf-8');//Return template's content
              return Ejs.compile(content, {filename: rp}); // option {filename:...}
            }, get renderType() {
              return _type
            }
          }
        }

        //@Get({url:'/multiView',render:{'a':'./tpt.ejs'}})
        if (typeof renderCfg == 'object' && !Array.isArray(renderCfg)) {
          let rtn = {};
          for (let name in renderCfg) {
            let tary = [];
            (<string[]>(Array.isArray(renderCfg[name]) ? renderCfg[name] : [renderCfg[name]]))
              .forEach(_tpt => tary.push(proFn(_tpt)))
            rtn[name] = tary;
          }
          this.render = rtn;
          return;
        }

        [].concat(Array.isArray(renderCfg) ? renderCfg : [renderCfg]).forEach(_tpt => {
          ary.push(
            // proFn(_tpt, renderType)
            proFn(_tpt.replace(/\.tsx/, `(${idx}).tsx`), renderType)
          )
        })
        this.render = ary;
      }
    }
  }
}

interface RenderDesc {
  url: string | RegExp,
  render?: string | string[] | { [index: string]: string | string[] }
  renderType?: string
}

export declare type RPParam = RenderDesc | string;

export declare type RouterParamType =
  { name: string }
  | { required: boolean }
  | { name: string, required: boolean }
  | string;

export  type MethodParams = { index: number, name: string, type: ReqMethodParamType, transformer: Function, required: boolean };

let idx: number = 0

/**
 * Router's register
 */
export class RouterForClz {
  fnPath: Function; //clz's module

  constructor(fnPath: Function) {
    this.fnPath = fnPath;
  }

  regMethodParam(_name: string, _index: number, _type: ReqMethodParamType, _cfg: RouterParamType, _transformer: Function) {
    let mp: MethodParams[] = this.paramReg.get(_name);
    if (!mp) {
      mp = new Array<MethodParams>();
      this.paramReg.set(_name, mp);
    }
    let name: string = typeof (_cfg) === 'object' ? _cfg['name'] : _cfg;
    let required: boolean = typeof (_cfg) === 'object' ? _cfg['required'] : false;//default value is false
    mp.push({index: _index, type: _type, name: name, transformer: _transformer, required: required});
    mp.sort((p, n) => {
      return p.index - n.index;
    })
  }

  getMethodMeta(_methodName: string) {
    return this.methodMeta.get(_methodName);
  }

  getMethodParam(_clzMethod: string) {
    let rtn = this.paramReg.get(_clzMethod);
    return rtn ? rtn : this.parent ? this.parent.getMethodParam(_clzMethod) : undefined;
  }

  setHead(_clzMethod: string, _config?: RPParam): void {
    this.setter(ReqMethodType.Head, _clzMethod, _config);
  }

  getHead(_url: string): RouterPattern {
    return this.getter(ReqMethodType.Head, _url);
  }

  setGet(_clzMethod: string, _config?: RPParam): void {
    this.setter(ReqMethodType.Get, _clzMethod, _config);
  }

  getGet(_url: string): RouterPattern {
    return this.getter(ReqMethodType.Get, _url);
  }

  setPost(_clzMethod: string, _config?: RPParam): void {
    this.setter(ReqMethodType.Post, _clzMethod, _config);
  }

  getPost(_url: string): RouterPattern {
    return this.getter(ReqMethodType.Post, _url);
  }

  setParent(parent: RouterForClz) {
    this.parent = parent;
  }

  toString(blanks: number): string {
    let rtn = [];
    let ss = new Array(blanks).join(' ');
    this.methodReg.forEach((value, reqType) => {
      value.forEach((routerPattern, url) => {
        let renderStr = [];
        if (routerPattern.render) {
          if (Array.isArray(routerPattern.render)) {
            routerPattern.render.forEach(rp => {
              renderStr.push(rp.path);
            })
          } else {
            renderStr.push(JSON.stringify(routerPattern.render));
          }
        }
        rtn.push(`${ss}${ReqMethodType[reqType].toUpperCase()} ${url} => {function:"${routerPattern.clzMethod}"` +
          (renderStr.length > 0 ? `,render:"${renderStr.join(',')}"}` : '}'));
      })
    })
    return rtn.join('\n');
  }

  private parent: RouterForClz;

  private paramReg: Map<string, MethodParams[]> = new Map<string, MethodParams[]>();

  private methodReg: Map<ReqMethodType, Map<String, RouterPattern>> = new Map<ReqMethodType, Map<String, RouterPattern>>();

  // 存放正则路径
  private regExpMethodReg: Map<ReqMethodType, Map<RegExp, RouterPattern>> = new Map<ReqMethodType, Map<RegExp, RouterPattern>>();

  private methodMeta: Map<String, { rpp: RPParam, types: ReqMethodType[] }> = new Map<String, { rpp: RPParam, types: ReqMethodType[] }>();

  private getter(_reqType: ReqMethodType, _url: string) {
    let tg = this.methodReg.get(_reqType);
    if (tg) {
      let rtn = tg.get(_url);
      if (rtn) {
        return rtn;
      }
    }

    // 扫描正则规则
    let rtg = this.regExpMethodReg.get(_reqType);
    if (rtg) {
      let keys = rtg.keys();
      for (let k of keys) {
        if (_url.match(k)) {
          return rtg.get(k);
        }
      }
    }
    return this.parent ? this.parent.getter(_reqType, _url) : undefined;
  }

  private setter(_reqType: ReqMethodType, _clzMethod: string, _config: RPParam) {
    // 如果是正则路径匹配
    if (_config && typeof (_config) == 'object'
      && _config.url && _config.url instanceof RegExp) {
      let tg = this.regExpMethodReg.get(_reqType);
      if (!tg) {
        tg = new Map<RegExp, RouterPattern>();
        this.regExpMethodReg.set(_reqType, tg);
      }
      let rp: RouterPattern = new RouterPattern(this.fnPath, _clzMethod, _config);
      tg.set(new RegExp(rp.urlPattern), rp);
      let treg = this.methodMeta.get(_clzMethod);
      if (treg) {
        treg.types.push(_reqType)
      } else {
        this.methodMeta.set(_clzMethod, {rpp: _config, types: [_reqType]});
      }
    } else {
      let tg = this.methodReg.get(_reqType);
      if (!tg) {
        tg = new Map<String, RouterPattern>();
        this.methodReg.set(_reqType, tg);
      }
      if (typeof _config === 'object' && _config.render) {
        idx++
      }
      let rp: RouterPattern = new RouterPattern(this.fnPath, _clzMethod, _config, idx);
      tg.set(<string>rp.urlPattern, rp);
      let treg = this.methodMeta.get(_clzMethod);
      if (treg) {
        treg.types.push(_reqType)
      } else {
        this.methodMeta.set(_clzMethod, {rpp: _config, types: [_reqType]});
      }
    }
  }
}

export declare type RouterMap = { [index: string]: Function };
export declare type RouteCfgAssets =
  string
  | { [index: string]: string | { folder: string, cache?: 'Etag' | 'Cache-Control' | 'None', strategy?: string } };
export declare type RouterConfig = {
  renderStart?: string,
  renderEnd?: string,
  gZipThreshold?: number,//GZip threadhold number
  assets?: RouteCfgAssets,//Assets folder path
  errorProcessor?: Function
}

export class MVCError extends Error {
  private code: number;

  constructor(_msg: string, _code: number = 500) {
    super(_msg);
    this.code = _code;
  }

  getCode(): number {
    return this.code;
  }
}

export class ResponseWrap {

}

export class RenderWrap {

}
