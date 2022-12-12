const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const FathomOraclePriceFeed = artifacts.require('./8.17/price-feeders/FathomOraclePriceFeed.sol');

require("dotenv").config();
const WXDCAdd = process.env.WXDC_ADDRESS;

module.exports =  async function(deployer) {
  console.log(">> Initializing fathom-oracle-price-feedWXDC")

  const fathomOraclePriceFeed = await FathomOraclePriceFeed.at(stablecoinAddress.fathomOraclePriceFeedWXDC);

  await fathomOraclePriceFeed.initialize(
    stablecoinAddress.dexPriceOracle,   //DexPriceOracle
    stablecoinAddress.USDT,  //USDT , actually US+
    WXDCAdd, //WXDC
    stablecoinAddress.accessControlConfig // Access Control Config
  )
};