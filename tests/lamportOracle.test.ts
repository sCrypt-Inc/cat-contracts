// @ts-ignore
import btc = require('bitcore-lib-inquisition')
import { Tap } from '@cmdcode/tapscript' // Requires node >= 19

import * as dotenv from 'dotenv'
dotenv.config()

import { expect, use } from 'chai'
import { TestLamportOracle } from '../src/contracts/testLamportOracle'
import {
    LamportOracle,
    LamportMsg,
    LamportKey,
    LamportSig,
    LAMPORT_KEY_SIZE,
    LAMPORT_MSG_BITS,
} from '../src/contracts/lamportOracle'
import { MerkleProof, NodePos } from '../src/contracts/merklePath'
import chaiAsPromised from 'chai-as-promised'
import { hash160, fill, bsv, Ripemd160, toByteString } from 'scrypt-ts'
use(chaiAsPromised)

describe('Test SmartContract `TestLamportOracle`', () => {
    let instance: TestLamportOracle
    let msg: LamportMsg
    let sig: LamportSig
    let pubKey: LamportKey
    let pubKeyProof: MerkleProof

    before(async () => {
        await TestLamportOracle.loadArtifact()

        const pubKeyRoot = Ripemd160(
            toByteString('0000000000000000000000000000000000000000')
        )
        const privKey = bsv.PrivateKey.fromRandom(
            bsv.Networks.testnet
        ).toByteString()
        const lamportKeys: LamportKey = fill(privKey, LAMPORT_KEY_SIZE)

        pubKey = lamportKeys.map((pk) => hash160(pk), 16) as LamportKey

        msg = [true, false, true, false, true, false, true, false]

         sig = lamportKeys.slice(0, 8) as LamportSig 
         //msg.map(
        //     (bit, idx) => privKey[bit ? idx : LAMPORT_MSG_BITS + idx]
        // ) as LamportSig

        const leaf = LamportOracle.pubKey2Leaf(pubKey)

        pubKeyProof = fill(
            {
                hash: toByteString('0000000000000000000000000000000000000000'),
                pos: NodePos.Left,
            },
            32
        ) as MerkleProof

        instance = new TestLamportOracle(pubKeyRoot)

        console.log('Script:', instance.lockingScript.toASM())
        console.log('Script len:', instance.lockingScript.toBuffer().length)
        console.log('Script:', instance.lockingScript.toASM())
        console.log('Script len:', instance.lockingScript.toBuffer().length)
        console.log('Public Key:', pubKey)
        console.log('Signature:', sig)
        console.log('Merkle Proof:', pubKeyProof)
    })
    it('should pass oracle sig verify', async () => {
        console.log('Testing with: ', {
            msg,
            sig,
            pubKey,
            pubKeyProof,
        })

        await expect(instance.testVerifyMsg(msg, sig, pubKey, pubKeyProof)).to
            .be.true
    })
})
