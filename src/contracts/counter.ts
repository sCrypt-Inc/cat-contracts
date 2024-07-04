import {
    assert,
    ByteString,
    hash256,
    method,
    OpCode,
    prop,
    sha256,
    SmartContract,
    toByteString,
    int2ByteString,
    len,
    Utils
} from 'scrypt-ts'
import { SHPreimage, SigHashUtils } from './sigHashUtils'


export class Counter extends SmartContract {

    @prop()
    static readonly ZEROSAT: ByteString = toByteString('0000000000000000')

    constructor() {
        super(...arguments)
    }

    @method()
    public complete(
        shPreimage: SHPreimage,
        prevTxVer: ByteString,
        prevTxLocktime: ByteString,
        prevTxInputContract: ByteString, // First input includes input count prefix...
        prevTxInputFee: ByteString,
        feePrevout: ByteString,
        contractOutputSPK: ByteString, // contract output scriptPubKey
        contractOutputAmount: ByteString, // contract output amount
        contractOutputAmountNew: ByteString, // updated contract output amount
        count: bigint
    ) {
        // Check sighash preimage.
        const s = SigHashUtils.checkSHPreimage(shPreimage)
        assert(this.checkSig(s, SigHashUtils.Gx))

        // Construct prev tx.
        const opreturnScript = OpCode.OP_RETURN + Counter.writeCount(int2ByteString(count))
        const opreturnOutput =
            Counter.ZEROSAT +
            int2ByteString(len(opreturnScript)) +
            opreturnScript
        const prevTxId = hash256(
            prevTxVer +
            prevTxInputContract +
            prevTxInputFee +
            toByteString('02') +
            contractOutputAmount +
            contractOutputSPK +
            opreturnOutput +
            prevTxLocktime
        )

        // Validate prev tx.
        const hashPrevouts = sha256(
            prevTxId + toByteString('00000000') + feePrevout
        )
        assert(hashPrevouts == shPreimage.hashPrevouts, 'hashPrevouts mismatch')
        assert(
            shPreimage.inputNumber == toByteString('00000000'), 'contract must be called via first input'
        )

        // Increment counter.
        const newCount = count + 1n
        const opreturnScriptNew = OpCode.OP_RETURN + Counter.writeCount(int2ByteString(newCount))
        const opreturnOutputNew =
            Counter.ZEROSAT +
            int2ByteString(len(opreturnScriptNew)) +
            opreturnScriptNew

        // Enforce outputs.
        const hashOutputs = sha256(
            // recurse: same scriptPubKey
            contractOutputAmountNew + contractOutputSPK + opreturnOutputNew
        )
        assert(hashOutputs == shPreimage.hashOutputs, 'hashOutputs mismatch')
    }

    @method()
    static writeCount(b: ByteString): ByteString {
        const n: bigint = len(b)

        let header: ByteString = toByteString('')
        
        if (b == toByteString('')) {
            header = toByteString('0100')
        } else if (n < 0x4c) {
            header = int2ByteString(n)
        } else if (n < 0x100) {
            header = toByteString('4c') + int2ByteString(n)
        } else if (n < 0x10000) {
            header = toByteString('4d') + int2ByteString(n)
        } else if (n < 0x100000000) {
            header = toByteString('4e') + int2ByteString(n)
        } else {
            // shall not reach here
            assert(false)
        }

        return header + b
    }

}
