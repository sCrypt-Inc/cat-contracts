import {
    assert,
    ByteString,
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

    /**
     * 
     * @param sequenceVal - Relative locktime of withdrawal period.
     */
    constructor(sequenceVal: bigint) {
        super(...arguments)
        this.sequenceVal = sequenceVal
    }

    @method()
    public complete(
        shPreimage: SHPreimage,
        prevTxVer: ByteString,
        prevTxLocktime: ByteString,
        prevTxInputContract: ByteString,    // First input chunk should also include length prefix...
        prevTxInputFee: ByteString,
        vaultSPK: ByteString,   // P2PTR script of vault
        vaultAmtInt: bigint,
        withdrawalAmtInt: bigint,
        targetSPK: ByteString,  // Withdrawal destination script.
        feePrevout: ByteString
    ) {
        this.csv(this.sequenceVal)

        // Check sighash preimage.
        const s = SigHashUtils.checkSHPreimage(shPreimage)
        assert(this.checkSig(s, SigHashUtils.Gx))
        
        // Calculate remaining amount in the vault.
        assert(vaultAmtInt >= 0n)
        assert(withdrawalAmtInt > 0n)
        const remainingVaultAmtInt = vaultAmtInt - withdrawalAmtInt
        assert(
            remainingVaultAmtInt >= 0,
            'Withdrawal amount exceeds vault balance.'
        )
        
        // Convert amounts to byte strings and pad them to be 8 bytes long.
        const vaultAmt = this.padAmt(vaultAmtInt)
        const withdrawalAmt = this.padAmt(withdrawalAmtInt)
        const remainingVaultAmt = this.padAmt(remainingVaultAmtInt)

        const prevTxId = hash256(
            prevTxVer +
            prevTxInputContract +
            prevTxInputFee +
            toByteString('02') +
            vaultAmt +
            vaultSPK +
            toByteString('2202000000000000') + // Dust amt
            targetSPK +
            prevTxLocktime
        )

        // Enforce prevouts.
        const hashPrevouts = sha256(
            prevTxId + toByteString('00000000') + feePrevout
        )
        assert(hashPrevouts == shPreimage.hashPrevouts, 'hashPrevouts mismatch')

        // Enforce outputs.
        let hashOutputs: ByteString = toByteString('')
        if (remainingVaultAmtInt == 0n) {
            // If no amount remains after withdrawal, only enforce the withdrawal target output.
            hashOutputs = sha256(
                withdrawalAmt + targetSPK
            )
        } else {
            // If theres a remainder, re-lock it into the vault.
            hashOutputs = sha256(
                remainingVaultAmt + vaultSPK +
                withdrawalAmt + targetSPK
            )
        }

        assert(hashOutputs == shPreimage.hashOutputs, 'hashOutputs mismatch')
    }

    @method()
    private csv(sequenceVal: bigint): void {
        // ... Gets substituted for OP_CSV w/ inline assembly hook
        // TODO: Rm once OP_CSV is added to compiler.
        assert(true)
    }
    
    @method()
    private padAmt(amt: bigint): ByteString {
        let res = int2ByteString(amt)
        if (amt < 0x0100n) {
            res += toByteString('00000000000000')
        } else if (amt < 0x010000n) {
            res += toByteString('000000000000')
        } else if (amt < 0x01000000n) {
            res += toByteString('0000000000')
        } else {
            assert(false, 'bad amt')
        }
        return res
    }
}
