import {
    assert,
    ByteString,
    method,
    prop,
    PubKey,
    Sig,
    SmartContract,
    toByteString,
    sha256,
    int2ByteString,
    FixedArray,
    len,
    hash256,
    Sha256,
    OpCode,
} from 'scrypt-ts'
import { SHPreimage, SigHashUtils } from './sigHashUtils'

export type DriveChainTx = {
    ver: ByteString
    locktime: ByteString
    inputContract: ByteString // Includes input count prefix...
    inputFee: ByteString
    contractOutputSPK: ByteString // contract output scriptPubKey
    contractOutputAmount: ByteString // contract output amount
    stateHash: Sha256
    payoutOut: ByteString
}

export type CoinbaseTx = {
    blockHeight: bigint
    inputScriptPrefix: ByteString
    inputScriptSuffix: ByteString
    locktime: ByteString
    outputs: ByteString
}

export type DriveChainState = {
    startPeriod: bigint
    voteCnt: bigint
    payoutAmt: bigint
    payoutSPK: ByteString
}

/**
 * Drivechain bridge smart contract example. Based on the SHA-gate contract for BCH, written by mr-zwets:
 * https://github.com/mr-zwets/upgraded-SHA-gate/blob/main/sha-gate-improved.cash
 */
export class DriveChain extends SmartContract {
    @prop()
    static readonly ZEROSAT: ByteString = toByteString('0000000000000000')

    @prop()
    hashOperatorKeys: ByteString

    constructor(hashOperatorKeys: ByteString) {
        super(...arguments)
        this.hashOperatorKeys = hashOperatorKeys
    }

    // Public method to lock extra funds in the covenant to bridge them.
    @method()
    public lock(
        shPreimage: SHPreimage,
        prevTx: DriveChainTx,
        amtBridged: bigint,
        spentAmountsSuffix: ByteString,
        feePrevout: ByteString
    ) {
        this.checkContractContext(shPreimage, prevTx, feePrevout)

        // Check passed spent amounts info is valid.
        assert(
            shPreimage.hashSpentAmounts ==
                sha256(DriveChain.padAmt(amtBridged) + spentAmountsSuffix)
        )

        // Check bridged amount is sufficient.
        assert(amtBridged > 10000n)

        // Enforce outputs.
        const hashOutputs = sha256(
            prevTx.contractOutputAmount +
                prevTx.contractOutputSPK +
                DriveChain.getStateOut(prevTx.stateHash)
        )
        assert(hashOutputs == shPreimage.hashOutputs)
    }

    // Public method to initialize a withdrawal request.
    @method()
    public initWithdrawal(
        shPreimage: SHPreimage,
        prevTx: DriveChainTx,
        operatorSigs: FixedArray<Sig, 3>,
        operatorPubKeys: FixedArray<PubKey, 5>,
        currentState: DriveChainState,
        nLockTimeInt: bigint,
        payoutAmt: bigint,
        payoutSPK: ByteString, // Must be length prefixed...
        feePrevout: ByteString
    ) {
        this.checkContractContext(shPreimage, prevTx, feePrevout)

        // Check passed state.
        assert(DriveChain.getStateHash(currentState) == prevTx.stateHash)

        // Check passed nLockTime int value.
        assert(shPreimage.nLockTime == DriveChain.padTime(nLockTimeInt))

        // Check operator pub keys.
        assert(
            DriveChain.getHashOperatorKeys(operatorPubKeys) ==
                this.hashOperatorKeys
        )

        // Verify operator sigs.
        assert(this.checkMultiSig(operatorSigs, operatorPubKeys))

        // This method can only be called at least 2088 blocks after startPeriod.
        // When initWithdrawal is called late, the following voting period is shorter by the number of blocks.
        // 2088 = voting period (2016) + withdrawal period (72)
        assert(nLockTimeInt >= currentState.startPeriod + 2088n)

        // Update state; reset vote count and set new start preiod.
        const newState: DriveChainState = {
            startPeriod: nLockTimeInt,
            voteCnt: 0n,
            payoutAmt: payoutAmt,
            payoutSPK: payoutSPK,
        }

        // Enforce outputs.
        const hashOutputs = sha256(
            prevTx.contractOutputAmount +
                prevTx.contractOutputSPK +
                DriveChain.getStateOut(DriveChain.getStateHash(newState))
        )
        assert(hashOutputs == shPreimage.hashOutputs)
    }

