const fs = require('fs');

const { BigNumber } = require("ethers");


const { formatBytes32String } = require("ethers/lib/utils");
const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)
const COLLATERAL_POOL_ID = formatBytes32String("WXDC")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)   // <- 0.5
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)  // <- 1.05
const TREASURY_FEE_BPS = BigNumber.from(5000) // <- 0.5

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const CollateralPoolConfig = artifacts.require('./8.17/stablecoin-core/config/CollateralPoolConfig.sol');
const BookKeeper = artifacts.require('./8.17/stablecoin-core/BookKeeper.sol');
const SimplePriceFeed = artifacts.require('./8.17/price-feeders/SimplePriceFeed.sol');
const PriceOracle = artifacts.require('./8.17/stablecoin-core/PriceOracle.sol');

module.exports = async function(deployer) {

  console.log(">> Initializing collateral-pool-config with WXDC");
  const collateralPoolConfig = await CollateralPoolConfig.at(stablecoinAddress.collateralPoolConfig);

  const bookKeeper = await BookKeeper.at(stablecoinAddress.bookKeeper);

  const simplePriceFeed = await SimplePriceFeed.at(stablecoinAddress.simplePriceFeed);

  const priceOracle = await PriceOracle.at(stablecoinAddress.priceOracle);


//   await collateralPoolConfig.setStrategy(COLLATERAL_POOL_ID, fixedSpreadLiquidationStrategy.address)
  const debtCeilingSetUpTotal = WeiPerRad.mul(10000000);
  const debtCeilingSetUpWXDC = WeiPerRad.mul(10000000).div(2);
  await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, debtCeilingSetUpWXDC, { gasLimit: 1000000 });
//   await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay);
  //setting _rawPrice and _priceWithSafetyMargin of WXDC to 100
  await simplePriceFeed.setPrice(WeiPerWad.mul(100), { gasLimit: 1000000 });
  await priceOracle.setPrice(COLLATERAL_POOL_ID, { gasLimit: 1000000 });
}