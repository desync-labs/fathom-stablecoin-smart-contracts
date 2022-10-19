const fs = require('fs');

const { BigNumber } = require("ethers");


const { formatBytes32String } = require("ethers/lib/utils");
const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)
const COLLATERAL_POOL_ID = formatBytes32String("FTHM")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)   // <- 0.5
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)  // <- 1.05
const TREASURY_FEE_BPS = BigNumber.from(5000) // <- 0.5

// const rawdata = fs.readFileSync('../../../../addresses.json');
const rawdata = fs.readFileSync('../../../../addresses_ApothemV1.json');
let stablecoinAddress = JSON.parse(rawdata);

const CollateralPoolConfig = artifacts.require('./8.17/stablecoin-core/config/CollateralPoolConfig.sol');
const BookKeeper = artifacts.require('./8.17/stablecoin-core/BookKeeper.sol');
const SimplePriceFeed = artifacts.require('./8.17/price-feeders/SimplePriceFeed.sol');
const PriceOracle = artifacts.require('./8.17/stablecoin-core/PriceOracle.sol');

module.exports = async function(deployer) {

  console.log(">> Initializing collateral-pool-config with FTHM");
  const collateralPoolConfig = await CollateralPoolConfig.at(stablecoinAddress.collateralPoolConfig);

  const bookKeeper = await BookKeeper.at(stablecoinAddress.bookKeeper);

  const simplePriceFeedFTHM = await SimplePriceFeed.at("0x212d2fFcC949C84556F2eBcA5bDA37D83ba3e035");

  const priceOracle = await PriceOracle.at(stablecoinAddress.priceOracle);

  // await collateralPoolConfig.initCollateralPool(
  //   COLLATERAL_POOL_ID,  //<-_collateralPoolId
  //   0,   //<-_debtCeiling
  //   0,   //<-_debtFloor
  //   "0x212d2fFcC949C84556F2eBcA5bDA37D83ba3e035",  //<-_priceFeed // <- this one I need to deploy newly.
  //   WeiPerRay.mul(133).div(100),  //<-_liquidationRatio   1 RAY, therefore MAX LTV rate of 100%
  //   WeiPerRay,  //<-_stabilityFeeRate   Initially set as 1 RAY, which is 0 stability fee taken by the system from _usrs
  //   "0x86B2E78555fAEA58A522e72193935153D1bBF2Cc",   //<-_adapter  <- this one I need to deploy newly.
  //   CLOSE_FACTOR_BPS.mul(2),   // <-_closeFactorBps    mul(2) therefore 100%
  //   LIQUIDATOR_INCENTIVE_BPS,  //<-_liquidatorIncentiveBps
  //   TREASURY_FEE_BPS,  //<-_treasuryFeesBps
  //   stablecoinAddress.fixedSpreadLiquidationStrategy  //<-_strategy
  //   , { gas : 5000000 } 
  // );
//   await collateralPoolConfig.setStrategy(COLLATERAL_POOL_ID, fixedSpreadLiquidationStrategy.address)
  const debtCeilingSetUpTotal = WeiPerRad.mul(20000000);
  const debtCeilingSetUpFTHM = WeiPerRad.mul(10000000).div(2);
  await bookKeeper.setTotalDebtCeiling(debtCeilingSetUpTotal, { gasLimit: 1000000 });
  await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, debtCeilingSetUpFTHM, { gasLimit: 1000000 });
//   await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay);
  //setting _rawPrice and _priceWithSafetyMargin of WXDC to 100
  await simplePriceFeedFTHM.setPrice(WeiPerWad.mul(1), { gasLimit: 1000000 });
  await priceOracle.setPrice(COLLATERAL_POOL_ID, { gasLimit: 1000000 });
}