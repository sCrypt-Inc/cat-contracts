import { SmartContract, method, assert } from "scrypt-ts"
import { Math, U61, U15, U30, U60 } from "../math"

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
        assert(Math.checkU15(a) && Math.checkU15(b))

        const res = Math.addU15Carry(a, b)
        assert(Math.eqU30(res, resExpected))
    }

    @method()
    public testSub15Borrow(
        a: U15,
        b: U15,
        resExpected: U30
    ) {
        assert(Math.checkU15(a) && Math.checkU15(b))

        const res = Math.subU15Borrow(a, b)
        assert(Math.eqU30(res, resExpected))
    }
    
    @method()
    public testAddU30Carry(
        a: U30,
        b: U30,
        resExpected: U60
    ) {
        assert(Math.checkU30(a) && Math.checkU30(b))

        const res = Math.addU30Carry(a, b)
        assert(Math.eqU60(res, resExpected))
    }

    @method()
    public testSubU30Borrow(
        a: U30,
        b: U30,
        resExpected: U60
    ) {
        assert(Math.checkU30(a) && Math.checkU30(b))

        const res = Math.subU30Borrow(a, b)
        assert(Math.eqU60(res, resExpected))
    }

    @method()
    public testAddU60Carry(
        a: U60,
        b: U60,
        resExpected: U61
    ) {
        assert(Math.checkU60(a) && Math.checkU60(b))

        const res = Math.addU60Carry(a, b)
        assert(Math.eqU61(res, resExpected))
    }

    @method()
    public testSubU60Borrow(
        a: U60,
        b: U60,
        resExpected: U61
    ) {
        assert(Math.checkU60(a) && Math.checkU60(b))

        const res = Math.subU60Borrow(a, b)
        assert(Math.eqU61(res, resExpected))
    }
    
    
    @method()
    public testAddU60(
        a: U60,
        b: U60,
        resExpected: U60
    ) {
        assert(Math.checkU60(a) && Math.checkU60(b))

        const res = Math.addU60(a, b)
        assert(Math.eqU60(res, resExpected))
    }
    
    @method()
    public testSubU60(
        a: U60,
        b: U60,
        resExpected: U60
    ) {
        assert(Math.checkU60(a) && Math.checkU60(b))

        const res = Math.subU60(a, b)
        assert(Math.eqU60(res, resExpected))
    }

}
