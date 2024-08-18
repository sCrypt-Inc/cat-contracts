import {
    ByteString,
    PubKey,
    Sig,
    SmartContractLib,
    assert,
    int2ByteString,
    method,
    prop,
    sha256,
    toByteString,
} from 'scrypt-ts'

export const TAG_HASH = '7bb52d7a9fef58323eb1bf7a407db382d2f3f2d81bb1224f49fe518f6d48d37c' // sha256("BIP0340/challenge")
export const TAPSIGHASH = 'f40a48df4b2a70c8b4924bf2654661ed3d95fd66a313eb87237597c628e4a031'  // sha256("TapSighash")
export const Gx = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
export const PREIMAGE_SIGHASH = '00' // SIGHASH_ALL
export const PREIMAGE_EPOCH = '00'

export type SHPreimage = {
    txVer: ByteString
    nLockTime: ByteString
    hashPrevouts: ByteString
    hashSpentAmounts: ByteString
    hashSpentScripts: ByteString
    hashSequences: ByteString
    hashOutputs: ByteString
    spendType: ByteString
    inputNumber: ByteString
    hashTapLeaf: ByteString
    keyVer: ByteString
    codeSeparator: ByteString

    sigHash: ByteString
    _e: ByteString      // e without last byte
    eSuffix: bigint     // last byte of e
}

export class SigHashUtils extends SmartContractLib {
    // Data for checking sighash preimage:
    @prop()
    static readonly Gx: PubKey = PubKey(
        toByteString(
            '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
        )
    )
    @prop()
    static readonly ePreimagePrefix: ByteString = toByteString(
        '7bb52d7a9fef58323eb1bf7a407db382d2f3f2d81bb1224f49fe518f6d48d37c7bb52d7a9fef58323eb1bf7a407db382d2f3f2d81bb1224f49fe518f6d48d37c79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f8179879be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
    ) // TAG_HASH + TAG_HASH + Gx + Gx
    @prop()
    static readonly preimagePrefix: ByteString = toByteString(
        'f40a48df4b2a70c8b4924bf2654661ed3d95fd66a313eb87237597c628e4a031f40a48df4b2a70c8b4924bf2654661ed3d95fd66a313eb87237597c628e4a0310000'
    ) // TAPSIGHASH + TAPSIGHASH + PREIMAGE_SIGHASH + PREIMAGE_EPOCH

    @method()
    static checkSHPreimage(shPreimage: SHPreimage): Sig {
        assert(shPreimage.eSuffix > -127n && shPreimage.eSuffix < 127n, 'e suffix not in range [-126, 127)')
        const e = sha256(SigHashUtils.ePreimagePrefix + shPreimage.sigHash)
        assert(e == shPreimage._e + int2ByteString(shPreimage.eSuffix), 'invalid value of _e')
        const sDelta: bigint = shPreimage.eSuffix < 0n ? -1n : 1n;
        const s = SigHashUtils.Gx + shPreimage._e + int2ByteString(shPreimage.eSuffix + sDelta)
        const sigHash = sha256(
            SigHashUtils.preimagePrefix +
            shPreimage.txVer +
            shPreimage.nLockTime +
            shPreimage.hashPrevouts +
            shPreimage.hashSpentAmounts +
            shPreimage.hashSpentScripts +
            shPreimage.hashSequences +
            shPreimage.hashOutputs +
            shPreimage.spendType +
            shPreimage.inputNumber +
            shPreimage.hashTapLeaf +
            shPreimage.keyVer +
            shPreimage.codeSeparator
        )
        assert(sigHash == shPreimage.sigHash, 'sigHash mismatch')

        //assert(this.checkSig(Sig(s), SigHashUtils.Gx)) TODO (currently done outside)
        return Sig(s)
    }
}
