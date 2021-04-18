import Application = require('koa');

export default async function(reqUrl: string, routerClz: Function, reqArgs, reqContext: Application.Context) {
    // TODO: Unitest
    if (false) {
        // console.log(routerClz);
        // console.log(reqArgs);
        // console.log(reqContext);
    }
    return '<div>' + reqUrl + '</div>';
}