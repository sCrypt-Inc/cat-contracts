import * as btc from 'bitcore-lib-inquisition';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

export function genPrivKey(network: 'testnet' | 'livenet' = 'testnet'): btc.PrivateKey {
    dotenv.config({
        path: '.env',
    });

    const privKeyStr = process.env.PRIVATE_KEY;
    let privKey: btc.PrivateKey;

    if (privKeyStr) {
        privKey = new btc.PrivateKey(privKeyStr);
        console.log(`Private key already present ...`);
    } else {
        privKey = new btc.PrivateKey(undefined, network);
        console.log(`Private key generated and saved in "${'.env'}"`);
        console.log(`Public key: ${privKey.publicKey.toString()}`);
        console.log(`Address: ${privKey.toAddress().toString()}`);
        fs.writeFileSync('.env', `PRIVATE_KEY="${privKey.toString()}"`);
    }

    const fundMessage = `You can fund its address '${privKey.toAddress()}' from a Bitcoin ${network} faucet`;
    console.log(fundMessage);

    return privKey;
}

export const myPrivateKey = genPrivKey('testnet');
export const myPublicKey = myPrivateKey.publicKey;
export const myPublicKeyHash = btc.crypto.Hash.sha256ripemd160(myPublicKey.toBuffer());
export const myAddress = myPrivateKey.toAddress();
