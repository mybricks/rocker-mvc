import {route} from "../..";

import * as path from 'path';

/**
 * 作为静态服务器使用
 */
let assetsPath = path.join(path.resolve('./'), './src/assets/');

//形式1：
// route
// (
//     {
//         assets: assetsPath//匹配  /.......*.html/css/js/jpg....... 缓存策略：  Etag 403
//     }
// )
// ({'/home': require('./src/home')})
//     .start();

//形式2：
// route
// (
//     {
//         assets:
//             {
//                 '/assets/':assetsPath//匹配  /assets/......*.html/css/js/jpg....... 缓存策略：  Etag 403
//             }
//     }
// )
// ({'/home': require('./src/home')})
//     .start();

//形式3：
route
(
    {
        assets:
            {
                '/assets/'://匹配  /assets/......*.html/css/js/jpg.......
                    {folder: assetsPath, cache: 'Cache-Control'}//静态资源位置及缓存策略
                                                                                    // Cache-Control强缓存 {cache:'Cache-Control',strategy:'public, max-age=604800 }
                                                                                    // Etag 403
                                                                                    // None 不缓存
            }
    }
)
({'/home': require('./src/home')})
    .start();

// 1. assets选项指定静态文件内容的位置,访问路径为: http://127.0.0.1:8080/home.html
// 2. 静态内容处理优先级低于router配置
// 3.rocker-mvc提供了不允许访问静态资源之外内容的安全机制