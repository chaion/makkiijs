import { HttpClient } from "lib-common-util-js";
import BigNumber from "bignumber.js";
import keystore from "../lib_keystore";
import jsonrpcClient from './jsonrpc';
import { base58check2HexString } from "../utils";

export default config => {

    const {
        getTransactionById,
        getTransactionInfoById,
        getLatestBlock,
        broadcastTransaction,
    } = jsonrpcClient(config);

    async function sendTransaction(unsignedTx, signer, signerParams) {
        const signedTx = await signer.signTransaction(unsignedTx, signerParams);
        const broadcastRes:any = await broadcastTransaction(signedTx);
        if(broadcastRes.result){
            return {
                hash: `${signedTx.txID}`,
                timestamp: unsignedTx.timestamp,
                from: unsignedTx.owner,
                to: unsignedTx.to,
                value: unsignedTx.amount,
                status: 'PENDING',
            }
        }
        throw new Error('broadcast tx failed')
    }
    
    async function buildTransction(from, to, value) {
        const block: any = await getLatestBlock();
        const latest_block = {
            hash: block.blockID,
            number: block.block_header.raw_data.number,
        };
        const now = new Date().getTime();
        const expire = now + 10 * 60 * 60 * 1000;
        const tx = {
            to,
            owner: from,
            amount: value.shiftedBy(6).toNumber(),
            timestamp: now,
            expiration: expire,
            latest_block,
        };
        return tx;
    }

    function getTransactionStatus(txHash) {
        return new Promise((resolve, reject) => {
            getTransactionInfoById(txHash)
                .then(res => {
                    const { blockNumber } = res;
                    getTransactionById(txHash)
                        .then(tx => {
                            if (
                                tx.ret !== undefined &&
                                tx.ret instanceof Array &&
                                tx.ret.length > 0 &&
                                tx.ret[0].contractRet !== undefined
                            ) {
                                resolve({
                                    blockNumber,
                                    status: tx.ret[0].contractRet === 'SUCCESS',
                                });
                                return;
                            }
                            resolve(undefined);
                        })
                        .catch(err => {
                            reject(err);
                        });
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    function getTransactionsByAddress(address, page = 0, size = 25) {
        const url = `${config.explorer_api}/transfer?sort=-timestamp&limit=${size}&start=${page * size}&address=${address}`;
        console.log(`[tron req] get tron txs by address: ${url}`);
        return new Promise((resolve, reject) => {
            HttpClient.get(url, false)
                .then(res => {
                    const { data } = res.data;
                    const txs = {};
                    data.forEach(t => {
                        if (t.tokenName === '_') {
                            const tx:any = {};
                            tx.hash = `${t.transactionHash}`;
                            tx.timestamp = t.timestamp;
                            tx.from = t.transferFromAddress;
                            tx.to = t.transferToAddress;
                            tx.value = new BigNumber(t.amount, 10).shiftedBy(-6).toNumber();
                            tx.blockNumber = t.block;
                            tx.status = t.confirmed ? 'CONFIRMED' : 'FAILED';
                            txs[tx.hash] = tx;
                        }
                    });
                    resolve(txs);
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    function getTransactionUrlInExplorer(txHash) {
        txHash = txHash.startsWith('0x') ? txHash.slice(2) : txHash;
        return `${config.explorer}/${txHash}`;
    }

    return {
        sendTransaction,
        getTransactionStatus,
        getTransactionUrlInExplorer,
        getTransactionsByAddress,
        buildTransction
    }

}