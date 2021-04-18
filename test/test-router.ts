import { Get, Head, Param, Request, Response } from "../index";
import { Inject } from "@vdian/rocker";
import { Logger } from "@vdian/commons";
import SomeService from './test-service';
import { Dubbo } from './dubbo';

import  'zone.js';

export default class {
    @Inject
    private service: SomeService;

    @Get({ url: '/aaa', render: './tpt.ejs' })//for bigpipe
    async get(@Param('id') _id: string, @Request _ctx) {
        let ts = await this.service.computeSomething(_id);
        //this.dao.id

        Logger.info(`\n=== Log Test === \n id=${_id} \n ctx=${JSON.stringify(_ctx, null, 2)} \n================`);
        return { message: _id };
    }

    @Head({ url: '/a' })
    async geta(@Param('id') _id: string, @Request req, @Response res) {
        res.set('domain','127.0.0.1')
        res.remove('domain')
        Logger.info(`remote turple: ${req.socket.remoteAddress}:${req.socket.remotePort},protocal: ${req.socket.remoteFamily}\n
        UA: ${req.headers['user-agent']} url: ${req.url}
        `);
        return;
    }
}