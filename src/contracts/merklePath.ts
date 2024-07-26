import {
    method,
    SmartContractLib,
    hash256,
    Sha256,
    FixedArray,
} from 'scrypt-ts'

export const MERKLE_PROOF_MAX_DEPTH = 32

/*
Where the actual Merkle path is shorter than the predefined DEPTH, all trailing nodes will be marked as invalid.
 - invalid
 - on the left
 - on the right
*/
export enum NodePos {
    Invalid,
    Left,
    Right
}

export type Node = {
    hash: Sha256
    pos: NodePos
}

export type MerkleProof = FixedArray<Node, typeof MERKLE_PROOF_MAX_DEPTH> // If shorter than 32, pad with invalid nodes.

export class MerklePath extends SmartContractLib {

    /**
     * According to the given leaf node and merkle path, calculate the hash of the root node of the merkle tree.
    */
    @method()
    static calcMerkleRoot(
        leaf: Sha256,
        merkleProof: MerkleProof
    ): Sha256 {
        let root = leaf

        for (let i = 0; i < MERKLE_PROOF_MAX_DEPTH; i++) {
            const node = merkleProof[i]
            if (node.pos != NodePos.Invalid) {
                // s is valid
                root =
                    node.pos == NodePos.Left
                        ? Sha256(hash256(node.hash + root))
                        : Sha256(hash256(root + node.hash))
            }
        }

        return root
    }
}
