import { expect } from 'chai';
import tpt from '../src/tpt';

describe('src/tpt.ts', function () {
    it('default', function () {
        return tpt('test').then((val) => {
            expect(val).to.be.equal('<div>test</div>');
        });
    });
});