// @ts-ignore
import btc = require('bitcore-lib-inquisition');
import { Tap } from '@cmdcode/tapscript'  // Requires node >= 19

import * as dotenv from 'dotenv';
dotenv.config();

import { expect, use } from 'chai'
import { TestMathOptimU60 } from '../src/contracts/tests/testMathOptimU60'
import { MathOptimU60 } from '../src/contracts/mathOptimU60'
import chaiAsPromised from 'chai-as-promised'
import { DISABLE_KEYSPEND_PUBKEY, fetchP2WPKHUtxos } from './utils/txHelper';
import BN from 'bitcore-lib-inquisition/lib/crypto/bn';
use(chaiAsPromised)

function decomposeBigIntTo30BitComponents(bigInt: bigint): { component: number, power: number }[] {
    const components: { component: number, power: number }[] = [];
    const bitSize = 30;
    const maxComponentValue = (1 << bitSize) - 1; // 2^30 - 1
    let currentBigInt = bigInt;
    let power = 0;

    while (currentBigInt > 0) {
        // Get the current 30-bit component
        const component = Number(currentBigInt & BigInt(maxComponentValue));
        components.push({ component, power });
        // Shift right by 30 bits for the next component
        currentBigInt >>= BigInt(bitSize);
        power += bitSize;
    }

    return components.reverse();
}

function reconstructBigIntFromComponents(components: { component: number, power: number }[]): bigint {
    let bigInt = BigInt(0);
    for (const { component, power } of components) {
        bigInt += BigInt(component) << BigInt(power);
    }
    return bigInt;
}

