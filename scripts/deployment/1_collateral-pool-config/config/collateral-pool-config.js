const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const { BigNumber } = require("ethers");

const { formatBytes32String } = require("ethers/lib/utils");
const WeiPerWad = hre.ethers.constants.WeiPerEther
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)
const COLLATERAL_POOL_ID = formatBytes32String("WXDC")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)   // <- 0.5
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)  // <- 1.05
const TREASURY_FEE_BPS = BigNumber.from(5000) // <- 0.5

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  const signers = await ethers.getSigners()
  const deployerAddress = signers[0].address;
  const devAddress = signers[3].address;

  console.log(">> Initializing collateral-pool-config with WXDC");
  const CollateralPoolConfig = await hre.ethers.getContractFactory("CollateralPoolConfig");
  const collateralPoolConfig = await CollateralPoolConfig.attach(stablecoinAddress.collateralPoolConfig);

  const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
  const bookKeeper = await BookKeeper.attach(stablecoinAddress.bookKeeper);

  const SimplePriceFeed = await hre.ethers.getContractFactory("SimplePriceFeed");
  const simplePriceFeed = await SimplePriceFeed.attach(stablecoinAddress.simplePriceFeed);

  const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.attach(stablecoinAddress.priceOracle);

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
  )
//   await collateralPoolConfig.setStrategy(COLLATERAL_POOL_ID, fixedSpreadLiquidationStrategy.address)
  const debtCeilingSetUpTotal = WeiPerRad.mul(10000000);
  const debtCeilingSetUpWXDC = WeiPerRad.mul(10000000).div(2);
  await bookKeeper.setTotalDebtCeiling(debtCeilingSetUpTotal);
  await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, debtCeilingSetUpWXDC);
//   await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay);
  //setting _rawPrice and _priceWithSafetyMargin of WXDC to 100
  await simplePriceFeed.setPrice(WeiPerWad.mul(100));
  await priceOracle.setPrice(COLLATERAL_POOL_ID);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});