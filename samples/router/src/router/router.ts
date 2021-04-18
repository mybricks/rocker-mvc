import {Get, Post, Param, Request, RedirectResp, DownloadResp, RenderResp} from "../../../..";
import {Tracelocal} from '@mybricks/rocker-commons'
import Base from './superClass'

import * as fs from 'fs';

//在start.ts 中配置了路由规则为
// '/demo': require('./src/homepage/router')

export default class extends Base {
  /**
   * Post and use trace id
   * @param _param
   * @returns {Promise<{msg:number}>}
   */
  @Get({url: '/test-react', render: './TT.tsx'})
  async wwwwww(@Param('param') _param) {
    console.log('hrerer')
    return {msg: 2};
  }

  /**
   * Post and use trace id
   * @param _param
   * @returns {Promise<{msg:number}>}
   */
  @Get({url: '/multiView', render: {'a': ['./tpt.ejs', './tpt.ejs']}})
  async get(@Param('param') _param) {
    // await new Promise(res=>{
    //     setTimeout(res,20000)
    // })
    console.log('Trace id is:::::' + Tracelocal.id + '   Param value:' + _param);
    return new RenderResp('a', {msg: 2});
  }

  /**
   * Get and throw an error
   * @param _param
   * @param _req
   * @returns {Promise<void>}
   */
  @Get({url: '/test', render: './tpt.ejs'})
  async getAndPost(@Param('param') _param, @Request _req) {
    throw new Error('2');
    // console.log(_param+_req);
    // return {msg:2};
  }

  /**
   * Redirect
   * @returns {Promise<void>}
   */
  @Get({url: '/redirect'})
  async redirect() {
    let rp: RedirectResp = new RedirectResp('/test/base');
    //rp.code = 301; //The default code is 302
    return rp;
  }


  /**
   * Download
   * @param _response
   * @returns {Promise<module:fs.ReadStream>}
   */
  @Get('/redirect')
  async download() {
    let fileName = 'somefile.zip';
    const fileStream = fs.createReadStream(require('path').join(__dirname, '../../', fileName));
    return new DownloadResp(fileName, fileStream);
  }
}