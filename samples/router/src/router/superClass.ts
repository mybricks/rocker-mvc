import {Get} from "../../../..";
import {Param} from "../../../../index";

export default class {
    @Get({url: '/base', render: './tpt.ejs'})
    get1(@Param('param') _param){
        return {msg: 'I am a method from super class'}
    }
}