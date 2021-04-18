import * as RM from "../index";
import {Logger, _Logger, init} from "@vdian/commons";
import Application = require("koa");

class T extends _Logger {
    info(message: string): void {
        console.log(message);
    }

    warn(message: string): void;
    warn(message: string, error: Error): void;
    warn(message: string, error?: Error): void {
        console.log(message);
    }
    error(message: string): void;
    error(message: string, error: Error): void;
    error(message: string, error?: Error): void {
        console.log(message);
    }
}

init({
    Logger: () => {
        return new T();
    }
})

RM.route({'/home': require('./test-router')}).start({port: 8889});

