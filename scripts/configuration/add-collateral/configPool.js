const { ethers } = require("hardhat");
const { BigNumber } = ethers;

const { getProxy, getProxyById } = require("../../../common/proxies");
const { getConfig, getProxyId, poolId } = require("../../../common/add-collateral-helper");

const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`);
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`);

const CLOSE_FACTOR_BPS = BigNumber.from(2500); // <- 0.25
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500); // <- 1.05
const TREASURY_FEE_BPS = BigNumber.from(8000); // <- 0.8
const STABILITY_FEE = BigNumber.from("1000000000627937192491029811");
const LIQUIDATIONRATIO_75 = WeiPerRay.mul(133).div(100).toString(); // LTV 75%
const DEBT_CEILING = WeiPerRad.mul(10000000).div(2);

async function configPool(getChainId) {
  const chainId = await getChainId();

  const config = getConfig(chainId);

  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", config.fathomProxyFactory);
  const collateralTokenAdapter = await getProxyById(proxyFactory, "CollateralTokenAdapter", getProxyId("CollateralTokenAdapter"));
  const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
  const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
  const priceOracle = await getProxy(proxyFactory, "PriceOracle");
  const simplePriceFeed = await getProxy(proxyFactory, "SimplePriceFeed");

  const priceFeed = simplePriceFeed;

  await priceFeed.peekPrice();

  await collateralPoolConfig.initCollateralPool(
    poolId,
    DEBT_CEILING,
    0,
    WeiPerRad.mul(50000),
    priceFeed.address,
    LIQUIDATIONRATIO_75,
    STABILITY_FEE,
    collateralTokenAdapter.address,
    CLOSE_FACTOR_BPS.mul(2),
    LIQUIDATOR_INCENTIVE_BPS,
    TREASURY_FEE_BPS,
    fixedSpreadLiquidationStrategy.address,
  );

  await priceOracle.setPrice(poolId);
}
module.exports = { configPool };