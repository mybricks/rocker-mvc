import {pipe, route} from "../..";
import {Get, Param} from "../..";
import {Tracelocal} from '@mybricks/rocker-commons'

import renderTsx from '@mybricks/rocker-mvc-plugin-react'
import * as path from "path";

class Abc {
  @Get({url: '\/[\\d]+?\/abc', regexp: true})
  async get(@Param('param') _param) {
    // await new Promise(res=>{
    //     setTimeout(res,20000)
    // })
    console.log('Trace id is:::::' + Tracelocal.id + '   Param value:' + _param);

    return {
      a: 123
    }
  }
}

/**
 * 配置路由并启动
 */

// //route函数API
// //1.普通路由配置
// route({/**路由配置**/})
// //2.添加配置项
// route({
//     renderStart?: string,
//     renderEnd?: string,
//     gZipThreshold?: number,//GZip threadhold number
//     assets?: string,//Assets folder path
//     errorProcessor?: Function//Error processor
// })({/**路由配置**/})

const server = route({
  assets: {
    '/build/static/': {
      folder: path.join(__dirname, './build/static/'),
      cache: 'None'
    },
  },
  errorProcessor: ex => {
    let traceId = Tracelocal.id;
    console.log(`当前Trace Id ${traceId}`)
    return {code: -1, traceId}
  }
})({
  // '/':require('./src/router/router'),
  '/test': require('./src/router/router'),
  '/abc': Abc
}).start()//启动（默认端口8080）

server.plugin(
  renderTsx({
    env:'dev',
    wrapper: './tpt.ejs',
    webpackConfig: path.resolve(__dirname, './build/webpack.config.js')
  })
)




