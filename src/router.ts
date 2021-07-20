import Application = require("koa");
import {Logger} from '@mybricks/rocker-commons'
import * as Types from "./types";

let routerReg;
let routerPtnBindings: Map<Function, Types.RouterForClz>;

import * as mime from 'mime';
import * as FS from 'fs';
import * as PATH from "path";

import * as Utils from './utils';
import {Router} from './config';
import {RouterMap, RouterConfig} from "./types";
import {Stream} from "stream";
import {FlushStreamResp, DownloadResp, RedirectResp, RenderResp, ResourceResp} from "./returns";

const assetsPt = /\.(js|map|css|less|png|jpg|jpeg|gif|bmp|ico|webp|html|htm|eot|svg|ttf|woff|mp4|mp3|zip)$/i;

export default function (_routerMap, _routerPtnBindings: Map<Function, Types.RouterForClz>) {
  routerPtnBindings = _routerPtnBindings;
  routerReg = _routerMap;
  let urlSearcher = searchPtn(routerReg), assets = proAssets(),
    fnAssets = function (url, context: Application.Context) {
      if (assetsPt.test(url)) { // For assets
        assets(url, context);
        return true;
      }
    }, fnRouter = async function (url, context: Application.Context, bt: number) {
      let ptUrl = urlSearcher(url); // The url matched
      if (ptUrl) {
        let rw: FunctionConstructor = <FunctionConstructor>routerReg.all[ptUrl];
        if (rw) {
          let rfc: Types.RouterForClz = routerPtnBindings.get(rw);
          if (rfc) { // have decorators for router
            await invoke(context, ptUrl, url, rfc, rw);
          }
        }
        if (context.request.req.method.toUpperCase() !== 'HEAD') {
          Logger.info(`[Rocker-mvc]Request ${context.request.url} costed ${new Date().getTime() - bt} ms.`);
        }
        return true;
      }
    }
  return async function (context: Application.Context, next) {
    var url: string = context.request.url;
    if (Utils.isEmpty(url)) {
      throw new Types.MVCError('No url found', 404);
    }

    let bt = new Date().getTime();
    url = url.replace(/\?[\s\S]*/ig, '');

    if (Router.assets) {
      if (!fnAssets(url, context)) {
        if (!await fnRouter(url, context, bt)) {
          throw new Types.MVCError(`The request url(${url}) not found.`, 404);
        }
      }
    } else {
      if (!await fnRouter(url, context, bt)) {
        if (!fnAssets(url, context)) {
          throw new Types.MVCError(`The request url(${url}) not found.`, 404);
        }
      }
    }
  }
}

//-----------------------------------------------------------------------------------------

//Assets
function proAssets() {
  let EtagSet = new Set();
  return function (url: string, context) {
    let etag = context.headers['if-none-match'];
    if (etag && EtagSet.has(etag)) {
      context.response.status = 304;
      return;
    }

    if (!Router.assets) {
      if (!/^\/favicon.ico$/i.test(url)) {//Ignore /favicon.ico
        throw new Types.MVCError('No assets configuration in route.', 404);
      } else {
        return;
      }
    }

    let folderPath, cacheStrategy: { cache: 'Etag' | 'Cache-Control', strategy?: string };
    if (typeof (Router.assets) == 'string') {
      folderPath = Router.assets;
    } else if (typeof (Router.assets) == 'object') {
      for (let urlPre in Router.assets) {
        let to: any = Router.assets[urlPre];
        if (url.startsWith(urlPre)) {
          url = url.substring(urlPre.length);
          if (url.trim() == '') {
            throw new Types.MVCError(`Url is empty(pre:${urlPre}.`, 404);
          }
          if (typeof (to) == 'object') {
            cacheStrategy = to;
            folderPath = to.folder;
          } else {
            folderPath = to;
          }
        }
      }
    }

    cacheStrategy = Object.assign({cache: 'Etag'}, cacheStrategy);

    if (folderPath) {
      let absPath = PATH.join(folderPath, url);
      if (!absPath.startsWith(folderPath)) throw new Error('Access error.');

      let stat = FS.statSync(absPath);
      if (stat.isFile()) {
        try {
          let mt = mime.getType(PATH.basename(absPath));

          context.response.status = 200;
          context.response.set('Content-Type', mt);
          if (cacheStrategy.cache === 'Etag') {
            etag = url + '-' + stat.mtime.getTime().toString(16);
            EtagSet.add(etag);
            context.response.set('ETag', etag);
          } else if (cacheStrategy.cache === 'Cache-Control') {
            context.response.set('Cache-Control', cacheStrategy.strategy || 'public, max-age=604800');//Default value = a week
          }

          context.body = FS.createReadStream(absPath);
        } catch (ex) {
          Logger.error(`assets error`, ex);
          if (!/^\/favicon.ico$/i.test(url)) {//Ignore /favicon.ico
            throw new Types.MVCError(`The request url(${url}) error.`, 500);
          } else {
            throw ex;
          }
        }
        return;
      }
    }
    throw new Types.MVCError(`The request url(${url}) not found.`, 404);
  }
}

