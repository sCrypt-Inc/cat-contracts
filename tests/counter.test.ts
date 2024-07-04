// @ts-ignore
import btc = require('bitcore-lib-inquisition');
import axios from 'axios';
import { Tap } from '@cmdcode/tapscript'  // Requires node >= 19
import * as ecurve from 'ecurve';
import { sha256 } from 'js-sha256';
// @ts-ignore
import BigInteger = require('bigi')

import * as dotenv from 'dotenv';
dotenv.config();

import { expect, use } from 'chai'
import { Counter } from '../src/contracts/counter'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

const curve = ecurve.getCurveByName('secp256k1');

async function fetchP2WPKHUtxos(address: btc.Address): Promise<any[]> {
    const url = `https://explorer.bc-2.jp/api/address/${address.toString()}/utxo`;

    let res: any[] = []
    try {
        // Make a GET request to the URL using axios
        const response = await axios.get(url, {
            timeout: 10000
        });

        if (response.data) {
            for (let i = 0; i < response.data.length; i++) {
                const e = response.data[i]
                const utxo = {
                    address: address.toString(),
                    txId: e.txid,
                    outputIndex: e.vout,
                    script: new btc.Script(address),
                    satoshis: e.value
                };
                res.push(utxo)
            }
        }
    } catch (error) { // Handle any errors that occurred during the request
        console.error('Failed to fetch data:', error);
    }
    return res
}

function hashSHA256(buff: Buffer | string) {
    return Buffer.from(sha256.create().update(buff).array());
}

function getSigHashSchnorr(
    transaction: btc.Transaction,
    tapleafHash: Buffer,
    inputIndex = 0,
    sigHashType = 0x00
) {
    //const sighash = btc.Transaction.Sighash.sighash(transaction, sigHashType, inputIndex, subscript);
    const execdata = {
        annexPresent: false,
        annexInit: true,
        tapleafHash: tapleafHash,
        tapleafHashInit: true,
        ////validationWeightLeft: 110,
        ////validationWeightLeftInit: true,
        codeseparatorPos: new btc.crypto.BN(4294967295),
        codeseparatorPosInit: true,
    }
    
    return {
        preimage: btc.Transaction.SighashSchnorr.sighashPreimage(transaction, sigHashType, inputIndex, 3, execdata),
        hash: btc.Transaction.SighashSchnorr.sighash(transaction, sigHashType, inputIndex, 3, execdata)
    }
}


function getE(
    sighash: Buffer
) {
    const Gx = curve.G.affineX.toBuffer(32);

    const tagHash = hashSHA256('BIP0340/challenge')
    const tagHashMsg = Buffer.concat([Gx, Gx, sighash])
    const taggedHash = hashSHA256(Buffer.concat([tagHash, tagHash, tagHashMsg]))

    return BigInteger.fromBuffer(taggedHash).mod(curve.n);
}

function splitSighashPreimage(preimage: Buffer) {
    return {
        tapSighash1: preimage.slice(0, 32),
        tapSighash2: preimage.slice(32, 64),
        epoch: preimage.slice(64, 65),
        sighashType: preimage.slice(65, 66),
        txVersion: preimage.slice(66, 70),
        nLockTime: preimage.slice(70, 74),
        hashPrevouts: preimage.slice(74, 106),
        hashSpentAmounts: preimage.slice(106, 138),
        hashScripts: preimage.slice(138, 170),
        hashSequences: preimage.slice(170, 202),
        hashOutputs: preimage.slice(202, 234),
        spendType: preimage.slice(234, 235),
        inputNumber: preimage.slice(235, 239),
        tapleafHash: preimage.slice(239, 271),
        keyVersion: preimage.slice(271, 272),
        codeseparatorPosition: preimage.slice(272)
    };
}


