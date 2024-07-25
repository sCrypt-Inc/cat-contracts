// @ts-ignore
import btc = require('bitcore-lib-inquisition');
import { Tap } from '@cmdcode/tapscript'  // Requires node >= 19

import * as dotenv from 'dotenv';
dotenv.config();

import { expect, use } from 'chai'
import { TestMath } from '../src/contracts/tests/testMath'
import { Math } from '../src/contracts/math'
import chaiAsPromised from 'chai-as-promised'
import { fetchP2WPKHUtxos } from './utils/txHelper';
import BN from 'bitcore-lib-inquisition/lib/crypto/bn';
use(chaiAsPromised)

function decomposeBigIntTo15BitComponents(bigInt: bigint): { component: number, power: number }[] {
    const components: { component: number, power: number }[] = [];
    const bitSize = 15;
    const maxComponentValue = (1 << bitSize) - 1; // 2^15 - 1
    let currentBigInt = bigInt;
    let power = 0;

    while (currentBigInt > 0) {
        // Get the current 15-bit component
        const component = Number(currentBigInt & BigInt(maxComponentValue));
        components.push({ component, power });
        // Shift right by 15 bits for the next component
        currentBigInt >>= BigInt(bitSize);
        power += bitSize;
    }

    return components.reverse();
}

function reconstructBigIntFrom15BitComponents(components: { component: number, power: number }[]): bigint {
    let bigInt = BigInt(0);
    for (const { component, power } of components) {
        bigInt += BigInt(component) << BigInt(power);
    }
    return bigInt;
}

