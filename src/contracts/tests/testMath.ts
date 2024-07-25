import { SmartContract, method, assert } from "scrypt-ts"
import { Math, U120, U15, U30, U60 } from "../math"

// TODO: Impl cmp funcs in lib...

export class TestMath extends SmartContract {

    constructor() {
        super(...arguments)
    }

    @method()
    public testAddU15Carry(
        a: U15,
        b: U15,
        resExpected: U30
    ) {
        const res = Math.addU15Carry(a, b)
        assert(res.lo == resExpected.lo)
        assert(res.hi == resExpected.hi)
    }

    @method()
    public testSub15Borrow(
        a: U15,
        b: U15,
        resExpected: U30
    ) {
        const res = Math.subU15Borrow(a, b)
        assert(res.lo == resExpected.lo)
        assert(res.hi == resExpected.hi)
    }
    
    @method()
    public testAddU30Carry(
        a: U30,
        b: U30,
        resExpected: U60
    ) {
        const res = Math.addU30Carry(a, b)
        assert(res.lo.lo == resExpected.lo.lo)
        assert(res.lo.hi == resExpected.lo.hi)
        assert(res.hi.lo == resExpected.hi.lo)
        assert(res.hi.hi == resExpected.hi.hi)
    }

    @method()
    public testSubU30Borrow(
        a: U30,
        b: U30,
        resExpected: U60
    ) {
        const res = Math.subU30Borrow(a, b)
        assert(res.lo.lo == resExpected.lo.lo)
        assert(res.lo.hi == resExpected.lo.hi)
        assert(res.hi.lo == resExpected.hi.lo)
        assert(res.hi.hi == resExpected.hi.hi)
    }

    @method()
    public testAddU60Carry(
        a: U60,
        b: U60,
        resExpected: U120
    ) {
        const res = Math.addU60Carry(a, b)
        assert(res.lo.lo.lo == resExpected.lo.lo.lo)
        assert(res.lo.lo.hi == resExpected.lo.lo.hi)
        assert(res.lo.hi.lo == resExpected.lo.hi.lo)
        assert(res.lo.hi.hi == resExpected.lo.hi.hi)
        assert(res.hi.lo.lo == resExpected.hi.lo.lo)
        assert(res.hi.lo.hi == resExpected.hi.lo.hi)
        assert(res.hi.hi.lo == resExpected.hi.hi.lo)
        assert(res.hi.hi.hi == resExpected.hi.hi.hi)
    }

    @method()
    public testSubU60Borrow(
        a: U60,
        b: U60,
        resExpected: U120
    ) {
        const res = Math.subU60Borrow(a, b)
        assert(res.lo.lo.lo == resExpected.lo.lo.lo)
        assert(res.lo.lo.hi == resExpected.lo.lo.hi)
        assert(res.lo.hi.lo == resExpected.lo.hi.lo)
        assert(res.lo.hi.hi == resExpected.lo.hi.hi)
        assert(res.hi.lo.lo == resExpected.hi.lo.lo)
        assert(res.hi.lo.hi == resExpected.hi.lo.hi)
        assert(res.hi.hi.lo == resExpected.hi.hi.lo)
        assert(res.hi.hi.hi == resExpected.hi.hi.hi)
    }

}