describe('Test SmartContract `Counter`', () => {

    before(async () => {
        await Counter.loadArtifact()
    })

    it('should pass', async () => {
        const seckey = new btc.PrivateKey(process.env.PRIVATE_KEY, btc.Networks.testnet)
        const pubkey = seckey.toPublicKey()
        const addrP2WPKH = seckey.toAddress(null, btc.Address.PayToWitnessPublicKeyHash)

        const instance = new Counter()
        const scriptCounter = instance.lockingScript
        const tapleafCounter = Tap.encodeScript(scriptCounter.toBuffer())
        
        const [tpubkeyCounter, cblockCounter] = Tap.getPubKey(pubkey.toString(), { target: tapleafCounter })
        const scriptCounterP2TR = new btc.Script(`OP_1 32 0x${tpubkeyCounter}}`)
        
        //////// Create fee outputs
        const feeAmtBuff = Buffer.alloc(8)
        feeAmtBuff.writeBigInt64LE(3500n)

        let utxos = await fetchP2WPKHUtxos(addrP2WPKH)
        if (utxos.length === 0){
            throw new Error(`No UTXO's for address: ${addrP2WPKH.toString()}`) 
        }
        console.log(utxos)

        const txFee = new btc.Transaction()
            .from(utxos)
            .to(addrP2WPKH, 1000)
            .to(addrP2WPKH, 1000)
            .to(addrP2WPKH, 3500)
            .to(addrP2WPKH, 3500)
            .change(addrP2WPKH)
            .feePerByte(2)
            .sign(seckey)

        console.log('txFee (serialized):', txFee.uncheckedSerialize())


        ///// CONTRACT DEPLOY
        
        const feeUTXODeploy = {
            address: addrP2WPKH.toString(),
            txId: txFee.id,
            outputIndex: 0,
            script: new btc.Script(addrP2WPKH),
            satoshis: txFee.outputs[0].satoshis
        }

        const feeUTXODeploy2 = {
            address: addrP2WPKH.toString(),
            txId: txFee.id,
            outputIndex: 1,
            script: new btc.Script(addrP2WPKH),
            satoshis: txFee.outputs[1].satoshis
        }
        
        const opRetScript0 = new btc.Script('6a0100')

        const tx0 = new btc.Transaction()
            .from([feeUTXODeploy, feeUTXODeploy2])
            .addOutput(new btc.Transaction.Output({
                satoshis: 546,
                script: scriptCounterP2TR
            }))
            .addOutput(new btc.Transaction.Output({
                satoshis: 0,
                script: opRetScript0
            }))
            .sign(seckey)
        const counterAmtBuff = Buffer.alloc(8)
        counterAmtBuff.writeBigInt64LE(546n)

        console.log('tx0 (serialized):', tx0.uncheckedSerialize())

        //////// FIRST ITERATION

        const utxoCounterP2TR = {
            txId: tx0.id,
            outputIndex: 0,
            script: scriptCounterP2TR,
            satoshis: tx0.outputs[0].satoshis
        };

        const feeUTXO = {
            address: addrP2WPKH.toString(),
            txId: txFee.id,
            outputIndex: 2,
            script: new btc.Script(addrP2WPKH),
            satoshis: txFee.outputs[2].satoshis
        }

        const opRetScript1 = new btc.Script('6a0101')
        const tx1 = new btc.Transaction()
            .from([utxoCounterP2TR, feeUTXO])
            .addOutput(tx0.outputs[0])
            .addOutput(new btc.Transaction.Output({
                satoshis: 0,
                script: opRetScript1
            }))

        // Mutate tx1 until e ends with 0x01.
        let e, eBuff, sighash;
        while (true) {
            sighash = getSigHashSchnorr(tx1, Buffer.from(tapleafCounter, 'hex'), 0)
            e = await getE(sighash.hash)
            eBuff = e.toBuffer(32)
            const eLastByte = eBuff[eBuff.length - 1]
            if (eLastByte == 1) {
                break;
            }
            tx1.nLockTime += 1
        }


        let _e = eBuff.slice(0, eBuff.length - 1) // e' - e without last byte
        let preimageParts = splitSighashPreimage(sighash.preimage)

        let sig = btc.crypto.Schnorr.sign(seckey, sighash.hash);

        // Also sign fee input
        let hashData = btc.crypto.Hash.sha256ripemd160(seckey.publicKey.toBuffer());
        let signatures = tx1.inputs[1].getSignatures(tx1, seckey, 1, undefined, hashData, undefined, undefined)
        tx1.inputs[1].addSignature(tx1, signatures[0])

        let prevTxVer = Buffer.alloc(4)
        prevTxVer.writeUInt32LE(tx0.version)

        let prevTxLocktime = Buffer.alloc(4)
        prevTxLocktime.writeUInt32LE(tx0.nLockTime)
        
        // In the first iteration we can just pass the fee input as the prev tx contract input...
        let prevTxInputContract = new btc.encoding.BufferWriter()
        prevTxInputContract.writeVarintNum(tx0.inputs.length)
        tx0.inputs[0].toBufferWriter(prevTxInputContract);
        let prevTxInputFee = new btc.encoding.BufferWriter()
        tx0.inputs[1].toBufferWriter(prevTxInputFee);

        let feePrevout = new btc.encoding.BufferWriter()
        feePrevout.writeReverse(tx1.inputs[1].prevTxId);
        feePrevout.writeInt32LE(tx1.inputs[1].outputIndex);

        let witnesses = [
            preimageParts.txVersion,
            preimageParts.nLockTime,
            preimageParts.hashPrevouts,
            preimageParts.hashSpentAmounts,
            preimageParts.hashScripts,
            preimageParts.hashSequences,
            preimageParts.hashOutputs,
            preimageParts.spendType,
            preimageParts.inputNumber,
            preimageParts.tapleafHash,
            preimageParts.keyVersion,
            preimageParts.codeseparatorPosition,
            sighash.hash,
            _e,
            prevTxVer,
            prevTxLocktime,
            prevTxInputContract.toBuffer(),
            prevTxInputFee.toBuffer(),
            feePrevout.toBuffer(),
            Buffer.concat([Buffer.from('22', 'hex'), scriptCounterP2TR.toBuffer()]),
            counterAmtBuff,
            counterAmtBuff,
            Buffer.from('', 'hex'), // OP_0
            scriptCounter.toBuffer(),
            Buffer.from(cblockCounter, 'hex')
        ]
        tx1.inputs[0].witnesses = witnesses
        
        console.log('tx1 (serialized):', tx1.uncheckedSerialize())

        // Run locally
        let interpreter = new btc.Script.Interpreter()
        let flags = btc.Script.Interpreter.SCRIPT_VERIFY_WITNESS | btc.Script.Interpreter.SCRIPT_VERIFY_TAPROOT
        let res = interpreter.verify(new btc.Script(''), tx0.outputs[0].script, tx1, 0, flags, witnesses, tx0.outputs[0].satoshis)
        expect(res).to.be.true
        
        //////// SECOND ITERATION

        const utxoCounterP2TR2 = {
            txId: tx1.id,
            outputIndex: 0,
            script: scriptCounterP2TR,
            satoshis: tx1.outputs[0].satoshis
        };

        const feeUTXO2 = {
            address: addrP2WPKH.toString(),
            txId: txFee.id,
            outputIndex: 3,
            script: new btc.Script(addrP2WPKH),
            satoshis: txFee.outputs[3].satoshis
        }

        const opRetScript2 = new btc.Script('6a0102')
        const tx2 = new btc.Transaction()
            .from([utxoCounterP2TR2, feeUTXO2])
            .addOutput(tx1.outputs[0])
            .addOutput(new btc.Transaction.Output({
                satoshis: 0,
                script: opRetScript2
            }))

        // Mutate tx2 until e ends with 0x01.
        while (true) {
            sighash = getSigHashSchnorr(tx2, Buffer.from(tapleafCounter, 'hex'), 0)
            e = await getE(sighash.hash)
            eBuff = e.toBuffer(32)
            const eLastByte = eBuff[eBuff.length - 1]
            if (eLastByte == 1) {
                break;
            }
            tx2.nLockTime += 1
        }

        _e = eBuff.slice(0, eBuff.length - 1) // e' - e without last byte
        preimageParts = splitSighashPreimage(sighash.preimage)

        sig = btc.crypto.Schnorr.sign(seckey, sighash.hash);

        // Also sign fee input
        hashData = btc.crypto.Hash.sha256ripemd160(seckey.publicKey.toBuffer());
        signatures = tx2.inputs[1].getSignatures(tx2, seckey, 1, undefined, hashData, undefined, undefined)
        tx2.inputs[1].addSignature(tx2, signatures[0])

        prevTxVer = Buffer.alloc(4)
        prevTxVer.writeUInt32LE(tx1.version)

        prevTxLocktime = Buffer.alloc(4)
        prevTxLocktime.writeUInt32LE(tx1.nLockTime)
        
        // In the first iteration we can just pass the fee input as the prev tx contract input...
        prevTxInputContract = new btc.encoding.BufferWriter()
        prevTxInputContract.writeVarintNum(tx1.inputs.length)
        tx1.inputs[0].toBufferWriter(prevTxInputContract);
        prevTxInputFee = new btc.encoding.BufferWriter()
        tx1.inputs[1].toBufferWriter(prevTxInputFee);

        feePrevout = new btc.encoding.BufferWriter()
        feePrevout.writeReverse(tx2.inputs[1].prevTxId);
        feePrevout.writeInt32LE(tx2.inputs[1].outputIndex);

        witnesses = [
            preimageParts.txVersion,
            preimageParts.nLockTime,
            preimageParts.hashPrevouts,
            preimageParts.hashSpentAmounts,
            preimageParts.hashScripts,
            preimageParts.hashSequences,
            preimageParts.hashOutputs,
            preimageParts.spendType,
            preimageParts.inputNumber,
            preimageParts.tapleafHash,
            preimageParts.keyVersion,
            preimageParts.codeseparatorPosition,
            sighash.hash,
            _e,
            prevTxVer,
            prevTxLocktime,
            prevTxInputContract.toBuffer(),
            prevTxInputFee.toBuffer(),
            feePrevout.toBuffer(),
            Buffer.concat([Buffer.from('22', 'hex'), scriptCounterP2TR.toBuffer()]),
            counterAmtBuff,
            counterAmtBuff,
            Buffer.from('01', 'hex'), // OP_1
            scriptCounter.toBuffer(),
            Buffer.from(cblockCounter, 'hex')
        ]
        tx2.inputs[0].witnesses = witnesses
        
        console.log('tx2 (serialized):', tx2.uncheckedSerialize())

        // Run locally
        interpreter = new btc.Script.Interpreter()
        flags = btc.Script.Interpreter.SCRIPT_VERIFY_WITNESS | btc.Script.Interpreter.SCRIPT_VERIFY_TAPROOT
        res = interpreter.verify(new btc.Script(''), tx1.outputs[0].script, tx2, 0, flags, witnesses, tx1.outputs[0].satoshis)
        expect(res).to.be.true
    })
})
