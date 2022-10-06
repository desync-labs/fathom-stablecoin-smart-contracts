const { assert } = require('chai');

function toHexBytes32(str) {
    return web3.utils.padRight(web3.utils.toHex(str), 64);
}

function toHexBytes32PadLeft(str) {
    return web3.utils.padLeft(web3.utils.toHex(str), 64);
}

function ethToWei(amount) {
    return web3.utils.toWei(amount, 'ether');
}

function weiToEth(amount) {
    return web3.utils.fromWei(amount, 'ether');
}

function dictionaryValuesToArray(dict) {
    var arr = [];
    for (var key in dict) {
        arr.push( dict[key] );
    }
    return arr;
}

function concatKeysAndValues(keys, values) {
    let data = "0x";
    for (let i = 0; i < keys.length; i++) {
        data = data.concat(keys[i].replace("0x", ""));
        data = data.concat(values[i].replace("0x", ""));
    }
    return data;
}

function generateKeyFromAccount(account, valueClassKey) {
    let key = account.replace('0x', '');
    for (i = key.length; i < 64; i += 2) {
        key += '00';
    }
    for (i = 0; i < 9 * 64; i += 2) {
        key += '00';
    }

    return web3.utils.keccak256(valueClassKey.key + key);
}

function generateRS(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

function keccakAndToBn(name) {
    return web3.utils.toBN(web3.utils.keccak256(name)).toString();;
}

function sumBnToString(num1, num2) {
    const sum = num1.add(num2);
    return sum.toString();
}

function subBnToString(num1, num2) {
    const sum = num1.sub(num2);
    return sum.toString();
}

function createPropertyId(context, value) {
    return web3.utils.keccak256(context.concat(web3.utils.toHex(value).replace("0x", "")));
}

class IdCounter {
    constructor() {
        this.id = 1;
    }
    getId() {
        return this.id++;
    }
}

module.exports = {
    IdCounter,
    toHexBytes32,
    generateRS,
    keccakAndToBn,
    ethToWei,
    weiToEth,
    dictionaryValuesToArray,
    generateKeyFromAccount,
    concatKeysAndValues,
    toHexBytes32PadLeft,
    sumBnToString,
    subBnToString,
    createPropertyId
};
