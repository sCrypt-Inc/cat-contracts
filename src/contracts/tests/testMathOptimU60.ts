import { SmartContract, method, assert } from "scrypt-ts"
import { MathOptimU60, OptimU60 } from "../mathOptimU60"

export class TestMathOptimU60 extends SmartContract {

    constructor() {
        super(...arguments)
    }
    
    @method()
    public testAddU60(
        a: OptimU60,
        b: OptimU60,
        resExpected: OptimU60
    ) {
        assert(MathOptimU60.checkOptimU60(a) && MathOptimU60.checkOptimU60(b))

        const res = MathOptimU60.addOptimU60(a, b)
        assert(MathOptimU60.eqOptimU60(res, resExpected))
    }

    @method()
    public testSubU60(
        a: OptimU60,
        b: OptimU60,
        resExpected: OptimU60
    ) {
        assert(MathOptimU60.checkOptimU60(a) && MathOptimU60.checkOptimU60(b))

        const res = MathOptimU60.subOptimU60(a, b)
        assert(true)
        assert(MathOptimU60.eqOptimU60(res, resExpected))
    }

}
