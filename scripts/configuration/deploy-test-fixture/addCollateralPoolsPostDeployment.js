const { ethers } = require("hardhat");
const { BigNumber } = ethers;

const pools = require("../../../common/collateral");
const { getProxy } = require("../../../common/proxies");

const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`);
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`);
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`);

const CLOSE_FACTOR_BPS = BigNumber.from(2500); // <- 0.25
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500); // <- 1.05
const TREASURY_FEE_BPS = BigNumber.from(8000); // <- 0.8
const STABILITY_FEE = BigNumber.from("1000000000627937192491029811");

async function addCollateralPoolsPostDeployment(deployments) {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);

  const MockSimplePriceFeed = await deployments.get("MockSimplePriceFeed");
  const mockSimplePriceFeed = await ethers.getContractAt("MockSimplePriceFeed", MockSimplePriceFeed.address);

  const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
  const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
  const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
  const priceOracle = await getProxy(proxyFactory, "PriceOracle");

  const MockCollateralTokenAdapter = await deployments.get("MockCollateralTokenAdapter");

  await mockSimplePriceFeed.initialize(accessControlConfig.address);

  const debtCeilingSetUpTotal = WeiPerRad.mul(200000000000000);
  const debtCeilingSetUp = WeiPerRad.mul(100000000000000);
  await mockSimplePriceFeed.setPoolId(pools.WNATIVE);
  await mockSimplePriceFeed.setPrice(WeiPerWad.mul(1));
  await mockSimplePriceFeed.setPoolId(pools.WNATIVE);

  await initPool(pools.WNATIVE, MockCollateralTokenAdapter.address, MockSimplePriceFeed.address, WeiPerRay);

  await bookKeeper.setTotalDebtCeiling(debtCeilingSetUpTotal);

  async function initPool(poolId, adapter, priceFeed, liquidationRatio) {
    await collateralPoolConfig.initCollateralPool(
      poolId,
      debtCeilingSetUp,
      0,
      WeiPerRad.mul(50000),
      priceFeed,
      liquidationRatio,
      STABILITY_FEE,
      adapter,
      CLOSE_FACTOR_BPS.mul(2),
      LIQUIDATOR_INCENTIVE_BPS,
      TREASURY_FEE_BPS,
      fixedSpreadLiquidationStrategy.address
    );

    await priceOracle.setPrice(poolId);
  }
}

module.exports = {
  addCollateralPoolsPostDeployment,
};
