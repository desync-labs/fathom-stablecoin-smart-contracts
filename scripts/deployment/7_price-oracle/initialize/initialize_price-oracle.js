const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const PriceOracle = artifacts.require('./main/stablecoin-core/PriceOracle.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing PriceOracle")

  const priceOracle = await PriceOracle.at(stablecoinAddress.priceOracle);


  await priceOracle.initialize(
    stablecoinAddress.bookKeeper
  )

};