//Url pattern closure
function searchPtn(_routerMap: RouterConfig & { all: RouterMap }) {
  let urlPattern: RegExp;

  let ts: string = '';
  for (let key in _routerMap.all) {
    ts += '|^' + key + '$'
  }

  urlPattern = new RegExp(ts.substring(1), 'ig');

  function recur(_url: string): string {
    if (urlPattern) {
      let url = _url == '' ? '/' : _url;
      let ptAry: RegExpExecArray;
      try {
        ptAry = urlPattern.exec(url);
      } finally {
        urlPattern.lastIndex = 0;
      }
      if (!ptAry) {
        let ary: string[] = url.split('/');
        ary.pop();
        if (!ary.length) {
          return;
        }
        let nts = ary.join('/');
        return nts == _url ? undefined : recur(nts);
      } else {
        return ptAry[0];
      }
    }
  }

  return recur;
}

/**
 * Invoke a function from router class
 * @param {Application.Context} _ctx
 * @param {string} _urlRoot
 * @param {string} _urlFull
 * @param {RouterForClz} routerForClz
 * @param {FunctionConstructor} fn
 * @returns {Promise<void>}
 */
async function invoke(_ctx: Application.Context,
                      _urlRoot: string,
                      _urlFull: string,
                      routerForClz: Types.RouterForClz,
                      fn: FunctionConstructor) {
  let urlSub = _urlFull.substring(_urlRoot.length);
  urlSub = (urlSub.startsWith('/') ? '' : '/') + urlSub;
  let pattern: Types.RouterPattern;
  let args: any;

  if (_ctx.is('multipart')) {
    pattern = routerForClz.getPost(urlSub);
    args = (<any>(_ctx.request)).body || {};
  } else if (_ctx.request.method === "POST") {
    pattern = routerForClz.getPost(urlSub);
    args = await getPostArgs(_ctx);
  } else if (_ctx.request.method === "GET") {
    pattern = routerForClz.getGet(urlSub);
    args = _ctx.request.query;
  } else if (_ctx.request.method === "HEAD") {
    pattern = routerForClz.getHead(urlSub);
    args = _ctx.request.query;
  }

  if (pattern) {
    let instance;
    try {
      instance = new (<FunctionConstructor>fn)(); // new instance
    } catch (ex) {
      Logger.error(`New class\n\n${fn}\nerror.`);
      throw ex;
    }
    let paramAry = [];
    let paramDescAry = routerForClz.getMethodParam(pattern.clzMethod);
    if (paramDescAry) {
      paramDescAry.forEach((_desc) => {
        if (_desc.type === Types.ReqMethodParamType.Normal) {
          if (_desc.required && !args[_desc.name]) {
            throw new Types.MVCError(`The request param[${_desc.name}] not found.`, 500);
          }
          paramAry.push(_desc.transformer(args[_desc.name]))
        } else if (_desc.type === Types.ReqMethodParamType.Request) {
          paramAry.push(_ctx.request)
        } else if (_desc.type === Types.ReqMethodParamType.Response) {
          paramAry.push(_ctx.response)
        } else if (_desc.type === Types.ReqMethodParamType.Params) {
          paramAry.push(args)
        }
      })
    }

    let rtn = await instance[pattern.clzMethod].apply(instance, paramAry);
    if (rtn !== undefined) {
      if (rtn instanceof FlushStreamResp) {//For FlushStreamResp
        _ctx.response.status = 200;
        _ctx.body = rtn;

        rtn._initKOACtx(_ctx)
        return
      } else if (rtn instanceof Stream) {//Return an Stream object
        _ctx.response.status = 200;
        _ctx.body = rtn;
        return;
      } else if (rtn instanceof RedirectResp) {//For redirect
        _ctx.response.status = rtn.code;
        _ctx.redirect(rtn.url);
        return;
      } else if (rtn instanceof DownloadResp) {//For download
        let dr: DownloadResp = rtn;
        _ctx.response.status = 200;
        _ctx.response.attachment(dr.name);//Download file name
        _ctx.body = dr.stream;
        return;
      } else if (typeof (rtn) === 'function') {
        throw new Types.MVCError(`Object or raw value expected but got \n       ${rtn}`);
      } else if (rtn instanceof Error) {
        _ctx.status = (<any>rtn).status || 500;
        _ctx.type = (<any>rtn).type || 'text/plain; charset=utf-8';
        return _ctx.body = rtn.message || `ERROR`;
      }
    }

    if (pattern.render) { // render by template
      if (rtn !== undefined && typeof (rtn) != 'object') {
        throw new Types.MVCError(`Object type expected but got \n       ${rtn}`);
      }

      if (rtn instanceof ResourceResp) {
        _ctx.response.status = 200;
        // 这里应该有不同的 type
        _ctx.response.set('Content-Type', 'application/javascript');

        if (Array.isArray(pattern.render)) { // string[] for Bigpipe
          _ctx.response.set('Transfer-Encoding', 'chunked');
          pattern.render.forEach(function (_rd) {
            let resource = renderFn(routerForClz, _rd, rtn);
            _ctx.res.write(resource);
          })
          _ctx.res.end();
        } else {
          throw new Types.MVCError(`The request url(${_urlFull}, full path: ${_ctx.url}, method: ${_ctx.method}), render format error.`, 500);
        }
        //Multi view
      } else if (rtn instanceof RenderResp) {
        if (typeof pattern.render != 'object') {
          throw new Types.MVCError(`The request url(${_urlFull}, full path: ${_ctx.url}, method: ${_ctx.method}), the render in decorator must be an object.`, 500);
        }
        let rd = pattern.render[rtn.name];
        if (!rd) {
          throw new Types.MVCError(`The request url(${_urlFull}, full path: ${_ctx.url}, method: ${_ctx.method}), render(name:${rtn.name}) not found.`, 404);
        }
        _ctx.response.status = 200;
        _ctx.response.set('Content-Type', 'text/html;charset=utf-8');
        _ctx.response.set('Transfer-Encoding', 'chunked');

        rd.forEach(function (_rd) {
          let html = renderFn(routerForClz, _rd, rtn.model);
          _ctx.res.write(html);
        })
        _ctx.res.end();
      } else {
        _ctx.response.status = 200;
        _ctx.response.set('Content-Type', 'text/html;charset=utf-8');

        if (Array.isArray(pattern.render)) { // string[] for Bigpipe
          _ctx.response.set('Transfer-Encoding', 'chunked');
          pattern.render.forEach(function (_rd) {
            let html = renderFn(routerForClz, _rd, rtn);
            _ctx.res.write(html);
          })
          _ctx.res.end();
        } else {
          throw new Types.MVCError(`The request url(${_urlFull}, full path: ${_ctx.url}, method: ${_ctx.method}), render format error.`, 500);
        }
      }
    } else {
      _ctx.response.status = 200;
      _ctx.response.set('Content-Type', 'application/json;charset=utf-8');
      _ctx.body = typeof (rtn) == 'object' ? JSON.stringify(rtn) : rtn;
      //_ctx.res.end();
    }
  } else {
    throw new Types.MVCError(`The request url(${_urlFull}, full path: ${_ctx.url}, method: ${_ctx.method}) not found.`, 404);
  }
}

