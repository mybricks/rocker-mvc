import { expect } from 'chai';
import * as util from '../src/util';
import { start } from 'repl';

describe('src/util', function () {
    it('isEmpty()', function () {
        expect(util.isEmpty(undefined)).to.equal(true);
        expect(util.isEmpty(null)).to.equal(true);
        expect(util.isEmpty('')).to.equal(true);
        expect(util.isEmpty('test')).to.equal(false);
    });
    it('isFunction()', function () {
        expect(util.isFunction({})).to.equal(false);
        expect(util.isFunction(() => { })).to.equal(true);
        expect(util.isFunction('')).to.equal(false);
    });
    it('getExtends()', function () {
        class A {}
        const a = new A();
        expect(util.getExtends(a)).to.equal(A.prototype);
    });
    it('sleep(): without callback', function () {
        const startTime = new Date().getTime();

        return util.sleep(1000).then(() => {
            const endTime = new Date().getTime();
            expect(endTime - startTime >= 1000).to.equal(true);
        });
    });
    it('getLocalIp()', function () {
        expect(util.getLocalIp().split('.').length).to.equal(4);
    });
    it('getBootstrapModule()', function () {
        // console.log(util.getBootstrapModule(module));
        // expect(util.getBootstrapModule().split('.').length).to.equal(4);
    });
});