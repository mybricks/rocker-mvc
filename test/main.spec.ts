/*!
 * Test for Rocker-MVC
 *
 * Copyright(c) 2017
 * Author: CheMingjun <chemingjun@126.com>
 */

import { expect } from "chai";

import { Get, MVC } from "../index";


import { Inject } from "@vdian/rocker";
import * as request from 'supertest';
import { Logger, init } from '@vdian/commons'
import { MidLog } from '@vdian/midlog';

MidLog.config({
    env: 'dev',
    // 所有级别日志均输出到 "/home/www/logs/info.log"中，各级中间件则输出至 "/home/www/logs/${name}/info.log"中
    appender: [{
        type: 'trace',
    }, {
        type: 'debug',
    },
    {
        type: 'INFO',
    }, {
        type: 'ERROR',
    },
    {
        type: 'fatal',
    }, {
        type: 'WARN',
    }],
});

try {
    // mocha will init multiple time in watch mode
    init({
        Logger: () => {
            return new MidLog();
        }
    })
} catch (e) {
    if (e.message != 'Common.Logger has been initializad.') {
        throw e
    }
}


describe('Test', () => {
    it("Start An MVC Server", (done) => {
        const serverIns = MVC.route({
            '/home': import('./test-router')
        }).start()

        request(serverIns).get('/home/aaa?id="jjj"')
            .set('Accept', 'application/json')
            .expect(200)
            .end(function (err, res) {
                serverIns.close()
                if (err) return done(err);
                done();
            });
    })
    it("Port confilict", (done) => {
        const serverIns = MVC.route({
            '/home': import('./test-router')
        }).start()

        // const serverIns2 = MVC.route({
        //     '/home': import('./test-router')
        // }).start()

        request(serverIns).get('/home/aaa?id="jjj"')
            .set('Accept', 'application/json')
            .expect(200)
            .end(function (err, res) {
                serverIns.close()
                if (err) return done(err);
                done();
            });
    })
})

