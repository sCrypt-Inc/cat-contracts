import { PrivateKey, PublicKey, crypto } from 'bitcore-lib'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

export function genPrivKey(network: 'testnet'): PrivateKey {
    dotenv.config({
        path: '.env',
    })

    const privKeyStr = process.env.PRIVATE_KEY
    let privKey: PrivateKey
    if (privKeyStr) {
        privKey = PrivateKey.fromWIF(privKeyStr as string)
        console.log(`Private key already present ...`)
    } else {
        privKey = PrivateKey.fromRandom(network)
        console.log(`Private key generated and saved in "${'.env'}"`)
        console.log(`Publickey: ${privKey.publicKey}`)
        console.log(`Address: ${privKey.toAddress()}`)
        fs.writeFileSync('.env', `PRIVATE_KEY="${privKey}"`)
    }

    const fundMessage = `You can fund its address '${privKey.toAddress()}' from the sCrypt faucet https://scrypt.io/faucet`

    console.log(fundMessage)

    return privKey
}

export const myPrivateKey = genPrivKey('testnet')

export const myPublicKey = PublicKey.fromPrivateKey(myPrivateKey)
export const myPublicKeyHash = crypto.Hash.sha256ripemd160(
    myPublicKey.toBuffer()
)
export const myAddress = myPublicKey.toAddress()