    // Public method for miners vote for the approval of the withdrawal request.
    @method()
    public vote(
        shPreimage: SHPreimage,
        prevTx: DriveChainTx,
        coinbaseTx: CoinbaseTx,
        currentState: DriveChainState,
        agree: boolean,
        feePrevout: ByteString
    ) {
        this.checkContractContextVote(
            shPreimage,
            prevTx,
            coinbaseTx,
            feePrevout
        )

        // Check passed state.
        assert(DriveChain.getStateHash(currentState) == prevTx.stateHash)

        // Check block height in coinbase tx is greater than start period.
        assert(coinbaseTx.blockHeight > currentState.startPeriod)

        // Adjust vote count.
        // Implements 66% agree-voting threshold
        if (agree) {
            currentState.voteCnt += 1n
        } else {
            currentState.voteCnt -= 2n
        }

        // Enforce outputs.
        const hashOutputs = sha256(
            prevTx.contractOutputAmount +
                prevTx.contractOutputSPK +
                DriveChain.getStateOut(DriveChain.getStateHash(currentState))
        )
        assert(hashOutputs == shPreimage.hashOutputs)
    }

    // Public method to finish the withdrawal process.
    @method()
    public finishWithdrawal(
        shPreimage: SHPreimage,
        prevTx: DriveChainTx,
        nLockTimeInt: bigint,
        currentState: DriveChainState,
        feePrevout: ByteString
    ) {
        this.checkContractContext(shPreimage, prevTx, feePrevout)

        // Check passed state.
        assert(DriveChain.getStateHash(currentState) == prevTx.stateHash)

        // Check passed nLockTime int value.
        assert(shPreimage.nLockTime == DriveChain.padTime(nLockTimeInt))

        // This method can only be called at least 2016 blocks after startPeriod.
        assert(nLockTimeInt >= currentState.startPeriod + 2016n)

        // Check votes were made.
        assert(currentState.voteCnt > 0n)

        // Construct payout output.
        const payoutOut =
            DriveChain.padAmt(currentState.payoutAmt) + currentState.payoutSPK

        // Update state; reset vote count, payout amt and set new start preiod.
        const newState: DriveChainState = {
            startPeriod: nLockTimeInt,
            voteCnt: 0n,
            payoutAmt: 0n,
            payoutSPK: toByteString(''),
        }

        // Enforce outputs.
        const hashOutputs = sha256(
            prevTx.contractOutputAmount +
                prevTx.contractOutputSPK +
                DriveChain.getStateOut(DriveChain.getStateHash(newState)) +
                payoutOut
        )
        assert(hashOutputs == shPreimage.hashOutputs)
    }

    @method()
    private checkContractContext(
        shPreimage: SHPreimage,
        prevTx: DriveChainTx,
        feePrevout: ByteString
    ): void {
        // Check sighash preimage.
        const s = SigHashUtils.checkSHPreimage(shPreimage)
        assert(this.checkSig(s, SigHashUtils.Gx))

        // Construct prev tx.
        const prevTxId = DriveChain.getTxId(prevTx)

        // Check prevouts to validate first input actually unlocks prev contract instance.
        const prevTxOutIdx = toByteString('00000000')
        const hashPrevouts = sha256(prevTxId + prevTxOutIdx + feePrevout)
        assert(hashPrevouts == shPreimage.hashPrevouts)

        // Check call is made via first tx input.
        assert(shPreimage.inputNumber == toByteString('00000000'))
    }

