const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const BookKeeper = artifacts.require('./8.17/stablecoin-core/BookKeeper.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing bookKeeper")

  const bookKeeper = await BookKeeper.at(stablecoinAddress.bookKeeper);


  await bookKeeper.initialize(
    stablecoinAddress.collateralPoolConfig,
    stablecoinAddress.accessControlConfig,
  )

};