function renderFn(routerForClz: Types.RouterForClz,
                  _render: { path: string, compile: Function },
                  _model: any) {
  try {
    let compiler: Function = _render.compile(); // Get template compiler
    return compiler(_model || {});
  } catch (ex) {
    throw new Types.MVCError(ex);
  }
}

function getPostArgs(context) {
  const req = context.req
  return new Promise((resolve, reject) => {
    const complete = function (pdata) {////TODO 研究koa-body本身对content-type的处理
      if (pdata != '') {
        try {
          let reqArgs
          // 针对urlencoded做解析
          if (pdata.trim().startsWith('{')) {
            reqArgs = (new Function('', `return ${pdata}`))();
          } else {
            let pary = pdata.split('&');
            if (pary && pary.length > 0) {
              reqArgs = {};
              pary.forEach(function (_p) {
                let tary = _p.split('=');
                if (context.get('content-type').indexOf('application/x-www-form-urlencoded') != -1) {
                  tary = tary.map(d => {
                    d = d.replace(/\+/g, ' ');
                    d = decodeURIComponent(d);
                    return d;
                  });
                }
                if (tary && tary.length == 2) {
                  reqArgs[tary[0].trim()] = tary[1];
                }
              });
            }
          }
          resolve(reqArgs);
        } catch (e) {
          reject(e);
        }
      }
    }

    if (!context.request.body) {
      let pdata = "";
      req.addListener("data", postchunk => {
        pdata += postchunk;
      });
      req.addListener("end", function () {
        complete(pdata)
      });
    } else {
      complete(context.request.body)
    }
  });
}
