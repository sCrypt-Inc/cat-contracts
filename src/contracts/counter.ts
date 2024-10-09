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
    len
} from 'scrypt-ts'
import { SHPreimage, SigHashUtils } from './sigHashUtils'


export type CounterPrevTx = {
    ver: ByteString
    locktime: ByteString
    inputContract: ByteString // Includes input count prefix...
    inputFee: ByteString,
    contractOutputSPK: ByteString, // contract output scriptPubKey
    contractOutputAmount: ByteString, // contract output amount
}

export class Counter extends SmartContract {

    @prop()
    static readonly ZEROSAT: ByteString = toByteString('0000000000000000')

    constructor() {
        super(...arguments)
    }

    @method()
    public increment(
        shPreimage: SHPreimage,
        prevTx: CounterPrevTx,
        feePrevout: ByteString,
        count: bigint
    ) {
        // Check sighash preimage.
        const s = SigHashUtils.checkSHPreimage(shPreimage)
        assert(this.checkSig(s, SigHashUtils.Gx))

        // Construct prev tx.
        const prevTxId = Counter.getPrevTxId(prevTx, count)

        // Check prevouts to validate first input actually unlocks prev counter instance.
        const prevTxOutIdx = toByteString('00000000')
        const hashPrevouts = sha256(prevTxId + prevTxOutIdx + feePrevout)
        assert(hashPrevouts == shPreimage.hashPrevouts)

        // Check counter covenant is called via first input.
        assert(shPreimage.inputNumber == toByteString('00000000'))

        // Increment counter.
        const newCount = count + 1n
        const stateOut = Counter.getStateOut(newCount)

        // Enforce outputs.
        const hashOutputs = sha256(
            // recurse: same scriptPubKey
            prevTx.contractOutputAmount + prevTx.contractOutputSPK + stateOut
        )
        assert(hashOutputs == shPreimage.hashOutputs)
    }

    @method()
    static getPrevTxId(prevTx: CounterPrevTx, count: bigint): ByteString {
        return hash256(
            prevTx.ver +
            prevTx.inputContract +
            prevTx.inputFee +
            toByteString('02') +
            prevTx.contractOutputAmount +
            prevTx.contractOutputSPK +
            Counter.getStateOut(count) +
            prevTx.locktime
        )
    }

    @method()
    static getStateOut(count: bigint): ByteString {
        const opreturnScript = OpCode.OP_RETURN + Counter.writeCount(int2ByteString(count))
        return Counter.ZEROSAT +
            int2ByteString(len(opreturnScript)) +
            opreturnScript
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
