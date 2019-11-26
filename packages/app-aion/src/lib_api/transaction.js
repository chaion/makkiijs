/* eslint-disable no-nested-ternary */
/* eslint-disable radix */
import BigNumber from 'bignumber.js';
import Contract from 'aion-web3-eth-contract';
import { HttpClient } from 'lib-common-util-js';
import { CONTRACT_ABI } from './constants';
import jsonrpcClient from './jsonrpc';
import keystore from '../lib_keystore';

export default (config) => {

  const { getTransactionReceipt, getTransactionCount, sendSignedTransaction } = jsonrpcClient(config);

  function sendNativeTx(account, to, value_, gasPrice, gasLimit, data, shouldBroadCast) {
    const { type, derivationIndex, private_key: privateKey } = account;
    return new Promise((resolve, reject) => {
      const value = BigNumber.isBigNumber(value_) ? value_ : new BigNumber(value_);
      getTransactionCount(account.address, 'pending')
        .then((count) => {
          let extra_param = { type };
          if (type === '[ledger]') {
            extra_param = {
              ...extra_param,
              derivationIndex,
              sender: account.address,
            };
          }
          let tx = {
            nonce: count,
            to,
            amount: value.shiftedBy(18),
            timestamp: new Date().getTime() * 1000,
            type: 1,
            gasPrice,
            gas: gasLimit,
            extra_param,
            private_key: privateKey,
          };
          if (data !== undefined) {
            tx = { ...tx, data };
          }

          keystore.signTransaction(tx)
            .then(({ encoded }) => {
              if (shouldBroadCast) {
                sendSignedTransaction(`0x${encoded}`)
                  .then((hash) => {
                    const pendingTx = {
                      hash,
                      timestamp: tx.timestamp / 1000,
                      from: account.address,
                      to,
                      value,
                      status: 'PENDING',
                      gasPrice,
                    };
                    resolve({ pendingTx });
                  })
                  .catch((err) => {
                    console.log('keystore send signed tx error:', err);
                    reject(err);
                  });
              } else {
                const txObj = {
                  timestamp: tx.timestamp / 1000,
                  from: account.address,
                  to,
                  value,
                  gasPrice,
                };
                resolve({ encoded, txObj });
              }
            })
            .catch((err) => {
              console.log('keystore sign tx error:', err);
              reject(err);
            });
        })
        .catch((err) => {
          console.log('keystore get transaction count error: ', err);
          reject(err);
        });
    });
  }


  function sendTokenTx(account, symbol, to, value, gasPrice, gasLimit, shouldBroadCast) {
    const { tokens } = account;
    const { contractAddr, tokenDecimal } = tokens[symbol];
    console.log('tokenDecimal=>', tokenDecimal);
    const tokenContract = new Contract(CONTRACT_ABI, contractAddr);
    const methodsData = tokenContract.methods
      .send(
        to,
        value
          .shiftedBy(tokenDecimal - 0)
          .toFixed(0)
          .toString(),
        '',
      )
      .encodeABI();

    return new Promise((resolve, reject) => {
      sendNativeTx(
        account,
        contractAddr,
        new BigNumber(0),
        gasPrice,
        gasLimit,
        methodsData,
        shouldBroadCast,
      )
        .then((res) => {
          if (shouldBroadCast) {
            const { pendingTx } = res;
            pendingTx.tknTo = to;
            pendingTx.tknValue = value;
            resolve({ pendingTx });
          } else {
            resolve(res);
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  function sendTransaction(account, to, value, data, extraParams, shouldBroadCast = true) {
    const { gasPrice, gasLimit, symbol } = extraParams;
    if (account.symbol === symbol) {
      return sendNativeTx(account, to, value, gasPrice, gasLimit, data, shouldBroadCast);
    }
    return sendTokenTx(account, symbol, to, value, gasPrice, gasLimit, shouldBroadCast);
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
            const tx = {};
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
        .then((receipt) => {
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
  };

}