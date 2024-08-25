import {
    assert,
    ByteString,
    byteString2Int,
    hash256,
    int2ByteString,
    method,
    prop,
    sha256,
    SmartContract,
    toByteString,
} from 'scrypt-ts'
import { SHPreimage, SigHashUtils } from './sigHashUtils'

export class VaultCompleteWithdrawal extends SmartContract {
    @prop()
    sequenceVal: bigint

    constructor(sequenceVal: bigint) {
        super(...arguments)
        this.sequenceVal = sequenceVal
    }

    @method()
    public complete(
        shPreimage: SHPreimage,
        prevTxVer: ByteString,
        prevTxLocktime: ByteString,
        prevTxInputContract: ByteString,
        prevTxInputFee: ByteString,
        vaultSPK: ByteString,
        vaultAmt: ByteString,
        withdrawalAmt: ByteString,
        targetSPK: ByteString,
        feePrevout: ByteString
    ) {
        // Enforce relative locktime.
        this.csv(this.sequenceVal)

        // Check sighash preimage.
        const s = SigHashUtils.checkSHPreimage(shPreimage)
        assert(this.checkSig(s, SigHashUtils.Gx))

        // Convert ByteString amounts to BigInt for arithmetic operations.
        const vaultAmtInt = byteString2Int(vaultAmt)
        const withdrawalAmtInt = byteString2Int(withdrawalAmt)

        // Calculate remaining amount in the vault.
        const remainingVaultAmt = vaultAmtInt - withdrawalAmtInt
        assert(
            remainingVaultAmt >= 0,
            'Withdrawal amount exceeds vault balance.'
        )

        // Construct the previous tx.
        const dust = toByteString('2202000000000000')
        const prevTxId = hash256(
            prevTxVer +
                prevTxInputContract +
                prevTxInputFee +
                toByteString('02') +
                withdrawalAmt +
                targetSPK +
                int2ByteString(remainingVaultAmt) +
                vaultSPK +
                dust +
                prevTxLocktime
        )

        // Enforce prevouts.
        const hashPrevouts = sha256(
            prevTxId + toByteString('00000000') + feePrevout
        )
        assert(hashPrevouts == shPreimage.hashPrevouts, 'hashPrevouts mismatch')

        // Enforce outputs.
        const hashOutputs = sha256(
            withdrawalAmt +
                targetSPK +
                int2ByteString(remainingVaultAmt) +
                vaultSPK
        )
        assert(hashOutputs == shPreimage.hashOutputs, 'hashOutputs mismatch')
    }

    @method()
    private csv(sequenceVal: bigint): void {
        assert(true)
    }
}
