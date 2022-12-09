const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const FathomOraclePriceFeed = artifacts.require('./8.17/price-feeders/FathomOraclePriceFeed.sol');

require("dotenv").config();
const WXDCAdd = process.env.WXDC_ADDRESS;
const USDTAdd = process.env.USDT_ADDRESS;
const FTHMAdd = process.env.FTHM_ADDRESS;

module.exports =  async function(deployer) {
  console.log(">> Initializing fathom-oracle-price-feedWXDC")

  const fathomOraclePriceFeed = await FathomOraclePriceFeed.at(stablecoinAddress.fathomOraclePriceFeedWXDC);

  await fathomOraclePriceFeed.initialize(
    stablecoinAddress.dexPriceOracle,   //DexPriceOracle
    USDTAdd,  //USDT , actually US+
    WXDCAdd, //WXDC
    stablecoinAddress.accessControlConfig // Access Control Config
  )
};