    @method()
    private checkContractContextVote(
        shPreimage: SHPreimage,
        prevTx: DriveChainTx,
        coinbaseTx: CoinbaseTx,
        feePrevout: ByteString
    ): void {
        // Check sighash preimage.
        const s = SigHashUtils.checkSHPreimage(shPreimage)
        assert(this.checkSig(s, SigHashUtils.Gx))

        // Construct prev tx.
        const prevTxId = DriveChain.getTxId(prevTx)

        // Get coinbase tx ID. Implicitly asserts that it acutally is a coinbase tx.
        const coinbaseTxId = DriveChain.getCoinbaseTxId(coinbaseTx)

        // Check prevouts to validate first input actually unlocks prev contract instance.
        // Also check second input unlocks passed coinbase tx, specifically its
        // first output to avoid counting vote multiple times.
        const prevTxOutIdx = toByteString('00000000')
        const hashPrevouts = sha256(
            prevTxId + prevTxOutIdx + coinbaseTxId + prevTxOutIdx + feePrevout
        )
        assert(hashPrevouts == shPreimage.hashPrevouts)

        // Check call is made via first tx input.
        assert(shPreimage.inputNumber == toByteString('00000000'))
    }

    @method()
    static padAmt(amt: bigint): ByteString {
        let res = int2ByteString(amt)
        if (res == toByteString('')) {
            res = toByteString('0000000000000000')
        } else if (amt < 0x0100n) {
            res += toByteString('00000000000000')
        } else if (amt < 0x010000n) {
            res += toByteString('000000000000')
        } else if (amt < 0x01000000n) {
            res += toByteString('0000000000')
        } else {
            assert(false)
        }
        return res
    }

    @method()
    static padTime(time: bigint): ByteString {
        let res = int2ByteString(time)
        if (res == toByteString('')) {
            res = toByteString('00000000')
        } else if (time < 0x0100n) {
            res += toByteString('000000')
        } else if (time < 0x010000n) {
            res += toByteString('0000')
        } else if (time < 0x01000000n) {
            res += toByteString('00')
        } else {
            assert(false)
        }
        return res
    }

    @method()
    static padBlockHeight(bh: bigint): ByteString {
        let res = int2ByteString(bh)
        if (res == toByteString('')) {
            res = toByteString('000000')
        } else if (bh < 0x0100n) {
            res += toByteString('0000')
        } else if (bh < 0x010000n) {
            res += toByteString('00')
        } else {
            assert(false)
        }
        return res
    }

    @method()
    static padCnt(cnt: bigint): ByteString {
        return DriveChain.padTime(cnt)
    }

    @method()
    static getTxId(tx: DriveChainTx): ByteString {
        const outLen: ByteString =
            tx.payoutOut == toByteString('')
                ? toByteString('02')
                : toByteString('03')
        return hash256(
            tx.ver +
                tx.inputContract +
                tx.inputFee +
                outLen +
                tx.contractOutputAmount +
                tx.contractOutputSPK +
                DriveChain.getStateOut(tx.stateHash) +
                tx.payoutOut +
                tx.locktime
        )
    }

    @method()
    static getCoinbaseTxId(tx: CoinbaseTx): ByteString {
        return hash256(
            toByteString(
                '02000000010000000000000000000000000000000000000000000000000000000000000000ffffffff'
            ) +
                tx.inputScriptPrefix +
                DriveChain.padBlockHeight(tx.blockHeight) +
                tx.outputs +
                tx.locktime
        )
    }

    @method()
    static getStateOut(stateHash: Sha256): ByteString {
        const opreturnScript = OpCode.OP_RETURN + toByteString('20') + stateHash
        return (
            DriveChain.ZEROSAT +
            int2ByteString(len(opreturnScript)) +
            opreturnScript
        )
    }

    @method()
    static getHashOperatorKeys(operatorPubKeys: FixedArray<PubKey, 5>): Sha256 {
        return hash256(
            operatorPubKeys[0] +
                operatorPubKeys[1] +
                operatorPubKeys[2] +
                operatorPubKeys[3] +
                operatorPubKeys[4]
        )
    }

    @method()
    static getStateHash(contractState: DriveChainState): Sha256 {
        return hash256(
            DriveChain.padTime(contractState.startPeriod) +
                DriveChain.padCnt(contractState.voteCnt) +
                DriveChain.padAmt(contractState.payoutAmt) +
                contractState.payoutSPK
        )
    }
}
