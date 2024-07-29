// @ts-ignore
import btc = require('bitcore-lib-inquisition');
import { Tap } from '@cmdcode/tapscript'  // Requires node >= 19

import * as dotenv from 'dotenv';
dotenv.config();

import { expect, use } from 'chai'
import { TestLamportOracle } from '../src/contracts/tests/testLamportOracle'
import chaiAsPromised from 'chai-as-promised'
import { fetchP2WPKHUtxos } from './utils/txHelper';
import { Ripemd160, reverseByteString, toByteString } from 'scrypt-ts';
use(chaiAsPromised)


describe('Test SmartContract `TestLamportOracle`', () => {
    let instance: TestLamportOracle

    before(async () => {
        await TestLamportOracle.loadArtifact()

        const pubKeyRoot = Ripemd160(toByteString('0000000000000000000000000000000000000000'))

        instance = new TestLamportOracle(pubKeyRoot)

        console.log('Script:', instance.lockingScript.toASM())
        console.log('Script len:', instance.lockingScript.toBuffer().length)
    })
    
    
    it('should pass oracle sig verify', async () => {
        
    })


})
