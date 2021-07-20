/*!
 * Rocker-MVC
 *
 * MVC Framework for typescript
 *
 * Copyright(c) 2017
 * Author: CheMingjun <chemingjun@126.com>
 */
import {Start} from './src/config';
import * as PATH from "path";

Start.importPath = PATH.dirname(module.parent['filename']);

export {pipe, route} from './src/main';
export {FlushStreamResp, RenderResp, ResourceResp, DownloadResp, RedirectResp} from './src/returns'
export {Response, Request, Get, Head, Param, Params, Post} from './src/decorators'