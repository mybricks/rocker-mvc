import { expect } from 'chai';
import * as types from '../src/types';

describe('src/types.ts', function() {
    it('types.ReqMethodType', function() {
        expect(types.ReqMethodType.Get).to.be.equal(0);
        expect(types.ReqMethodType.Post).to.be.equal(1);
        expect(types.ReqMethodType.Delete).to.be.equal(2);
        expect(types.ReqMethodType.Update).to.be.equal(3);
    });
    it('types.RouterPattern', function () {
        class Child extends types.RouterPattern {}

        const child1 = new Child();
        expect(child1.urlPattern).to.be.equal('/');
        const child2 = new Child('get');
        expect(child2.urlPattern).to.be.equal('/');
        const child3 = new Child('get', 'aaa');
        expect(child3.urlPattern).to.be.equal('aaa');
        const child4 = new Child('get', {
            render: 'a',
            url: 'b'
        });
        expect(child4.render).to.be.equal('a');
        expect(child4.urlPattern).to.be.equal('b');
    });
    it('types.MVCError', function () {
        const MVCError = types.MVCError;

        const e1 = new MVCError('message');
        expect(e1.code).to.be.equal(500);
        expect(e1.getCode()).to.be.equal(500);

        const e2 = new MVCError('message', 300);
        expect(e2.code).to.be.equal(300);
        expect(e2.getCode()).to.be.equal(300);
    });
    it('types.RouterForClz', function () {
        const RouterForClz = types.RouterForClz;
    });
});