describe('Test SmartContract `TestMath`', () => {

    let tx0, tx1, cblock, scriptTestMath

    before(async () => {
        await TestMath.loadArtifact()

        const seckey = new btc.PrivateKey(process.env.PRIVATE_KEY, btc.Networks.testnet)
        const pubkey = seckey.toPublicKey()
        const addrP2WPKH = seckey.toAddress(null, btc.Address.PayToWitnessPublicKeyHash)

        const instance = new TestMath()
        scriptTestMath = instance.lockingScript
        const tapleafTestMath = Tap.encodeScript(scriptTestMath.toBuffer())

        const [tpubkeyTestMath, cblockTestMath] = Tap.getPubKey(pubkey.toString(), { target: tapleafTestMath })
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

    it('should pass addU15Carry', async () => {
        if (process.env.NETWORK == 'local') {
            const addTestVectors = [
                {
                    aBuff: Buffer.from('fa00', 'hex'), // 250
                    bBuff: Buffer.from('8b00', 'hex'),  // 139

                    // 389
                    resHiBuff: Buffer.from('', 'hex'),
                    resLoBuff: Buffer.from('8501', 'hex')
                },
                {
                    aBuff: (new BN(decomposeBigIntTo15BitComponents(30000n)[0].component)).toScriptNumBuffer(),
                    bBuff: (new BN(decomposeBigIntTo15BitComponents(25500n)[0].component)).toScriptNumBuffer(),

                    resHiBuff: (new BN(decomposeBigIntTo15BitComponents(30000n + 25500n)[0].component)).toScriptNumBuffer(),
                    resLoBuff: (new BN(decomposeBigIntTo15BitComponents(30000n + 25500n)[1].component)).toScriptNumBuffer()
                },
                {
                    aBuff: (new BN(decomposeBigIntTo15BitComponents(Math.LIM_U15 - 1n)[0].component)).toScriptNumBuffer(),
                    bBuff: (new BN(decomposeBigIntTo15BitComponents(Math.LIM_U15 - 1n)[0].component)).toScriptNumBuffer(),

                    resHiBuff: (new BN(decomposeBigIntTo15BitComponents(2n * (Math.LIM_U15 - 1n))[0].component)).toScriptNumBuffer(),
                    resLoBuff: (new BN(decomposeBigIntTo15BitComponents(2n * (Math.LIM_U15 - 1n))[1].component)).toScriptNumBuffer()
                },
            ]

            for (const addTestVector of addTestVectors) {
                let witnesses = [
                    addTestVector.aBuff,
                    addTestVector.bBuff,
                    addTestVector.resHiBuff,
                    addTestVector.resLoBuff,
                    Buffer.from('', 'hex'), // indicates we're calling first public method
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
        }
    })


    it('should pass subU15Borrow', async () => {
        if (process.env.NETWORK == 'local') {
            const addTestVectors = [
                {
                    aBuff: (new BN(decomposeBigIntTo15BitComponents(332n)[0].component)).toScriptNumBuffer(),
                    bBuff: (new BN(decomposeBigIntTo15BitComponents(21n)[0].component)).toScriptNumBuffer(),

                    resHiBuff: Buffer.from('', 'hex'),
                    resLoBuff: (new BN(decomposeBigIntTo15BitComponents(332n - 21n)[0].component)).toScriptNumBuffer()
                },
                {
                    aBuff: (new BN(decomposeBigIntTo15BitComponents(Math.LIM_U15 - 1n)[0].component)).toScriptNumBuffer(),
                    bBuff: (new BN(decomposeBigIntTo15BitComponents(Math.LIM_U15 - 1n)[0].component)).toScriptNumBuffer(),

                    resHiBuff: Buffer.from('', 'hex'),
                    resLoBuff: Buffer.from('', 'hex')
                },
                {
                    aBuff: (new BN(decomposeBigIntTo15BitComponents(350n)[0].component)).toScriptNumBuffer(),
                    bBuff: (new BN(decomposeBigIntTo15BitComponents(480n)[0].component)).toScriptNumBuffer(),

                    resHiBuff: Buffer.from('01', 'hex'),
                    resLoBuff: (new BN(decomposeBigIntTo15BitComponents(Math.LIM_U15 - 130n)[0].component)).toScriptNumBuffer()
                },
            ]

            for (const addTestVector of addTestVectors) {
                let witnesses = [
                    addTestVector.aBuff,
                    addTestVector.bBuff,
                    addTestVector.resHiBuff,
                    addTestVector.resLoBuff,
                    Buffer.from('01', 'hex'), // indicates we're calling second public method
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
        }
    })


    it('should pass addU30Carry', async () => {
        if (process.env.NETWORK == 'local') {
            const addTestVectors = [
                {
                    aHiBuff: (new BN(decomposeBigIntTo15BitComponents(35000n)[0].component)).toScriptNumBuffer(),
                    aLoBuff: (new BN(decomposeBigIntTo15BitComponents(35000n)[1].component)).toScriptNumBuffer(),
                    bHiBuff: (new BN(decomposeBigIntTo15BitComponents(45500n)[0].component)).toScriptNumBuffer(),
                    bLoBuff: (new BN(decomposeBigIntTo15BitComponents(45500n)[1].component)).toScriptNumBuffer(),

                    resHiHiBuff: Buffer.from('', 'hex'),
                    resHiLoBuff: Buffer.from('', 'hex'),
                    resLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(35000n + 45500n)[0].component)).toScriptNumBuffer(),
                    resLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(35000n + 45500n)[1].component)).toScriptNumBuffer(),
                },
                {
                    aHiBuff: (new BN(decomposeBigIntTo15BitComponents(1000000000n)[0].component)).toScriptNumBuffer(),
                    aLoBuff: (new BN(decomposeBigIntTo15BitComponents(1000000000n)[1].component)).toScriptNumBuffer(),
                    bHiBuff: (new BN(decomposeBigIntTo15BitComponents(359999n)[0].component)).toScriptNumBuffer(),
                    bLoBuff: (new BN(decomposeBigIntTo15BitComponents(359999n)[1].component)).toScriptNumBuffer(),

                    resHiHiBuff: Buffer.from('', 'hex'),
                    resHiLoBuff: Buffer.from('', 'hex'),
                    resLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(1000000000n + 359999n)[0].component)).toScriptNumBuffer(),
                    resLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(1000000000n + 359999n)[1].component)).toScriptNumBuffer(),
                },
                {
                    aHiBuff: (new BN(decomposeBigIntTo15BitComponents(1073741824n - 1n)[0].component)).toScriptNumBuffer(),
                    aLoBuff: (new BN(decomposeBigIntTo15BitComponents(1073741824n - 1n)[1].component)).toScriptNumBuffer(),
                    bHiBuff: (new BN(decomposeBigIntTo15BitComponents(1073741824n - 1n)[0].component)).toScriptNumBuffer(),
                    bLoBuff: (new BN(decomposeBigIntTo15BitComponents(1073741824n - 1n)[1].component)).toScriptNumBuffer(),

                    resHiHiBuff: Buffer.from('', 'hex'),
                    resHiLoBuff: (new BN(decomposeBigIntTo15BitComponents(2n * (1073741824n - 1n))[0].component)).toScriptNumBuffer(),
                    resLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(2n * (1073741824n - 1n))[1].component)).toScriptNumBuffer(),
                    resLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(2n * (1073741824n - 1n))[2].component)).toScriptNumBuffer(),
                },
            ]

            for (const addTestVector of addTestVectors) {
                let witnesses = [
                    addTestVector.aHiBuff,
                    addTestVector.aLoBuff,
                    addTestVector.bHiBuff,
                    addTestVector.bLoBuff,
                    addTestVector.resHiHiBuff,
                    addTestVector.resHiLoBuff,
                    addTestVector.resLoHiBuff,
                    addTestVector.resLoLoBuff,
                    Buffer.from('02', 'hex'),
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
        }
    })

    it('should pass subU30Borrow', async () => {
        if (process.env.NETWORK == 'local') {
            const addTestVectors = [
                {
                    aHiBuff: (new BN(decomposeBigIntTo15BitComponents(40000n)[0].component)).toScriptNumBuffer(),
                    aLoBuff: (new BN(decomposeBigIntTo15BitComponents(40000n)[1].component)).toScriptNumBuffer(),
                    bHiBuff: (new BN(decomposeBigIntTo15BitComponents(33500n)[0].component)).toScriptNumBuffer(),
                    bLoBuff: (new BN(decomposeBigIntTo15BitComponents(33500n)[1].component)).toScriptNumBuffer(),

                    resHiHiBuff: Buffer.from('', 'hex'),
                    resHiLoBuff: Buffer.from('', 'hex'),
                    resLoHiBuff: Buffer.from('', 'hex'),
                    resLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(40000n - 33500n)[0].component)).toScriptNumBuffer(),
                },
                {
                    aHiBuff: (new BN(decomposeBigIntTo15BitComponents(40000n)[0].component)).toScriptNumBuffer(),
                    aLoBuff: (new BN(decomposeBigIntTo15BitComponents(40000n)[1].component)).toScriptNumBuffer(),
                    bHiBuff: (new BN(decomposeBigIntTo15BitComponents(553500n)[0].component)).toScriptNumBuffer(),
                    bLoBuff: (new BN(decomposeBigIntTo15BitComponents(553500n)[1].component)).toScriptNumBuffer(),

                    resHiHiBuff: Buffer.from('', 'hex'),
                    resHiLoBuff: Buffer.from('01', 'hex'),
                    resLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(1073741824n + (40000n - 553500n))[0].component)).toScriptNumBuffer(),
                    resLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(1073741824n + (40000n - 553500n))[1].component)).toScriptNumBuffer(),
                },
                {
                    aHiBuff: (new BN(decomposeBigIntTo15BitComponents(1073741000n)[0].component)).toScriptNumBuffer(),
                    aLoBuff: (new BN(decomposeBigIntTo15BitComponents(1073741000n)[1].component)).toScriptNumBuffer(),
                    bHiBuff: (new BN(decomposeBigIntTo15BitComponents(1073740000n)[0].component)).toScriptNumBuffer(),
                    bLoBuff: (new BN(decomposeBigIntTo15BitComponents(1073740000n)[1].component)).toScriptNumBuffer(),

                    resHiHiBuff: Buffer.from('', 'hex'),
                    resHiLoBuff: Buffer.from('', 'hex'),
                    resLoHiBuff: Buffer.from('', 'hex'),
                    resLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(1073741000n - 1073740000n)[0].component)).toScriptNumBuffer(),
                },
                {
                    aHiBuff: (new BN(decomposeBigIntTo15BitComponents(4279384723n)[0].component)).toScriptNumBuffer(),
                    aLoBuff: (new BN(decomposeBigIntTo15BitComponents(4279384723n)[1].component)).toScriptNumBuffer(),
                    bHiBuff: (new BN(decomposeBigIntTo15BitComponents(2387189371n)[0].component)).toScriptNumBuffer(),
                    bLoBuff: (new BN(decomposeBigIntTo15BitComponents(2387189371n)[1].component)).toScriptNumBuffer(),

                    resHiHiBuff: Buffer.from('', 'hex'),
                    resHiLoBuff: Buffer.from('', 'hex'),
                    resLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(4279384723n - 2387189371n)[0].component)).toScriptNumBuffer(),
                    resLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(4279384723n - 2387189371n)[1].component)).toScriptNumBuffer(),
                },
            ]

            for (const addTestVector of addTestVectors) {
                let witnesses = [
                    addTestVector.aHiBuff,
                    addTestVector.aLoBuff,
                    addTestVector.bHiBuff,
                    addTestVector.bLoBuff,
                    addTestVector.resHiHiBuff,
                    addTestVector.resHiLoBuff,
                    addTestVector.resLoHiBuff,
                    addTestVector.resLoLoBuff,
                    Buffer.from('03', 'hex'),
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
        }
    })

    it('should pass addU60Carry', async () => {
        if (process.env.NETWORK == 'local') {
            const addTestVectors = [
                {
                    aHiHiBuff: Buffer.from('', 'hex'),
                    aHiLoBuff: Buffer.from('', 'hex'),
                    aLoHiBuff: Buffer.from('', 'hex'),
                    aLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(3500n)[0].component)).toScriptNumBuffer(),

                    bHiHiBuff: Buffer.from('', 'hex'),
                    bHiLoBuff: Buffer.from('', 'hex'),
                    bLoHiBuff: Buffer.from('', 'hex'),
                    bLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(1234n)[0].component)).toScriptNumBuffer(),

                    resHiHiHiBuff: Buffer.from('', 'hex'),
                    resHiHiLoBuff: Buffer.from('', 'hex'),
                    resHiLoHiBuff: Buffer.from('', 'hex'),
                    resHiLoLoBuff: Buffer.from('', 'hex'),
                    resLoHiHiBuff: Buffer.from('', 'hex'),
                    resLoHiLoBuff: Buffer.from('', 'hex'),
                    resLoLoHiBuff: Buffer.from('', 'hex'),
                    resLoLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(3500n + 1234n)[0].component)).toScriptNumBuffer(),
                },
                {
                    aHiHiBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n)[0].component)).toScriptNumBuffer(),
                    aHiLoBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n)[1].component)).toScriptNumBuffer(),
                    aLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n)[2].component)).toScriptNumBuffer(),
                    aLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n)[3].component)).toScriptNumBuffer(),

                    bHiHiBuff: (new BN(decomposeBigIntTo15BitComponents(999921504606846012n)[0].component)).toScriptNumBuffer(),
                    bHiLoBuff: (new BN(decomposeBigIntTo15BitComponents(999921504606846012n)[1].component)).toScriptNumBuffer(),
                    bLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(999921504606846012n)[2].component)).toScriptNumBuffer(),
                    bLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(999921504606846012n)[3].component)).toScriptNumBuffer(),

                    resHiHiHiBuff: Buffer.from('', 'hex'),
                    resHiHiLoBuff: Buffer.from('', 'hex'),
                    resHiLoHiBuff: Buffer.from('', 'hex'),
                    resHiLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n + 999921504606846012n)[0].component)).toScriptNumBuffer(),
                    resLoHiHiBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n + 999921504606846012n)[1].component)).toScriptNumBuffer(),
                    resLoHiLoBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n + 999921504606846012n)[2].component)).toScriptNumBuffer(),
                    resLoLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n + 999921504606846012n)[3].component)).toScriptNumBuffer(),
                    resLoLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n + 999921504606846012n)[4].component)).toScriptNumBuffer(),
                },
            ]

            for (const addTestVector of addTestVectors) {
                let witnesses = [
                    addTestVector.aHiHiBuff,
                    addTestVector.aHiLoBuff,
                    addTestVector.aLoHiBuff,
                    addTestVector.aLoLoBuff,

                    addTestVector.bHiHiBuff,
                    addTestVector.bHiLoBuff,
                    addTestVector.bLoHiBuff,
                    addTestVector.bLoLoBuff,

                    addTestVector.resHiHiHiBuff,
                    addTestVector.resHiHiLoBuff,
                    addTestVector.resHiLoHiBuff,
                    addTestVector.resHiLoLoBuff,
                    addTestVector.resLoHiHiBuff,
                    addTestVector.resLoHiLoBuff,
                    addTestVector.resLoLoHiBuff,
                    addTestVector.resLoLoLoBuff,
                    Buffer.from('04', 'hex'),
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
        }
    })

    it('should pass subU60Borrow', async () => {
        if (process.env.NETWORK == 'local') {
            const addTestVectors = [
                {
                    aHiHiBuff: Buffer.from('', 'hex'),
                    aHiLoBuff: Buffer.from('', 'hex'),
                    aLoHiBuff: Buffer.from('', 'hex'),
                    aLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(3500n)[0].component)).toScriptNumBuffer(),

                    bHiHiBuff: Buffer.from('', 'hex'),
                    bHiLoBuff: Buffer.from('', 'hex'),
                    bLoHiBuff: Buffer.from('', 'hex'),
                    bLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(1234n)[0].component)).toScriptNumBuffer(),

                    resHiHiHiBuff: Buffer.from('', 'hex'),
                    resHiHiLoBuff: Buffer.from('', 'hex'),
                    resHiLoHiBuff: Buffer.from('', 'hex'),
                    resHiLoLoBuff: Buffer.from('', 'hex'),
                    resLoHiHiBuff: Buffer.from('', 'hex'),
                    resLoHiLoBuff: Buffer.from('', 'hex'),
                    resLoLoHiBuff: Buffer.from('', 'hex'),
                    resLoLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(3500n - 1234n)[0].component)).toScriptNumBuffer(),
                },
                {
                    aHiHiBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n)[0].component)).toScriptNumBuffer(),
                    aHiLoBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n)[1].component)).toScriptNumBuffer(),
                    aLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n)[2].component)).toScriptNumBuffer(),
                    aLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n)[3].component)).toScriptNumBuffer(),

                    bHiHiBuff: (new BN(decomposeBigIntTo15BitComponents(999921504606846012n)[0].component)).toScriptNumBuffer(),
                    bHiLoBuff: (new BN(decomposeBigIntTo15BitComponents(999921504606846012n)[1].component)).toScriptNumBuffer(),
                    bLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(999921504606846012n)[2].component)).toScriptNumBuffer(),
                    bLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(999921504606846012n)[3].component)).toScriptNumBuffer(),

                    resHiHiHiBuff: Buffer.from('', 'hex'),
                    resHiHiLoBuff: Buffer.from('', 'hex'),
                    resHiLoHiBuff: Buffer.from('', 'hex'),
                    resHiLoLoBuff: Buffer.from('', 'hex'),
                    resLoHiHiBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n - 999921504606846012n)[0].component)).toScriptNumBuffer(),
                    resLoHiLoBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n - 999921504606846012n)[1].component)).toScriptNumBuffer(),
                    resLoLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n - 999921504606846012n)[2].component)).toScriptNumBuffer(),
                    resLoLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n - 999921504606846012n)[3].component)).toScriptNumBuffer(),
                },
                {
                    aHiHiBuff: (new BN(decomposeBigIntTo15BitComponents(999921504606846012n)[0].component)).toScriptNumBuffer(),
                    aHiLoBuff: (new BN(decomposeBigIntTo15BitComponents(999921504606846012n)[1].component)).toScriptNumBuffer(),
                    aLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(999921504606846012n)[2].component)).toScriptNumBuffer(),
                    aLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(999921504606846012n)[3].component)).toScriptNumBuffer(),

                    bHiHiBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n)[0].component)).toScriptNumBuffer(),
                    bHiLoBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n)[1].component)).toScriptNumBuffer(),
                    bLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n)[2].component)).toScriptNumBuffer(),
                    bLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846000n)[3].component)).toScriptNumBuffer(),

                    resHiHiHiBuff: Buffer.from('', 'hex'),
                    resHiHiLoBuff: Buffer.from('', 'hex'),
                    resHiLoHiBuff: Buffer.from('', 'hex'),
                    resHiLoLoBuff: Buffer.from('01', 'hex'),
                    resLoHiHiBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846976n + (999921504606846012n - 1152921504606846000n))[0].component)).toScriptNumBuffer(),
                    resLoHiLoBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846976n + (999921504606846012n - 1152921504606846000n))[1].component)).toScriptNumBuffer(),
                    resLoLoHiBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846976n + (999921504606846012n - 1152921504606846000n))[2].component)).toScriptNumBuffer(),
                    resLoLoLoBuff: (new BN(decomposeBigIntTo15BitComponents(1152921504606846976n + (999921504606846012n - 1152921504606846000n))[3].component)).toScriptNumBuffer(),
                },
            ]

            for (const addTestVector of addTestVectors) {
                let witnesses = [
                    addTestVector.aHiHiBuff,
                    addTestVector.aHiLoBuff,
                    addTestVector.aLoHiBuff,
                    addTestVector.aLoLoBuff,

                    addTestVector.bHiHiBuff,
                    addTestVector.bHiLoBuff,
                    addTestVector.bLoHiBuff,
                    addTestVector.bLoLoBuff,

                    addTestVector.resHiHiHiBuff,
                    addTestVector.resHiHiLoBuff,
                    addTestVector.resHiLoHiBuff,
                    addTestVector.resHiLoLoBuff,
                    addTestVector.resLoHiHiBuff,
                    addTestVector.resLoHiLoBuff,
                    addTestVector.resLoLoHiBuff,
                    addTestVector.resLoLoLoBuff,
                    Buffer.from('05', 'hex'),
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

        }
    })

})
