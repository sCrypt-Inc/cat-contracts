import {
    method,
    SmartContractLib,
    FixedArray,
    ByteString,
    toByteString,
    hash160,
    assert,
    Ripemd160,
} from 'scrypt-ts'
import { MerkleProof, NodePos } from './merklePath'

export const LAMPORT_MSG_BITS = 8
export const LAMPORT_KEY_SIZE = 16

export type LamportMsg = FixedArray<boolean, typeof LAMPORT_MSG_BITS>

export type LamportKey = FixedArray<ByteString, typeof LAMPORT_KEY_SIZE >

export type LamportSig = FixedArray<ByteString, typeof LAMPORT_MSG_BITS>

export class LamportOracle extends SmartContractLib {
    
    @method()
    static verifyMsg(
        msg: LamportMsg,
        sig: LamportSig,
        pubKey: LamportKey,
        pubKeyRoot: ByteString,
        pubKeyProof: MerkleProof
    ): boolean {
        // Convert pub key to a Merkle tree leaf.
        const leaf = LamportOracle.pubKey2Leaf(pubKey)

        // Check merkle proof.
        assert(
            LamportOracle.calcMerkleRootRipemd160(leaf, pubKeyProof) == pubKeyRoot,
            'Merkle path check failed'
        )

        // Check sig against msg.
        LamportOracle.checkLamportSig(msg, pubKey, sig)
        
        return true
    }
    

    @method()
    static pubKey2Leaf(
        pubKey: LamportKey
    ): Ripemd160 {
        let res = toByteString('')
        
        for (let i = 0; i < LAMPORT_MSG_BITS; i++) {
            res = hash160(pubKey[i] + pubKey[LAMPORT_MSG_BITS + i] + res)
        }
        
        return Ripemd160(res)
    }
    
    @method()
    static calcMerkleRootRipemd160(
        leaf: Ripemd160,
        merkleProof: MerkleProof
    ): Ripemd160 {
        let root = leaf

        for (let i = 0; i < 32; i++) {
            const node = merkleProof[i]
            if (node.pos != NodePos.Invalid) {
                // s is valid
                root =
                    node.pos == NodePos.Left
                        ? Ripemd160(hash160(node.hash + root))
                        : Ripemd160(hash160(root + node.hash))
            }
        }

        return root
    }
    
    @method()
    static checkLamportSig(
        msg: LamportMsg, 
        pubKey: LamportKey, 
        sig: LamportSig
    ): void {
        for (let i = 0; i < LAMPORT_MSG_BITS; i++) {
            const pubKeyChunk = msg[i] ? pubKey[i] : pubKey[LAMPORT_MSG_BITS + i]
            assert(
                hash160(sig[i]) == pubKeyChunk, `invalid sig chunk at idx ${i}`
            )
        }
    }

}
