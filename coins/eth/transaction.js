import EthereumTx from 'ethereumjs-tx';
import {toHex} from "../utils";

const KEY_MAP = [
    'amount',
    'nonce',
    'gasLimit',
    'gasPrice',
    'to',
    'private_key',
];


/***
 *
 * @param transaction
 * {
 *     amount:
 *     nonce:
 *     gasLimit:
 *     gasPrice:
 *     to:
 *     private_key:
 *     timestamp:
 *     data:
 *     network: one of {morden, ropsten, rinkeby, goerli, kovan}
 * }
 * @returns {Promise<any> | Promise<*>} {encoded: hex String: signature: hex string}
 */
export const signTransaction = (transaction)=> new Promise((resolve, reject) => {
    const {network, amount, nonce, gasLimit, gasPrice, to, private_key, data} = transaction;
    const privateKey = new Buffer(private_key,'hex');

    // check key;
    KEY_MAP.forEach(k=>{
        if(!transaction.hasOwnProperty(k)){
            reject(k + ' not found');
        }
    });

    let txParams = {
        nonce: toHex(nonce),
        gasPrice: toHex(gasPrice),
        gasLimit: toHex(gasLimit),
        to: toHex(to),
        value: toHex(amount),
        chainId: getChainId(network),
    };
    if (data) {
        txParams = {...txParams, data:data};
    }
    const tx = new EthereumTx(txParams);
    try{
        tx.sign(privateKey);
        resolve({encoded:tx.serialize().toString('hex'), r:tx.r.toString('hex'),s:tx.s.toString('hex'),v:tx.v.toString('hex') })
    }catch (e) {
        reject('eth sign transaction failed',e);
    }
});


const getChainId=(network)=> {
    if (network.toLowerCase() === 'morden') {
        return 2;
    } else if (network.toLowerCase() === 'ropsten') {
        return 3;
    } else if (network.toLowerCase() === 'rinkeby') {
        return 4;
    } else if (network.toLowerCase() === 'goerli') {
        return 5;
    } else if (network.toLowerCase() === 'kovan') {
        return 42;
    } else {
        return 1;
    }
}