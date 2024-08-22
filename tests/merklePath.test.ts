// @ts-ignore
import btc = require('bitcore-lib-inquisition');
import { Tap } from '@cmdcode/tapscript'  // Requires node >= 19

import * as dotenv from 'dotenv';
dotenv.config();

import { expect, use } from 'chai'
import { TestMerklePath } from '../src/contracts/tests/testMerklePath'
import chaiAsPromised from 'chai-as-promised'
import { DISABLE_KEYSPEND_PUBKEY, fetchP2WPKHUtxos } from './utils/txHelper';
import { Sha256, reverseByteString } from 'scrypt-ts';
use(chaiAsPromised)


describe('Test SmartContract `TestMerklePath`', () => {
    let instance: TestMerklePath

    before(async () => {
        await TestMerklePath.loadArtifact()

        const merkleRoot = Sha256(
            reverseByteString(
                '9662207b12f8d515eaad007828c9e9f404496d805e00033461b235162aaf83d6',
                32n
            )
        )

        instance = new TestMerklePath(merkleRoot)
    })

    it('merkle proof validation BTC', async () => {
        const seckey = new btc.PrivateKey(process.env.PRIVATE_KEY, btc.Networks.testnet)
        const pubkey = seckey.toPublicKey()
        const addrP2WPKH = seckey.toAddress(null, btc.Address.PayToWitnessPublicKeyHash)

        const xOnlyPub = pubkey.toBuffer().length > 32 ? pubkey.toBuffer().slice(1, 33) : pubkey.toBuffer()

        let scriptMerkle = new btc.Script(instance.lockingScript.toHex())
        const tapleafMerkle = Tap.encodeScript(scriptMerkle.toBuffer())
        const [tpubkeyMerkle, cblockMerkle] = Tap.getPubKey(DISABLE_KEYSPEND_PUBKEY, { target: tapleafMerkle })
        const scripMerkleP2TR = new btc.Script(`OP_1 32 0x${tpubkeyMerkle}}`)

        // Fetch UTXO's for address
        const utxos = await fetchP2WPKHUtxos(addrP2WPKH)

        console.log(utxos)

        const tx0 = new btc.Transaction()
            .from(utxos)
            .addOutput(new btc.Transaction.Output({
                satoshis: 6000,
                script: scripMerkleP2TR
            }))
            .change(addrP2WPKH)
            .feePerByte(2)
            .sign(seckey)

        console.log('tx0 (serialized):', tx0.uncheckedSerialize())


        //////// CALL - UNLOCK

        const utxoMerkleP2TR = {
            txId: tx0.id,
            outputIndex: 0,
            script: scripMerkleP2TR,
            satoshis: 6000
        };

        const tx1 = new btc.Transaction()
            .from(utxoMerkleP2TR)
            .to(
                [
                    {
                        address: addrP2WPKH,
                        satoshis: 2000
                    }
                ]
            )

        let witnesses = [
            Buffer.from('b56e7872506c7eedbda2c0c777235a827014e0cd4511dc16c8819e828ca6b2cb', 'hex').reverse(), // Leaf / TXID
            Buffer.from('7f75f1028e68841b58eedf5b45b492122fab15b908f13a5487b2d975ff7f465c', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('770d586e084d52a193bddebe580fe6de4aef6486d7227a13d628c2e33d70cf28', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('1f5eed0537c9c83265bcc6a5c821281a64495be1f6797777ecbbbb3b2896d51e', 'hex'),
            Buffer.from('01', 'hex'),
            Buffer.from('14cc5109d7566259ba6142f792e1d9027655c4984d4a8896027028db2adf09bf', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('be21de9b0a16a667f4444c00402834512f913483606fe2791ff982d07dac7021', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('73dd06b50671da2563571ef21155f0be40f320dc314c3eb1d84f3c2a16cbb921', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('d4d4faa420d1e36676a9bfb5a8308d7583a8d1b8e4136353194e3fffada5d0a5', 'hex'),
            Buffer.from('01', 'hex'),
            Buffer.from('4943a0aeaa4aca0770beaae465ad63da1e0f1b4527bf167fa9a5716862ae9e3c', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('34d9646321299ef278eed16a1e3333f9afa3db38421974487891fb48df1be374', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('5c9f79205966f68b1ca92a151e4226b3b7443b3751c1dac35b8ac6eb038263b4', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('177cc17f4ec66a3c86128b453faaa97fe93fa76294e26bf928c77ddbbf298ee7', 'hex'),
            Buffer.from('01', 'hex'),
            Buffer.from('ae509cf73b6b1af4462ed247f123eb1dc55752c55286980967c54fb04f1dc27d', 'hex'),
            Buffer.from('01', 'hex'),
            Buffer.from('3b519af9d19b0b1ee4d4038bf8c21080a0281cfe82392c34733719c73b4e318e', 'hex'),
            Buffer.from('01', 'hex'),
            Buffer.from('146f9ff2c68b70afbe4c4aa2e69466ee6e87e1936fa1682ba0ad9e43f37ea4a0', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('bcdd7216861ba64e3056650a7f10330ca72d70337c06d75295215b4075043340', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('62683b0424a5270913ba21a72ba7e1fc45bf5da523005fe2484c743e714c341c', 'hex'),
            Buffer.from('01', 'hex'),
            Buffer.from('56b3d1ab25785b67cdfd3d50c5dd7d60236b2281e5d03070e9397598d76217c1', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('e67245de751572761fa93e0a264f1e14a460ae2ea050a9c4d5c6c4220681f816', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('66afcbf1068ea63c041e5ef3c06f9b6fd33cd2297d834e9d6dff4c3a392ea44c', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('bcadbc95cb79e008a23fa79c9db727d2d78bafdbd00448ee6108dc8962ca73c9', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('f765c267599dafe47ee0da3a0579d254a114a1bb9c66587b280fd58fbf203e71', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('da0375aa9ad13c25304bb75510c7e8f08caa46b764c5390bfa18a9835e63a3bb', 'hex'),
            Buffer.from('02', 'hex'),
            Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            Buffer.from('', 'hex'),
            Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            Buffer.from('', 'hex'),
            Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            Buffer.from('', 'hex'),
            Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            Buffer.from('', 'hex'),
            Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            Buffer.from('', 'hex'),
            Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            Buffer.from('', 'hex'),
            Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            Buffer.from('', 'hex'),
            Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            Buffer.from('', 'hex'),
            Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            Buffer.from('', 'hex'),
            Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            Buffer.from('', 'hex'),
            scriptMerkle.toBuffer(),
            Buffer.from(cblockMerkle, 'hex')
        ]
        tx1.inputs[0].witnesses = witnesses
        console.log('tx1 (serialized):', tx1.uncheckedSerialize())


        // Run locally
        let interpreter = new btc.Script.Interpreter()
        let flags = btc.Script.Interpreter.SCRIPT_VERIFY_WITNESS | btc.Script.Interpreter.SCRIPT_VERIFY_TAPROOT
        let res = interpreter.verify(new btc.Script(''), tx0.outputs[0].script, tx1, 0, flags, witnesses, 6000)

        expect(res).to.be.true

    })

})
