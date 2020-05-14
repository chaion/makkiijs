"use strict";
exports.__esModule = true;
var ethereumjs_util_1 = require("ethereumjs-util");
var makkii_utils_1 = require("@makkii/makkii-utils");
var ec = require("elliptic").ec("secp256k1");
var padTo32 = function (msg) {
    while (msg.length < 32) {
        msg = Buffer.concat([Buffer.from([0]), msg]);
    }
    if (msg.length !== 32) {
        throw new Error("invalid key length: " + msg.length);
    }
    return msg;
};
exports.keyPair = function (priKey) {
    if (typeof priKey === "string") {
        if (priKey.startsWith("0x")) {
            priKey = priKey.substring(2);
        }
        priKey = Buffer.from(priKey, "hex");
    }
    if (priKey.length !== 32) {
        throw new Error("private key length is " + priKey.length + " , expected keystore 32 bytes");
    }
    var key = ec.keyFromPrivate(priKey);
    var bip32pubKey = key.getPublic().toJSON();
    var publicKey = Buffer.concat([
        padTo32(Buffer.from(bip32pubKey[0].toArray())),
        padTo32(Buffer.from(bip32pubKey[1].toArray()))
    ]);
    var address = "0x" + ethereumjs_util_1.pubToAddress(publicKey).toString("hex");
    address = ethereumjs_util_1.toChecksumAddress(address);
    return {
        privateKey: key.getPrivate("hex"),
        publicKey: makkii_utils_1.hexutil.toHex(publicKey),
        address: address,
        sign: function (hash) { return key.sign(hash); }
    };
};
