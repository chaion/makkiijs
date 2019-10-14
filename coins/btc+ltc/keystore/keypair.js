import {ECPair, payments} from 'bitcoinjs-lib';
import {networks} from './network';

export const keyPair = function(priKey, options){
    if (typeof priKey == 'string') {
        if (priKey.startsWith('0x')){
            priKey = priKey.substring(2);
        }
        priKey = Buffer.from(priKey, 'hex');
    }
    let network = networks.BTC;
    if(options&&options.network){
        network = networks[options.network];
    }
    const key  = ECPair.fromPrivateKey(priKey,{network: network});
    const privateKey = key.privateKey;
    const publicKey = key.publicKey;
    const { address } = payments.p2pkh({ pubkey: key.publicKey, network:network});
    return {privateKey: privateKey.toString('hex'), publicKey: publicKey.toString('hex'), address, sign: key.sign, toWIF: key.toWIF}
};

