import {
    assert,
    ByteString,
    method,
    prop,
    PubKey,
    sha256,
    Sig,
    SmartContract,
} from 'scrypt-ts'
import { SHPreimage, SigHashUtils } from './sigHashUtils'


export class VaultCancelWithdrawal extends SmartContract {

    @prop()
    cancelPubKey: PubKey

    /**
     *
     * @param cancelPubKey - Public key, used for canceling.
     *
     */
    constructor(
        cancelPubKey: PubKey,
    ) {
        super(...arguments)
        this.cancelPubKey = cancelPubKey
    }

    @method()
    public trigger(
        shPreimage: SHPreimage,
        sig: Sig,
        vaultSPK: ByteString,
        feeSPK: ByteString,
        vaultAmt: ByteString,
        feeAmt: ByteString
    ) {
        // Check sig.
        assert(this.checkSig(sig, this.cancelPubKey))

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
        const hashOutputs = sha256(
            vaultAmt + vaultSPK
        )
        assert(hashOutputs == shPreimage.hashOutputs, 'hashOutputs mismatch')
    }

    // Default taproot key spend must be disabled!
}
