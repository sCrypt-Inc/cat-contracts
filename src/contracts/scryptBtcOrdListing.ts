import {
    assert,
    ByteString,
    method,
    prop,
    sha256,
    SmartContract,
} from 'scrypt-ts'
import { SHPreimage, SigHashUtils } from './sigHashUtils'


export class OrdListing extends SmartContract {

    @prop()
    paymentOutput: ByteString

    /**
     *
     * @param paymentOutput  - Serialized output that pays seller.
     */
    constructor(paymentOutput: ByteString) {
        super(...arguments)
        this.paymentOutput = paymentOutput
    }

    @method()
    public unlock(
        shPreimage: SHPreimage,
        ordDestOutput: ByteString,
        changeOutput: ByteString
    ) {
        // Check sighash preimage.
        const s = SigHashUtils.checkSHPreimage(shPreimage)
        assert(this.checkSig(s, SigHashUtils.Gx))

        // Construct outputs and compare against hash in sighash preimage.
        const hashOutputs = sha256(
            this.paymentOutput + ordDestOutput + changeOutput
        )
        assert(hashOutputs == shPreimage.hashOutputs, 'hashOutputs mismatch')
    }

}
