const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const BookKeeper = artifacts.require('./main/stablecoin-core/BookKeeper.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing bookKeeper")

  const bookKeeper = await BookKeeper.at(stablecoinAddress.bookKeeper);


  await bookKeeper.initialize(
    stablecoinAddress.collateralPoolConfig,
    stablecoinAddress.accessControlConfig,
  )

};