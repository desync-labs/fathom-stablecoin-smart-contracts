const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)

//config parameter
const COLLATERAL_POOL_ID_WXDC = formatBytes32String("WXDC")
const COLLATERAL_POOL_ID_WETH = formatBytes32String("WETH")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)
const TREASURY_FEE_BPS = BigNumber.from(5000)

const AddressZero = "0x0000000000000000000000000000000000000000";

let rawdata = fs.readFileSync('./scripts/n_multipleCollateral/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);
const bookKeeperJSON = {
  address : addresses.bookKeeper
}
const collateralPoolConfigJSON = {
  address : addresses.collateralPoolConfig
}
const collateralTokenAdapterWXDCJSON = {
  address : addresses.collateralTokenAdapterWXDC
}
const collateralTokenAdapterWETHJSON = {
  address : addresses.collateralTokenAdapterWETH
}
const PriceOracleJSON = {
  address : addresses.priceOracle
}
const fixedSpreadLiquidationStrategyJSON = {
  address : addresses.fixedSpreadLiquidationStrategy
}

let rawdata2 = fs.readFileSync('./scripts/n_multipleCollateral/cupcakes/1_createPriceFeed.json');
let friceFeeds = JSON.parse(rawdata2);

const WETHfathomOraclePriceFeed = {
  address : friceFeeds.WETHfathomOraclePriceFeed
}
const WXDCfathomOraclePriceFeed = {
  address : friceFeeds.WXDCfathomOraclePriceFeed
}

async function main() {
  //BookKeeper attach
  const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
  const bookKeeper = await BookKeeper.attach(
    bookKeeperJSON.address // The deployed contract address
  )
  //CollateralPoolConfig attach
  const CollateralPoolConfig = await hre.ethers.getContractFactory("CollateralPoolConfig");
  const collateralPoolConfig = await CollateralPoolConfig.attach(
    collateralPoolConfigJSON.address // The deployed contract address
  )

  //PriceOracle attach
  const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.attach(
    PriceOracleJSON.address // The deployed contract address
  )
  //CollateralTokenAdapter attach
  const CollateralTokenAdapter = await hre.ethers.getContractFactory("CollateralTokenAdapter");
  const collateralTokenAdapterWXDC = await CollateralTokenAdapter.attach(
    collateralTokenAdapterWXDCJSON.address // The deployed contract address
  )
  const collateralTokenAdapterWETH= await CollateralTokenAdapter.attach(
    collateralTokenAdapterWETHJSON.address // The deployed contract address
  )

  // fixedSpreadLiquidationStrategy attach
  const FixedSpreadLiquidationStrategy = await hre.ethers.getContractFactory("FixedSpreadLiquidationStrategy");
  const fixedSpreadLiquidationStrategy = await FixedSpreadLiquidationStrategy.attach(
    fixedSpreadLiquidationStrategyJSON.address // The deployed contract address
  )

  const debtCeilingSetUp = WeiPerRad.mul(10000000);
  await bookKeeper.setTotalDebtCeiling(debtCeilingSetUp);

  await initCollateralPool(WXDCfathomOraclePriceFeed.address, COLLATERAL_POOL_ID_WXDC, collateralTokenAdapterWXDC.address);
  console.log("WXDC pool initiated");

  await initCollateralPool(WETHfathomOraclePriceFeed.address, COLLATERAL_POOL_ID_WETH, collateralTokenAdapterWETH.address);
  console.log("WETH pool initiated")

  let params = { 
    COLLATERAL_POOL_ID_WETH: COLLATERAL_POOL_ID_WETH,
    COLLATERAL_POOL_ID_WXDC: COLLATERAL_POOL_ID_WXDC,
    DEBT_CEILING: debtCeilingSetUp,
    CLOSE_FACTOR_BPS: CLOSE_FACTOR_BPS,
    LIQUIDATOR_INCENTIVE_BPS : LIQUIDATOR_INCENTIVE_BPS,
    TREASURY_FEE_BPS: TREASURY_FEE_BPS,
  };
  
  let data = JSON.stringify(params);
  fs.writeFileSync('./scripts/n_multipleCollateral/cupcakes/1_collateralPoolConfig.json', data);


  async function initCollateralPool(priceFeed, poolId, tokenAdapter) {
    await collateralPoolConfig.initCollateralPool(
      poolId,
      0,
      0,
      priceFeed,
      BigNumber.from("1428571429000000000000000000"),
      WeiPerRay,
      tokenAdapter,
      CLOSE_FACTOR_BPS.mul(2),
      LIQUIDATOR_INCENTIVE_BPS,
      TREASURY_FEE_BPS,
      AddressZero //<-_strategy .. It is later 
    );
    await collateralPoolConfig.setStrategy(poolId, fixedSpreadLiquidationStrategy.address);
    await collateralPoolConfig.setDebtCeiling(poolId, debtCeilingSetUp);
    await priceOracle.setPrice(poolId);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
