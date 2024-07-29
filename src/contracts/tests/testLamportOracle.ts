import {
    method,
    prop,
    Ripemd160,
    assert,
    SmartContract,
} from 'scrypt-ts'
import { MerkleProof } from '../merklePath'
import { LamportKey, LamportMsg, LamportOracle, LamportSig } from '../lamportOracle'

export class TestLamportOracle extends SmartContract {
    @prop()
    pubKeyRoot: Ripemd160

    constructor(pubKeyRoot: Ripemd160) {
        super(...arguments)
        this.pubKeyRoot = pubKeyRoot
    }

    @method()
    public testVerifyMsg(
        msg: LamportMsg,
        sig: LamportSig,
        pubKey: LamportKey,
        pubKeyProof: MerkleProof
    ) {
        assert(
            LamportOracle.verifyMsg(
                msg, sig, pubKey, this.pubKeyRoot, pubKeyProof
            )
        )
    }
}
