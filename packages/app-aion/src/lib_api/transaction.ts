/* eslint-disable no-nested-ternary */
/* eslint-disable radix */
import BigNumber from 'bignumber.js';
import { HttpClient } from 'lib-common-util-js';
import { CONTRACT_ABI } from './constants';
import jsonrpcClient from './jsonrpc';

const Contract = require('aion-web3-eth-contract');

export default (config) => {

  const { getTransactionReceipt, getTransactionCount, sendSignedTransaction } = jsonrpcClient(config);

  async function sendTransaction(unsignedTx, signer, signerParams) {
    const signedTx = await signer.signTransaction(unsignedTx, signerParams);
    const hash = await sendSignedTransaction(signedTx);
    return {
      hash,
      status: 'PENIDNG',
      to: unsignedTx.to,
      from: unsignedTx.from,
      value: unsignedTx.value,
      tknTo: unsignedTx.tknTo,
      tknValue: unsignedTx.tknValue,
      timestamp: unsignedTx.timestamp,
      gasLimit: unsignedTx.gasLimit,
      gasPrice: unsignedTx.gasPrice
    }
  }

  async function buildTransaction(from, to, value, options) {
    const { data: data_, gasLimit, gasPrice, contractAddr, isTransfer, tokenDecimal } = options;
    const nonce = await getTransactionCount(from, 'pending');
    let data = data_;
    if (isTransfer) {
      const tokenContract = new Contract(CONTRACT_ABI, contractAddr);
      data = tokenContract.methods
        .send(
          to,
          value
            .shiftedBy(tokenDecimal - 0)
            .toFixed(0)
            .toString(),
          '',
        )
        .encodeABI();
    }
    return {
      to: isTransfer ? contractAddr : to,
      from,
      nonce,
      value: isTransfer? new BigNumber(0): value,
      gasPrice,
      gasLimit,
      timestamp: new Date().getTime() * 1000,
      data,
      type: 1,
      tknTo: isTransfer? to: '',
      tknValue: isTransfer? value: new BigNumber(0)
    }
  }

  function getTransactionsByAddress(address, page = 0, size = 25) {
    const url = `${config.explorer_api}/aion/dashboard/getTransactionsByAddress?accountAddress=${address.toLowerCase()}&page=${page}&size=${size}`;
    console.log(`[aion req] get aion transactions by address: ${url}`);
    return new Promise((resolve, reject) => {
      HttpClient.get(url, false)
        .then((res) => {
          console.log('[keystore resp] res:', res.data);
          const { content } = res.data;
          const txs = {};
          content.forEach((t) => {
            const tx:any = {};
            const timestamp_ = `${t.transactionTimestamp}`;
            tx.hash = `0x${t.transactionHash}`;
            tx.timestamp = timestamp_.length === 16
              ? parseInt(timestamp_) / 1000
              : timestamp_.length === 13
                ? parseInt(timestamp_) * 1
                : timestamp_.length === 10
                  ? parseInt(timestamp_) * 1000
                  : null;
            tx.from = `0x${t.fromAddr}`;
            tx.to = `0x${t.toAddr}`;
            tx.value = new BigNumber(t.value, 10).toNumber();
            tx.status = t.txError === '' ? 'CONFIRMED' : 'FAILED';
            tx.blockNumber = t.blockNumber;
            tx.fee = t.nrgConsumed * t.nrgPrice * 10 ** -18;
            txs[tx.hash] = tx;
          });
          resolve(txs);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  function getTransactionUrlInExplorer(txHash) {
    return `${config.explorer}/${txHash}`;
  }

  function getTransactionStatus(txHash) {
    return new Promise((resolve, reject) => {
      getTransactionReceipt(txHash)
        .then((receipt: any) => {
          if (receipt !== null) {
            resolve({
              status: parseInt(receipt.status, 16) === 1,
              blockNumber: parseInt(receipt.blockNumber, 16),
              gasUsed: parseInt(receipt.gasUsed, 16),
            });
          } else {
            resolve(null);
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  return {
    sendTransaction,
    getTransactionsByAddress,
    getTransactionUrlInExplorer,
    getTransactionStatus,
    buildTransaction,
  };

}