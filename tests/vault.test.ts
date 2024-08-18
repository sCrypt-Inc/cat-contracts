// @ts-ignore
import btc = require('bitcore-lib-inquisition');
import { Tap } from '@cmdcode/tapscript'  // Requires node >= 19

import * as dotenv from 'dotenv';
dotenv.config();

import { expect, use } from 'chai'
import { VaultTriggerWithdrawal } from '../src/contracts/vaultTriggerWithdrawal'
import { VaultCompleteWithdrawal } from '../src/contracts/vaultCompleteWithdrawal'
import { VaultCancelWithdrawal } from '../src/contracts/vaultCancelWithdrawal'
import chaiAsPromised from 'chai-as-promised'
import { fetchP2WPKHUtxos, getSigHashSchnorr, getE, splitSighashPreimage } from './utils/txHelper';
use(chaiAsPromised)

describe('Test SmartContract `Vault`', () => {

    before(async () => {
        await VaultTriggerWithdrawal.loadArtifact()
        await VaultCompleteWithdrawal.loadArtifact()
        await VaultCancelWithdrawal.loadArtifact()
    })

    it('should pass', async () => {
        const seckey = new btc.PrivateKey(process.env.PRIVATE_KEY, btc.Networks.testnet)
        const pubkey = seckey.toPublicKey()
        const addrP2WPKH = seckey.toAddress(null, btc.Address.PayToWitnessPublicKeyHash)

        const xOnlyPub = pubkey.toBuffer().length > 32 ? pubkey.toBuffer().slice(1, 33) : pubkey.toBuffer()

        const instanceTrigger = new VaultTriggerWithdrawal(
            xOnlyPub.toString('hex')
        )
        const scriptVaultTrigger = instanceTrigger.lockingScript
        const tapleafVaultTrigger = Tap.encodeScript(scriptVaultTrigger.toBuffer())

        const instanceComplete = new VaultCompleteWithdrawal(
            2n  // 2 blocks
        )
        const scriptVaultComplete = instanceComplete.lockingScript
        const tapleafVaultComplete = Tap.encodeScript(scriptVaultComplete.toBuffer())

        const instanceCancel = new VaultCancelWithdrawal(
            xOnlyPub.toString('hex')
        )
        const scriptVaultCancel = instanceCancel.lockingScript
        const tapleafVaultCancel = Tap.encodeScript(scriptVaultCancel.toBuffer())

        const [tpubkeyVault,] = Tap.getPubKey(pubkey.toString(), { tree: [tapleafVaultTrigger, tapleafVaultComplete, tapleafVaultCancel] })
        const scripVaultP2TR = new btc.Script(`OP_1 32 0x${tpubkeyVault}}`)

        const [, cblockVaultTrigger] = Tap.getPubKey(pubkey.toString(),
            {
                target: tapleafVaultTrigger,
                tree: [tapleafVaultTrigger, tapleafVaultComplete, tapleafVaultCancel]
            }
        )
        const [, cblockVaultComplete] = Tap.getPubKey(pubkey.toString(),
            {
                target: tapleafVaultComplete,
                tree: [tapleafVaultTrigger, tapleafVaultComplete, tapleafVaultCancel]
            }
        )
        const [, cblockVaultCancel] = Tap.getPubKey(pubkey.toString(),
            {
                target: tapleafVaultCancel,
                tree: [tapleafVaultTrigger, tapleafVaultComplete, tapleafVaultCancel]
            }
        )

        // Fetch UTXO's for address
        let utxos = await fetchP2WPKHUtxos(addrP2WPKH)
        if (utxos.length === 0){
            throw new Error(`No UTXO's for address: ${addrP2WPKH.toString()}`) 
        }
        console.log(utxos)

        const tx0 = new btc.Transaction()
            .from(utxos)
            .addOutput(new btc.Transaction.Output({
                satoshis: 1000,
                script: scripVaultP2TR
            }))
            .change(addrP2WPKH)
            .feePerByte(2)
            .sign(seckey)
        const vaultAmtBuff = Buffer.alloc(8)
        vaultAmtBuff.writeBigInt64LE(1000n)

        console.log('tx0 (serialized):', tx0.uncheckedSerialize())

        //////// Create fee outputs
        const feeAmtBuff = Buffer.alloc(8)
        feeAmtBuff.writeBigInt64LE(3500n)

        utxos = await fetchP2WPKHUtxos(addrP2WPKH)

        const txFee = new btc.Transaction()
            .from(utxos)
            .to(addrP2WPKH, 3500)
            .to(addrP2WPKH, 3500)
            .change(addrP2WPKH)
            .feePerByte(2)
            .sign(seckey)

        console.log('txFee (serialized):', txFee.uncheckedSerialize())

        //////// CALL - Trigger

        const utxoVaultLockedP2TR = {
            txId: tx0.id,
            outputIndex: 0,
            script: scripVaultP2TR,
            satoshis: tx0.outputs[0].satoshis
        };

        const feeUTXO = {
            address: addrP2WPKH.toString(),
            txId: txFee.id,
            outputIndex: 0,
            script: new btc.Script(addrP2WPKH),
            satoshis: txFee.outputs[0].satoshis
        }

        const targetOut = new btc.Transaction.Output({
            satoshis: 546,
            script: new btc.Script(addrP2WPKH),
        })

        const tx1 = new btc.Transaction()
            .from([utxoVaultLockedP2TR, feeUTXO])
            .addOutput(tx0.outputs[0])
            .addOutput(targetOut)

        // Mutate tx1 if it ends with 0x7f (highest single byte stack value) or 0xff (lowest signle byte stack value).
        let e, eBuff, sighash, eLastByte;
        while (true) {
            sighash = getSigHashSchnorr(tx1, Buffer.from(tapleafVaultTrigger, 'hex'), 0)
            e = await getE(sighash.hash)
            eBuff = e.toBuffer(32)
            eLastByte = eBuff[eBuff.length - 1]
            if (eLastByte != 0x7f && eLastByte != 0xff) {
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
            Buffer.from(eLastByte.toString(16), 'hex'),
            sig,
            Buffer.concat([Buffer.from('22', 'hex'), scripVaultP2TR.toBuffer()]),
            Buffer.concat([Buffer.from('16', 'hex'), txFee.outputs[0].script.toBuffer()]),
            vaultAmtBuff,
            feeAmtBuff,
            Buffer.concat([Buffer.from('16', 'hex'), targetOut.script.toBuffer()]),
            scriptVaultTrigger.toBuffer(),
            Buffer.from(cblockVaultTrigger, 'hex')
        ]
        tx1.inputs[0].witnesses = witnesses


        console.log('tx1 (serialized):', tx1.uncheckedSerialize())

        // Run locally
        let interpreter = new btc.Script.Interpreter()
        let flags = btc.Script.Interpreter.SCRIPT_VERIFY_WITNESS | btc.Script.Interpreter.SCRIPT_VERIFY_TAPROOT
        let res = interpreter.verify(new btc.Script(''), tx0.outputs[0].script, tx1, 0, flags, witnesses, tx0.outputs[0].satoshis)
        expect(res).to.be.true

        //////////// CALL - Complete
        const utxoVaultTriggeredP2TR = {
            txId: tx1.id,
            outputIndex: 0,
            script: scripVaultP2TR,
            satoshis: tx1.outputs[0].satoshis
        };

        const feeUTXO2 = {
            address: addrP2WPKH.toString(),
            txId: txFee.id,
            outputIndex: 1,
            script: new btc.Script(addrP2WPKH),
            satoshis: txFee.outputs[1].satoshis
        }

        const destOut = new btc.Transaction.Output({
            satoshis: tx1.outputs[0].satoshis,
            script: new btc.Script(addrP2WPKH),
        })

        const tx2 = new btc.Transaction()
            .from([utxoVaultTriggeredP2TR, feeUTXO2])
            .addOutput(destOut)

        tx2.inputs[0].lockUntilBlockHeight(2)

        // Mutate tx2 if it ends with 0x7f (highest single byte stack value) or 0xff (lowest signle byte stack value).
        while (true) {
            sighash = getSigHashSchnorr(tx2, Buffer.from(tapleafVaultComplete, 'hex'), 0)
            e = await getE(sighash.hash)
            eBuff = e.toBuffer(32)
            eLastByte = eBuff[eBuff.length - 1]
            if (eLastByte != 0x7f && eLastByte != 0xff) {
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

        const prevTxVer = Buffer.alloc(4)
        prevTxVer.writeUInt32LE(tx1.version)

        const prevTxLocktime = Buffer.alloc(4)
        prevTxLocktime.writeUInt32LE(tx1.nLockTime)

        let prevTxInputContract = new btc.encoding.BufferWriter()
        prevTxInputContract.writeVarintNum(tx1.inputs.length)
        tx1.inputs[0].toBufferWriter(prevTxInputContract);
        let prevTxInputFee = new btc.encoding.BufferWriter()
        tx1.inputs[1].toBufferWriter(prevTxInputFee);

        let feePrevout = new btc.encoding.BufferWriter()
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
            Buffer.from(eLastByte.toString(16), 'hex'),
            prevTxVer,
            prevTxLocktime,
            prevTxInputContract.toBuffer(),
            prevTxInputFee.toBuffer(),
            Buffer.concat([Buffer.from('22', 'hex'), scripVaultP2TR.toBuffer()]),
            vaultAmtBuff,
            Buffer.concat([Buffer.from('16', 'hex'), targetOut.script.toBuffer()]),
            feePrevout.toBuffer(),
            scriptVaultComplete.toBuffer(),
            Buffer.from(cblockVaultComplete, 'hex')
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
