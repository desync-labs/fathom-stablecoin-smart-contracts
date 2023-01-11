const fs = require('fs');

const { BigNumber } = require("ethers");


const { formatBytes32String } = require("ethers/lib/utils");
const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)
const COLLATERAL_POOL_ID = formatBytes32String("XDC")

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const CollateralPoolConfig = artifacts.require('./main/stablecoin-core/config/CollateralPoolConfig.sol');

module.exports = async function(deployer) {

  console.log(">> Set New Strategy");
  const collateralPoolConfig = await CollateralPoolConfig.at(stablecoinAddress.collateralPoolConfig);
  await collateralPoolConfig.setStrategy(COLLATERAL_POOL_ID, stablecoinAddress.fixedSpreadLiquidationStrategy, { gasLimit: 1000000 });
}