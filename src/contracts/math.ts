import {
    SmartContractLib,
    method,
    prop,
} from 'scrypt-ts'

export type U15 = bigint;

export type U30 = {
    hi: U15
    lo: U15
}

export type U60 = {
    hi: U30
    lo: U30
}

export type U120 = {
    hi: U60
    lo: U60
}

export class Math extends SmartContractLib {

    @prop()
    static readonly LIM_U15: bigint = 32768n    // 1 << 15

    @prop()
    static readonly NULL_U30: U30 = {
        hi: 0n,
        lo: 0n
    }

    @prop()
    static readonly NULL_U60: U60 = {
        hi: Math.NULL_U30,
        lo: Math.NULL_U30
    }

    @prop()
    static readonly NULL_U120: U120 = {
        hi: Math.NULL_U60,
        lo: Math.NULL_U60
    }

    @method()
    static addU15Carry(a: U15, b: U15): U30 {
        // TODO: Check lengths (a, b < Math.LIM_U15)?
        //
        const res = Math.NULL_U30
        const sum = a + b

        if (sum >= Math.LIM_U15) {
            res.lo = sum - Math.LIM_U15
            res.hi = 1n
        } else {
            res.lo = sum
        }

        return res
    }

    @method()
    static addU30Carry(a: U30, b: U30): U60 {
        const res = Math.NULL_U60

        const sum0 = a.lo + b.lo
        let carry0 = 0n
        if (sum0 >= Math.LIM_U15) {
            res.lo.lo = sum0 - Math.LIM_U15
            carry0 = 1n
        } else {
            res.lo.lo = sum0
        }

        const sum1 = a.hi + b.hi + carry0
        if (sum1 >= Math.LIM_U15) {
            res.lo.hi = sum1 - Math.LIM_U15
            res.hi.lo = 1n
        } else {
            res.lo.hi = sum1
        }

        return res
    }

    @method()
    static subU15Borrow(a: U15, b: U15): U30 {
        const res = Math.NULL_U30

        const diff = a - b
        if (a >= b) {
            res.lo = diff
        } else {
            res.lo = Math.LIM_U15 + diff
            res.hi = 1n
        }

        return res
    }

    @method()
    static subU30Borrow(a: U30, b: U30): U60 {
        const res = Math.NULL_U60

        const diff0 = a.lo - b.lo
        let borrow0 = 0n
        if (diff0 >= 0n) {
            res.lo.lo = diff0
        } else {
            res.lo.lo = Math.LIM_U15 + diff0
            borrow0 = 1n
        }

        const diff1 = a.hi - b.hi - borrow0
        let borrow1 = 0n;
        if (diff1 >= 0n) {
            res.lo.hi = diff1
        } else {
            res.lo.hi = Math.LIM_U15 + diff1
            borrow1 = 1n
        }

        res.hi.lo = borrow1

        return res
    }


    @method()
    static addU60Carry(a: U60, b: U60): U120 {
        const res = Math.NULL_U120

        const sum0 = a.lo.lo + b.lo.lo
        let carry0 = 0n
        if (sum0 >= Math.LIM_U15) {
            res.lo.lo.lo = sum0 - Math.LIM_U15
            carry0 = 1n
        } else {
            res.lo.lo.lo = sum0
        }

        const sum1 = a.lo.hi + b.lo.hi + carry0
        let carry1 = 0n
        if (sum1 >= Math.LIM_U15) {
            res.lo.lo.hi = sum1 - Math.LIM_U15
            carry1 = 1n
        } else {
            res.lo.lo.hi = sum1
        }

        const sum2 = a.hi.lo + b.hi.lo + carry1
        let carry2 = 0n
        if (sum2 >= Math.LIM_U15) {
            res.lo.hi.lo = sum2 - Math.LIM_U15
            carry2 = 1n
        } else {
            res.lo.hi.lo = sum2
        }

        const sum3 = a.hi.hi + b.hi.hi + carry2
        if (sum3 >= Math.LIM_U15) {
            res.lo.hi.hi = sum3 - Math.LIM_U15
            res.hi.lo.lo = 1n
        } else {
            res.lo.hi.hi = sum3
        }

        return res
    }

    @method()
    static subU60Borrow(a: U60, b: U60): U120 {
        const res = Math.NULL_U120

        const diff0 = a.lo.lo - b.lo.lo
        let borrow0 = 0n
        if (diff0 >= 0n) {
            res.lo.lo.lo = diff0
        } else {
            res.lo.lo.lo = Math.LIM_U15 + diff0
            borrow0 = 1n
        }
        
        const diff1 = a.lo.hi - b.lo.hi - borrow0
        let borrow1 = 0n;
        if (diff1 >= 0n) {
            res.lo.lo.hi = diff1
        } else {
            res.lo.lo.hi = Math.LIM_U15 + diff1
            borrow1 = 1n
        }

        const diff2 = a.hi.lo - b.hi.lo - borrow1
        let borrow2 = 0n;
        if (diff2 >= 0n) {
            res.lo.hi.lo = diff2
        } else {
            res.lo.hi.lo = Math.LIM_U15 + diff2
            borrow2 = 1n
        }

        const diff3 = a.hi.hi - b.hi.hi - borrow2
        let borrow3 = 0n;
        if (diff3 >= 0n) {
            res.lo.hi.hi = diff3
        } else {
            res.lo.hi.hi = Math.LIM_U15 + diff3
            borrow3 = 1n
        }

        res.hi.lo.lo = borrow3

        return res
    }
}
