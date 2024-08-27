import {
    assert,
    ByteString,
    method,
    prop,
    PubKey,
    sha256,
    Sig,
    SmartContract,
    toByteString,
} from 'scrypt-ts'
import { SHPreimage, SigHashUtils } from './sigHashUtils'


export class VaultTriggerWithdrawal extends SmartContract {

    @prop()
    withdrawalPubKey: PubKey

    /**
     *
     * @param withdrawalPubKey - Public key, used for withdrawal.
     *
     */
    constructor(
        withdrawalPubKey: PubKey,
    ) {
        super(...arguments)
        this.withdrawalPubKey = withdrawalPubKey
    }

    @method()
    public trigger(
        shPreimage: SHPreimage,
        sig: Sig,
        vaultSPK: ByteString,
        feeSPK: ByteString,
        vaultAmt: ByteString,
        feeAmt: ByteString,
        targetSPK: ByteString
    ) {
        // Check sig.
        assert(this.checkSig(sig, this.withdrawalPubKey))

        // Check sighash preimage.
        const s = SigHashUtils.checkSHPreimage(shPreimage)
        assert(this.checkSig(s, SigHashUtils.Gx))

        // Enforce spent scripts.
        const hashSpentScripts = sha256(vaultSPK + feeSPK)
        assert(hashSpentScripts == shPreimage.hashSpentScripts, 'hashSpentScripts mismatch')

        // Enforce spent amounts.
        const hashSpentAmounts = sha256(vaultAmt + feeAmt)
        assert(hashSpentAmounts == shPreimage.hashSpentAmounts, 'hashSpentAmounts mismatch')

        // Enforce outputs.
        const dust = toByteString('2202000000000000')
        const hashOutputs = sha256(
            vaultAmt + vaultSPK +
            dust + targetSPK
        )
        assert(hashOutputs == shPreimage.hashOutputs, 'hashOutputs mismatch')
    }

    // Default taproot key spend must be disabled!
}
