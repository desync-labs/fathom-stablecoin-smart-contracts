// const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("US+COL")

const PriceOracle = artifacts.require('./8.17/stablecoin-core/PriceOracle.sol');

const CollateralPoolConfig = artifacts.require('./8.17/stablecoin-core/config/CollateralPoolConfig.sol');


module.exports =  async function(deployer) {
  console.log(">> USDT-STABLE PRICE TANK")

  const priceOracle = await PriceOracle.at("0x32CCe8931422bca01dE1664fcD6A16a5f20585f6");

  const collateralPoolConfig = await CollateralPoolConfig.at("0x48853e29341Bf581D56cF8Ff330a0F7371BFFFC6");
  await priceOracle.setPrice(
    COLLATERAL_POOL_ID
  )

  const priceWithSafetyMargin = await collateralPoolConfig.getPriceWithSafetyMargin(COLLATERAL_POOL_ID);
  console.log("priceWithSafetyMargin is " + priceWithSafetyMargin);
};