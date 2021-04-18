import {route} from "../..";

import * as path from 'path';

/**
 * 作为静态服务器使用
 */
let assetsPath = path.join(path.resolve('./'), './src/assets/');
//route({assets:{'/assets/':assetsPath} }).start();
route({assets: {'/assets/': {folder: assetsPath, cache: 'Cache-Control'}}}).start();
//或者 route({assets: assetsPath})({'/home':require('./home.ts')}).start();

// 1. assets选项指定静态文件内容的位置,访问路径为: http://127.0.0.1:8080/home.html
// 2. 静态内容处理优先级低于router配置
// 3.rocker-mvc提供了不允许访问静态资源之外内容的安全机制