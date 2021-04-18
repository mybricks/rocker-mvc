import { expect } from 'chai';
import * as rewire from 'rewire';

import router from '../src/router';

describe('src/router.ts', function () {
    it('___searchPtn', function () {
        const searchPath = rewire('../src/router').__get__('searchPtn');
        const recur = searchPath({
            all: {
                '/home': new Promise(function(resolve, reject) {
                    resolve('home done');
                })
            }
        });

        expect(recur('/home')).to.be.equal('/home');
    });
});