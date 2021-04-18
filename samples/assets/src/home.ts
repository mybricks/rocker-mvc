import {Get} from "../../..";

export default class {
    @Get('/')
    get() {
        return {a: 3}
    }
}