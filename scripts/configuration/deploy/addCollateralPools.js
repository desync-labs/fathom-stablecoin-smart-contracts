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
const LIQUIDATIONRATIO_75 = WeiPerRay.mul(133).div(100).toString(); // LTV 75%

async function addCollateralPools(deployments, getChainId) {
  const { log } = deployments;
  const chainId = await getChainId();

  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  
  const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
  const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
  const priceOracle = await getProxy(proxyFactory, "PriceOracle");
  const simplePriceFeed = await getProxy(proxyFactory, "SimplePriceFeed");
  // const centralizedOraclePriceFeed = await getProxy(proxyFactory, "CentralizedOraclePriceFeed");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");

  const debtCeilingSetUpTotal = WeiPerRad.mul(10000000);
  const debtCeilingSetUp = WeiPerRad.mul(10000000).div(2);
  
  // initial collateral price as 1 USD
  await simplePriceFeed.setPrice(WeiPerWad.toString());
  await simplePriceFeed.setPoolId(pools.XDC);
  await simplePriceFeed.peekPrice();
  // await centralizedOraclePriceFeed.peekPrice({ gasLimit: 2000000 });

  await initPool(pools.XDC, collateralTokenAdapter.address, simplePriceFeed.address, LIQUIDATIONRATIO_75);

  await bookKeeper.setTotalDebtCeiling(debtCeilingSetUpTotal);

  async function initPool(poolId, adapter, priceFeed, liquidationRatio) {
    await collateralPoolConfig.initCollateralPool(
      poolId,
      debtCeilingSetUp,
      0, // _debtFloor
      WeiPerRad.mul(50000), // _positionDebtCeiling
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

  log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  log("Collateral Pools Successfully Initialized!");
  log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! ");
}

module.exports = {
  addCollateralPools,
};