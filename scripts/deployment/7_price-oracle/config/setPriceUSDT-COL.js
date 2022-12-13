const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("US+COL")

const PriceOracle = artifacts.require('./8.17/stablecoin-core/PriceOracle.sol');

const CollateralPoolConfig = artifacts.require('./8.17/stablecoin-core/config/CollateralPoolConfig.sol');


module.exports =  async function(deployer) {
  console.log(">> USDT-STABLE PRICE TANK")

  const priceOracle = await PriceOracle.at(stablecoinAddress.priceOracle);

  const collateralPoolConfig = await CollateralPoolConfig.at(stablecoinAddress.collateralPoolConfig);
  await priceOracle.setPrice(
    COLLATERAL_POOL_ID
  )
  const priceWithSafetyMargin = await collateralPoolConfig.getPriceWithSafetyMargin(COLLATERAL_POOL_ID);
  console.log("priceWithSafetyMargin is " + priceWithSafetyMargin);

};