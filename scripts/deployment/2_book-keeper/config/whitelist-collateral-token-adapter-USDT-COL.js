const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const BookKeeper = artifacts.require('./8.17/stablecoin-core/BookKeeper.sol');

module.exports =  async function(deployer) {

  const bookKeeper = await BookKeeper.at(stablecoinAddress.bookKeeper);

  console.log(">> whitelist-collateral-token-adapter")
  await bookKeeper.whitelist(stablecoinAddress.collateralTokenAdapterUSDTCOL)
  console.log("✅ Done")

};