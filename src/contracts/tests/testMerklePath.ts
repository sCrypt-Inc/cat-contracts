import {
    assert,
    method,
    prop,
    Sha256,
    SmartContract,
} from 'scrypt-ts'
import { MerklePath, MerkleProof } from '../merklePath'

export class TestMerklePath extends SmartContract {
    @prop()
    root: Sha256

    constructor(root: Sha256) {
        super(...arguments)
        this.root = root
    }

    @method()
    public unlock(leaf: Sha256, merkleProof: MerkleProof) {
        assert(
            MerklePath.calcMerkleRoot(leaf, merkleProof) == this.root
        )
    }
}
