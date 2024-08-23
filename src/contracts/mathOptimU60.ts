import {
    SmartContractLib,
    assert,
    method,
    prop,
} from 'scrypt-ts'


export type OptimU60 = {
    hi: bigint,
    lo: bigint
};


/**
 * Math library optimized for 60 bit addition and substraction.
 */
export class MathOptimU60 extends SmartContractLib {

    @prop()
    static readonly LIM_U30: bigint = 1073741824n    // 1 << 30

    @prop()
    static readonly NULL_OptimU60: OptimU60 = {
        hi: 0n,
        lo: 0n
    }

    /**
     * Checks limb values are within specified bounds [0, 2^30).
     * @param a OptimU60
     * @returns bool
     */
    @method()
    static checkOptimU60(a: OptimU60): boolean {
        return a.hi >= 0n && a.hi < MathOptimU60.LIM_U30 &&
            a.lo >= 0n && a.lo < MathOptimU60.LIM_U30
    }

    @method()
    static addOptimU60(a: OptimU60, b: OptimU60): OptimU60 {
        const res = MathOptimU60.NULL_OptimU60
        
        const sum0 = a.lo + b.lo
        let carry0 = 0n
        if (sum0 >= MathOptimU60.LIM_U30) {
            res.lo = sum0 - MathOptimU60.LIM_U30
            carry0 = 1n
        } else {
            res.lo = sum0
        }

        const sum1 = a.hi + b.hi + carry0
        res.hi = sum1
        assert(sum1 < MathOptimU60.LIM_U30)
        
        return res
    }

    @method()
    static subOptimU60(a: OptimU60, b: OptimU60): OptimU60 {
        const res = MathOptimU60.NULL_OptimU60

        const diff0 = a.lo - b.lo
        let borrow0 = 0n
        if (diff0 >= 0n) {
            res.lo = diff0
        } else {
            res.lo = MathOptimU60.LIM_U30 + diff0
            borrow0 = 1n
        }

        const diff1 = a.hi - b.hi - borrow0
        res.hi = diff1
        assert(diff1 >= 0n)

        return res
    }

    @method()
    static eqOptimU60(a: OptimU60, b: OptimU60): boolean {
        return a.hi == b.hi && a.lo == b.lo
    }

    @method()
    static ltOptimU60(a: OptimU60, b: OptimU60): boolean {
        let res = false
        if (a.hi == b.hi) {
            res = a.lo < b.lo
        } else {
            res = a.hi < b.hi
        }
        return res
    }

    @method()
    static gtOptimU60(a: OptimU60, b: OptimU60): boolean {
        let res = false
        if (a.hi == b.hi) {
            res = a.lo > b.lo
        } else {
            res = a.hi > b.hi
        }
        return res
    }

}
