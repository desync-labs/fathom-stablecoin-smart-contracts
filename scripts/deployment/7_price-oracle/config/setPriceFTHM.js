const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("FTHM")
// const CollateralPoolConfig = artifacts.require('./8.17/stablecoin-core/config/CollateralPoolConfig.sol');

const PriceOracle = artifacts.require('./8.17/stablecoin-core/PriceOracle.sol');

module.exports =  async function(deployer) {
  console.log(">> Set Price FTHM")

  const priceOracle = await PriceOracle.at(stablecoinAddress.priceOracle);
  
  // const priceWithSafetyMargin = await collateralPoolConfig.getPriceWithSafetyMargin(COLLATERAL_POOL_ID);
  // console.log("priceWithSafetyMargin is " + priceWithSafetyMargin);

  // const collateralPoolConfig = await CollateralPoolConfig.at(stablecoinAddress.collateralPoolConfig);
  await priceOracle.setPrice(
    COLLATERAL_POOL_ID
  )



};