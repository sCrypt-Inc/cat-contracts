import { Sha256, reverseByteString, toByteString } from "scrypt-ts"
import { MerklePath, MerkleProof, NodePos, Node, MERKLE_PROOF_MAX_DEPTH } from '../../src/contracts/merklePath'

export function prepProofFromElectrum(proof: any): MerkleProof {
    const res: Array<Node> = []
    const directions = numToBoolList(proof.pos)

    proof.merkle.forEach((hash, i) => {
        let pos = NodePos.Right
        if (i < directions.length && directions[i] == true) {
            pos = NodePos.Left
        }

        res.push({
            hash: Sha256(reverseByteString(toByteString(hash), 32n)),
            pos,
        })
    })

    // Pad remainder with invalid nodes.
    const invalidNode: Node = {
        hash: Sha256(
            '0000000000000000000000000000000000000000000000000000000000000000'
        ),
        pos: NodePos.Invalid,
    }
    return [
        ...res,
        ...Array(MERKLE_PROOF_MAX_DEPTH - res.length).fill(invalidNode),
    ] as MerkleProof
}

export function proofToBufferArray(proof: MerkleProof): Buffer[] {
    let res: Buffer[] = []

    for (let i = 0; i < proof.length; i++) {
        const node = proof[i]

        res.push(Buffer.from(node.hash, 'hex'))
        if (node.pos == NodePos.Invalid) {
            res.push(Buffer.from('', 'hex'))
        } else if (node.pos == NodePos.Left) {
            res.push(Buffer.from('01', 'hex'))
        } else {
            res.push(Buffer.from('02', 'hex'))
        }

    }

    return res
}

function numToBoolList(num) {
    const binaryStr = num.toString(2)
    const boolArray: boolean[] = []

    for (let i = binaryStr.length - 1; i >= 0; i--) {
        boolArray.push(binaryStr[i] === '1')
    }

    return boolArray
}