describe('Test SmartContract `TestMathOptimU60`', () => {

    let tx0, tx1, cblock, scriptTestMath

    before(async () => {
        await TestMathOptimU60.loadArtifact()

        const seckey = new btc.PrivateKey(process.env.PRIVATE_KEY, btc.Networks.testnet)
        const pubkey = seckey.toPublicKey()
        const addrP2WPKH = seckey.toAddress(null, btc.Address.PayToWitnessPublicKeyHash)

        const instance = new TestMathOptimU60()
        scriptTestMath = instance.lockingScript
        const tapleafTestMath = Tap.encodeScript(scriptTestMath.toBuffer())

        const [tpubkeyTestMath, cblockTestMath] = Tap.getPubKey(DISABLE_KEYSPEND_PUBKEY, { target: tapleafTestMath })
        cblock = cblockTestMath
        const scriptTestMathP2TR = new btc.Script(`OP_1 32 0x${tpubkeyTestMath}}`)

        //////// Create fee outputs
        let utxos = await fetchP2WPKHUtxos(addrP2WPKH)
        if (utxos.length === 0) {
            throw new Error(`No UTXO's for address: ${addrP2WPKH.toString()}`)
        }
        console.log(utxos)

        const txFee = new btc.Transaction()
            .from(utxos)
            .to(addrP2WPKH, 3500)
            .to(addrP2WPKH, 3500)
            .change(addrP2WPKH)
            .feePerByte(2)
            .sign(seckey)

        ///// CONTRACT DEPLOY

        const feeUTXODeploy = {
            address: addrP2WPKH.toString(),
            txId: txFee.id,
            outputIndex: 0,
            script: new btc.Script(addrP2WPKH),
            satoshis: txFee.outputs[0].satoshis
        }

        tx0 = new btc.Transaction()
            .from([feeUTXODeploy])
            .addOutput(new btc.Transaction.Output({
                satoshis: 546,
                script: scriptTestMathP2TR
            }))
            .sign(seckey)

        ///// UNLOCK CALL

        const utxoTestMathP2TR = {
            txId: tx0.id,
            outputIndex: 0,
            script: scriptTestMathP2TR,
            satoshis: tx0.outputs[0].satoshis
        };

        const feeUTXO = {
            address: addrP2WPKH.toString(),
            txId: txFee.id,
            outputIndex: 1,
            script: new btc.Script(addrP2WPKH),
            satoshis: txFee.outputs[1].satoshis
        }

        tx1 = new btc.Transaction()
            .from([utxoTestMathP2TR, feeUTXO])
            .addOutput(tx0.outputs[0])

        // Sign fee input
        let hashData = btc.crypto.Hash.sha256ripemd160(seckey.publicKey.toBuffer());
        let signatures = tx1.inputs[1].getSignatures(tx1, seckey, 1, undefined, hashData, undefined, undefined)
        tx1.inputs[1].addSignature(tx1, signatures[0])
    })

    it('should pass addU60', async () => {
        if (process.env.NETWORK == 'local') {
            const addTestVectors = [
                {
                    aHiBuff: Buffer.from('', 'hex'),
                    aLoBuff: (new BN(decomposeBigIntTo30BitComponents(3500n)[0].component)).toScriptNumBuffer(),

                    bHiBuff: Buffer.from('', 'hex'),
                    bLoBuff: (new BN(decomposeBigIntTo30BitComponents(1234n)[0].component)).toScriptNumBuffer(),

                    resHiBuff: Buffer.from('', 'hex'),
                    resLoBuff: (new BN(decomposeBigIntTo30BitComponents(3500n + 1234n)[0].component)).toScriptNumBuffer(),
                },
                {
                    aHiBuff: (new BN(decomposeBigIntTo30BitComponents(152920504606846000n)[0].component)).toScriptNumBuffer(),
                    aLoBuff: (new BN(decomposeBigIntTo30BitComponents(152920504606846000n)[1].component)).toScriptNumBuffer(),

                    bHiBuff: (new BN(decomposeBigIntTo30BitComponents(999921504606846012n)[0].component)).toScriptNumBuffer(),
                    bLoBuff: (new BN(decomposeBigIntTo30BitComponents(999921504606846012n)[1].component)).toScriptNumBuffer(),

                    resHiBuff: (new BN(decomposeBigIntTo30BitComponents(152920504606846000n + 999921504606846012n)[0].component)).toScriptNumBuffer(),
                    resLoBuff: (new BN(decomposeBigIntTo30BitComponents(152920504606846000n + 999921504606846012n)[1].component)).toScriptNumBuffer(),
                },
            ]

            for (const addTestVector of addTestVectors) {
                let witnesses = [
                    addTestVector.aHiBuff,
                    addTestVector.aLoBuff,

                    addTestVector.bHiBuff,
                    addTestVector.bLoBuff,

                    addTestVector.resHiBuff,
                    addTestVector.resLoBuff,
                    Buffer.from('', 'hex'),
                    scriptTestMath.toBuffer(),
                    Buffer.from(cblock, 'hex')
                ]
                tx1.inputs[0].witnesses = witnesses

                // Run locally
                let interpreter = new btc.Script.Interpreter()
                let flags = btc.Script.Interpreter.SCRIPT_VERIFY_WITNESS | btc.Script.Interpreter.SCRIPT_VERIFY_TAPROOT
                let res = interpreter.verify(new btc.Script(''), tx0.outputs[0].script, tx1, 0, flags, witnesses, tx0.outputs[0].satoshis)
                expect(res).to.be.true
            }
            
            const addTestVectorsInvalid = [
                {
                    aHiBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846000n)[0].component)).toScriptNumBuffer(),
                    aLoBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846000n)[1].component)).toScriptNumBuffer(),

                    bHiBuff: (new BN(decomposeBigIntTo30BitComponents(999921504706846012n)[0].component)).toScriptNumBuffer(),
                    bLoBuff: (new BN(decomposeBigIntTo30BitComponents(999921504706846012n)[1].component)).toScriptNumBuffer(),

                    resHiBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846000n + 999921504706846012n)[1].component)).toScriptNumBuffer(),
                    resLoBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846000n + 999921504706846012n)[2].component)).toScriptNumBuffer(),
                },
            ]

            for (const addTestVectorInvalid of addTestVectorsInvalid) {
                let witnesses = [
                    addTestVectorInvalid.aHiBuff,
                    addTestVectorInvalid.aLoBuff,

                    addTestVectorInvalid.bHiBuff,
                    addTestVectorInvalid.bLoBuff,

                    addTestVectorInvalid.resHiBuff,
                    addTestVectorInvalid.resLoBuff,
                    Buffer.from('', 'hex'),
                    scriptTestMath.toBuffer(),
                    Buffer.from(cblock, 'hex')
                ]
                tx1.inputs[0].witnesses = witnesses

                // Run locally
                let interpreter = new btc.Script.Interpreter()
                let flags = btc.Script.Interpreter.SCRIPT_VERIFY_WITNESS | btc.Script.Interpreter.SCRIPT_VERIFY_TAPROOT
                let res = interpreter.verify(new btc.Script(''), tx0.outputs[0].script, tx1, 0, flags, witnesses, tx0.outputs[0].satoshis)
                expect(res).to.be.false
            }
        }
    })
    
    it('should pass subU60', async () => {
        if (process.env.NETWORK == 'local') {
            const subTestVectors = [
                {
                    aHiBuff: Buffer.from('', 'hex'),
                    aLoBuff: (new BN(decomposeBigIntTo30BitComponents(3500n)[0].component)).toScriptNumBuffer(),

                    bHiBuff: Buffer.from('', 'hex'),
                    bLoBuff: (new BN(decomposeBigIntTo30BitComponents(1234n)[0].component)).toScriptNumBuffer(),

                    resHiBuff: Buffer.from('', 'hex'),
                    resLoBuff: (new BN(decomposeBigIntTo30BitComponents(3500n - 1234n)[0].component)).toScriptNumBuffer(),
                },
                {
                    aHiBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846000n)[0].component)).toScriptNumBuffer(),
                    aLoBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846000n)[1].component)).toScriptNumBuffer(),

                    bHiBuff: (new BN(decomposeBigIntTo30BitComponents(999921504606846012n)[0].component)).toScriptNumBuffer(),
                    bLoBuff: (new BN(decomposeBigIntTo30BitComponents(999921504606846012n)[1].component)).toScriptNumBuffer(),

                    resHiBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846000n - 999921504606846012n)[0].component)).toScriptNumBuffer(),
                    resLoBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846000n - 999921504606846012n)[1].component)).toScriptNumBuffer(),
                },
            ]

            for (const subTestVector of subTestVectors) {
                let witnesses = [
                    subTestVector.aHiBuff,
                    subTestVector.aLoBuff,

                    subTestVector.bHiBuff,
                    subTestVector.bLoBuff,

                    subTestVector.resHiBuff,
                    subTestVector.resLoBuff,
                    Buffer.from('01', 'hex'),
                    scriptTestMath.toBuffer(),
                    Buffer.from(cblock, 'hex')
                ]
                tx1.inputs[0].witnesses = witnesses

                // Run locally
                let interpreter = new btc.Script.Interpreter()
                let flags = btc.Script.Interpreter.SCRIPT_VERIFY_WITNESS | btc.Script.Interpreter.SCRIPT_VERIFY_TAPROOT
                let res = interpreter.verify(new btc.Script(''), tx0.outputs[0].script, tx1, 0, flags, witnesses, tx0.outputs[0].satoshis)
                expect(res).to.be.true
            }
            
            const subTestVectorsInvalid = [
                {
                    aHiBuff: Buffer.from('', 'hex'),
                    aLoBuff: (new BN(decomposeBigIntTo30BitComponents(1234n)[0].component)).toScriptNumBuffer(),

                    bHiBuff: Buffer.from('', 'hex'),
                    bLoBuff: (new BN(decomposeBigIntTo30BitComponents(3500n)[0].component)).toScriptNumBuffer(),

                    resHiBuff: Buffer.from('', 'hex'),
                    resLoBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846976n + (1234n - 3500n))[0].component)).toScriptNumBuffer(),
                },
                {
                    aHiBuff: Buffer.from('', 'hex'),
                    aLoBuff: (new BN(decomposeBigIntTo30BitComponents(1234n)[0].component)).toScriptNumBuffer(),

                    bHiBuff: Buffer.from('', 'hex'),
                    bLoBuff: (new BN(decomposeBigIntTo30BitComponents(3500n)[0].component)).toScriptNumBuffer(),

                    resHiBuff: Buffer.from('', 'hex'),
                    resLoBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846976n + (1234n - 3500n))[0].component)).toScriptNumBuffer(),
                },
                {
                    aHiBuff: (new BN(decomposeBigIntTo30BitComponents(999921504606846012n)[0].component)).toScriptNumBuffer(),
                    aLoBuff: (new BN(decomposeBigIntTo30BitComponents(999921504606846012n)[1].component)).toScriptNumBuffer(),

                    bHiBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846000n)[0].component)).toScriptNumBuffer(),
                    bLoBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846000n)[1].component)).toScriptNumBuffer(),

                    resHiBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846976n + (999921504606846012n - 1152921504606846000n))[0].component)).toScriptNumBuffer(),
                    resLoBuff: (new BN(decomposeBigIntTo30BitComponents(1152921504606846976n + (999921504606846012n - 1152921504606846000n))[1].component)).toScriptNumBuffer(),
                },
            ]

            for (const subTestVectorInvalid of subTestVectorsInvalid) {
                let witnesses = [
                    subTestVectorInvalid.aHiBuff,
                    subTestVectorInvalid.aLoBuff,

                    subTestVectorInvalid.bHiBuff,
                    subTestVectorInvalid.bLoBuff,

                    subTestVectorInvalid.resHiBuff,
                    subTestVectorInvalid.resLoBuff,
                    Buffer.from('01', 'hex'),
                    scriptTestMath.toBuffer(),
                    Buffer.from(cblock, 'hex')
                ]
                tx1.inputs[0].witnesses = witnesses

                // Run locally
                let interpreter = new btc.Script.Interpreter()
                let flags = btc.Script.Interpreter.SCRIPT_VERIFY_WITNESS | btc.Script.Interpreter.SCRIPT_VERIFY_TAPROOT
                let res = interpreter.verify(new btc.Script(''), tx0.outputs[0].script, tx1, 0, flags, witnesses, tx0.outputs[0].satoshis)
                expect(res).to.be.false
            }
        }
    })

})
