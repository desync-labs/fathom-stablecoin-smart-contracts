const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const FathomOraclePriceFeed = artifacts.require('./8.17/price-feeders/FathomOraclePriceFeed.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing fathom-oracle-price-feedFTHM")

  const fathomOraclePriceFeed = await FathomOraclePriceFeed.at(stablecoinAddress.fathomOraclePriceFeedFTHM);

  await fathomOraclePriceFeed.initialize(
    stablecoinAddress.dexPriceOracle,  //DexPriceOracle
    stablecoinAddress.USDT,  //USDT, well actually US+
    stablecoinAddress.fathomToken, //FTHM
    stablecoinAddress.accessControlConfig // Access Control Config
  )
};