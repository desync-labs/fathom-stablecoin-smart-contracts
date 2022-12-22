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

const CollateralPoolConfig = artifacts.require('./main/stablecoin-core/config/CollateralPoolConfig.sol');
const BookKeeper = artifacts.require('./main/stablecoin-core/BookKeeper.sol');
const SimplePriceFeed = artifacts.require('./tests/SimplePriceFeed.sol');
const PriceOracle = artifacts.require('./main/stablecoin-core/PriceOracle.sol');

module.exports = async function(deployer) {

  console.log(">> Initializing collateral-pool-config with WXDC");
  const collateralPoolConfig = await CollateralPoolConfig.at(stablecoinAddress.collateralPoolConfig);

  const bookKeeper = await BookKeeper.at(stablecoinAddress.bookKeeper);

  const simplePriceFeed = await SimplePriceFeed.at(stablecoinAddress.simplePriceFeed);

  const priceOracle = await PriceOracle.at(stablecoinAddress.priceOracle);

  await collateralPoolConfig.initCollateralPool(
    COLLATERAL_POOL_ID,  //<-_collateralPoolId
    0,   //<-_debtCeiling
    0,   //<-_debtFloor
    stablecoinAddress.simplePriceFeed,  //<-_priceFeed
    WeiPerRay,  //<-_liquidationRatio   1 RAY, therefore MAX LTV rate of 100%
    WeiPerRay,  //<-_stabilityFeeRate   Initially set as 1 RAY, which is 0 stability fee taken by the system from _usrs
    stablecoinAddress.collateralTokenAdapter,   //<-_adapter
    CLOSE_FACTOR_BPS.mul(2),   // <-_closeFactorBps    mul(2) therefore 100%
    LIQUIDATOR_INCENTIVE_BPS,  //<-_liquidatorIncentiveBps
    TREASURY_FEE_BPS,  //<-_treasuryFeesBps
    stablecoinAddress.fixedSpreadLiquidationStrategy  //<-_strategy
    , { gas : 8000000 } 
  )
//   await collateralPoolConfig.setStrategy(COLLATERAL_POOL_ID, fixedSpreadLiquidationStrategy.address)
  const debtCeilingSetUpTotal = WeiPerRad.mul(10000000);
  const debtCeilingSetUpWXDC = WeiPerRad.mul(10000000).div(2);
  await bookKeeper.setTotalDebtCeiling(debtCeilingSetUpTotal, { gasLimit: 1000000 });
  await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, debtCeilingSetUpWXDC, { gasLimit: 1000000 });
//   await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay);
  //setting _rawPrice and _priceWithSafetyMargin of WXDC to 100
  await simplePriceFeed.setPrice(WeiPerWad.mul(100), { gasLimit: 1000000 });
  await priceOracle.setPrice(COLLATERAL_POOL_ID, { gasLimit: 1000000 });
}