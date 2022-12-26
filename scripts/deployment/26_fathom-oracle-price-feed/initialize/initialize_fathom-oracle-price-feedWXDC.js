const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const FathomOraclePriceFeed = artifacts.require('./main/price-feeders/FathomOraclePriceFeed.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing fathom-oracle-price-feedWXDC")

  const fathomOraclePriceFeed = await FathomOraclePriceFeed.at(stablecoinAddress.fathomOraclePriceFeedWXDC);

  await fathomOraclePriceFeed.initialize(
    stablecoinAddress.dexPriceOracle,   //DexPriceOracle
    stablecoinAddress.USDT,  //USDT , actually US+
    stablecoinAddress.WXDC, //WXDC
    stablecoinAddress.accessControlConfig // Access Control Config
  )
};