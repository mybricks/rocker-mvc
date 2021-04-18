import {Inject} from "@vdian/rocker/index";
import SomeDao from "./test-dao";
import {Threadlocal} from "../index";

export default class {
    @Inject
    private dao: SomeDao

    async computeSomething(_param: string): Promise<string> {
        return await (() => {
            return new Promise<string>((_resolve) => {
                setTimeout(() => {
                    // console.log(_param);
                    let getContext = function(){
                        let ct = Threadlocal.context;

                        console.log(ct);
                    }
                    getContext();
                    _resolve('finish timeout' + _param + ':  :' + this.dao.id);
                }, 10)
            })
        })();
    }
}
