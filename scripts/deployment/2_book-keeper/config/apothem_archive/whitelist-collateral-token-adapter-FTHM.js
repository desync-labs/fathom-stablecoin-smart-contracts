const fs = require('fs');

// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);

const BookKeeper = artifacts.require('./8.17/stablecoin-core/BookKeeper.sol');

module.exports =  async function(deployer) {

  const bookKeeper = await BookKeeper.at("0x3518B6ac30B3B4B886E1639ada852795165b2596");

  console.log(">> whitelist-collateral-token-adapter")
  await bookKeeper.whitelist("0x86B2E78555fAEA58A522e72193935153D1bBF2Cc")
  console.log("✅ Done")

};